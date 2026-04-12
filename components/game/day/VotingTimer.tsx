import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { useGameContext } from '../../../contexts/GameContext';
import { GamePhase } from '../../../types';

export const VotingTimer: React.FC = React.memo(() => {
    const { gameState, myPlayer, voteOnChain, addLog } = useGameContext();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [timerMode, setTimerMode] = useState<'soft' | 'transition' | 'hard'>('soft');
    const hasAutoVotedRef = useRef(false);
    // First-tick "voting phase entered at" timestamp — used to enforce a minimum
    // manual-vote window regardless of contract timer length.
    const phaseStartedAtRef = useRef<number | null>(null);

    // BUFFER locked per voting round. Previously BUFFER was recomputed on every
    // effect re-run (and the effect depended on gameState.players, which got a
    // new array reference on every dataSync refresh — ~every 2-3s). Because
    // BUFFER = floor(realRemaining/2), recomputing mid-second would bump the
    // displayed softRemaining UP by 1 on odd-second re-runs — the visible
    // "rewind by a second" players were reporting. Latching the value on the
    // first run of each phaseDeadline fixes both the rewind AND the 1-second
    // freeze (the setInterval no longer restarts on every players update).
    const bufferRef = useRef<{ deadline: number; value: number } | null>(null);

    // Minimum window (seconds) a player gets to cast a manual vote before any
    // failsafe kicks in. Prevents the "everyone insta-self-votes" bug when the
    // contract VOTING duration is shorter than the legacy hard buffer.
    const MIN_MANUAL_VOTE_WINDOW = 15;

    // Primitives for dependency array stability
    const phaseDeadline = gameState.phaseDeadline;
    const myAddress = myPlayer?.address;
    const hasVoted = myPlayer?.hasVoted;
    const isAlive = myPlayer?.isAlive;
    const isVotingPhase = gameState.phase === GamePhase.VOTING;

    // Reactive data used inside tick() is read through a ref so the main timer
    // effect doesn't have to list every changing piece in its dep array. Without
    // this, each players/hasVoted/isAlive change would tear down and recreate
    // the setInterval, delaying the next tick by up to ~1 second — visible as
    // the timer "freezing" for a second.
    const latestRef = useRef({ myAddress, hasVoted, isAlive, isVotingPhase, players: gameState.players });
    useEffect(() => {
        latestRef.current = { myAddress, hasVoted, isAlive, isVotingPhase, players: gameState.players };
    });

    // Reset auto-vote guard + phase-start ref whenever the voting phase ends so
    // each new voting round starts from a clean slate.
    useEffect(() => {
        if (!isVotingPhase) {
            hasAutoVotedRef.current = false;
            phaseStartedAtRef.current = null;
            bufferRef.current = null;
        } else if (phaseStartedAtRef.current == null) {
            phaseStartedAtRef.current = Math.floor(Date.now() / 1000);
        }
    }, [isVotingPhase]);

    useEffect(() => {
        if (!phaseDeadline) return;

        // Latch BUFFER on first run of each new voting round — computed from
        // the initial window the first time we see this phaseDeadline, never
        // recomputed while the round is active.
        if (!bufferRef.current || bufferRef.current.deadline !== phaseDeadline) {
            const initialNow = Math.floor(Date.now() / 1000);
            const totalVotingDuration = Math.max(0, phaseDeadline - initialNow);
            bufferRef.current = {
                deadline: phaseDeadline,
                value: Math.min(60, Math.max(5, Math.floor(totalVotingDuration / 2))),
            };
        }
        const BUFFER = bufferRef.current.value;

        const tick = () => {
            const now = Math.floor(Date.now() / 1000);
            const realRemaining = Math.max(0, phaseDeadline - now);
            const softRemaining = realRemaining - BUFFER;
            const elapsedInPhase = phaseStartedAtRef.current
                ? now - phaseStartedAtRef.current
                : 0;
            // Hard gate: never auto-vote until the player has had a real chance
            // to vote manually for this voting phase.
            const canAutoVote = elapsedInPhase >= MIN_MANUAL_VOTE_WINDOW;

            // Read reactive data from the ref so this closure doesn't need
            // gameState.players/myAddress/etc. in the effect deps.
            const { myAddress: curAddress, hasVoted: curHasVoted, isAlive: curIsAlive, isVotingPhase: curIsVoting, players: curPlayers } = latestRef.current;

            if (softRemaining > 0) {
                // --- PHASE 1: SOFT TIMER ---
                setTimeLeft(softRemaining);
                setTimerMode('soft');
            } else {
                // --- PHASE 2: DEADLINE REACHED ---
                const overtimeSeconds = Math.abs(softRemaining);

                if (overtimeSeconds < 5) {
                    // --- TRANSITION (0-5s after soft deadline) ---
                    setTimeLeft(0);
                    setTimerMode('transition');

                    if (canAutoVote && !hasAutoVotedRef.current && curAddress && !curHasVoted && curIsAlive && curIsVoting) {
                        hasAutoVotedRef.current = true;
                        addLog("Voting time expired. Auto-voting for self...", "warning");
                        const freshPlayer = curPlayers.find(p => p.address.toLowerCase() === curAddress.toLowerCase());
                        if (freshPlayer?.hasVoted) return; // Already voted manually
                        voteOnChain(curAddress as `0x${string}`).catch(e => {
                            console.error("[AutoVote] Failed:", e);
                            hasAutoVotedRef.current = false; // Allow retry
                            addLog("Auto-vote failed. Please vote manually!", "danger");
                        });
                    }
                } else {
                    // --- PHASE 3: HARD TIMER ---
                    setTimeLeft(realRemaining);
                    setTimerMode('hard');

                    // LATE JOINER PROTECTION — gated by the same minimum window
                    // so fresh voting rounds don't insta-self-vote.
                    if (canAutoVote && !hasAutoVotedRef.current && curAddress && !curHasVoted && curIsAlive && curIsVoting) {
                        hasAutoVotedRef.current = true;
                        addLog("Late join during hard timer. Auto-voting for self...", "warning");
                        const freshPlayer = curPlayers.find(p => p.address.toLowerCase() === curAddress.toLowerCase());
                        if (freshPlayer?.hasVoted) return;
                        voteOnChain(curAddress as `0x${string}`).catch(e => {
                            console.error("[AutoVote] Failed:", e);
                            hasAutoVotedRef.current = false;
                            addLog("Auto-vote failed.", "danger");
                        });
                    }
                }
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
        // Intentionally narrow deps: only the phase-lifecycle pieces. Everything
        // reactive that tick() reads is piped through latestRef.current so
        // players/hasVoted/isAlive updates don't restart the interval.
    }, [phaseDeadline, voteOnChain, addLog]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    const isUrgent = (timerMode === 'soft' && timeLeft <= 10) || timerMode === 'transition';
    const isHardWait = timerMode === 'hard';

    return (
        <div className={`w-full py-2 text-center rounded-md border transition-colors duration-500 shadow-[0_5px_15px_rgba(0,0,0,0.8)]
            ${isUrgent ? 'bg-[#0A0A0A] border-[#916A47]/40 ring-1 ring-[#916A47]/20 relative overflow-hidden' :
                isHardWait ? 'bg-[#0A0A0A] border-[#916A47]/30' :
                    'bg-[#0A0A0A] border-[#916A47]/30'}`}>

            <div className="flex items-center justify-center gap-2">
                <Clock className={`w-4 h-4 text-[#916A47] ${isUrgent ? 'animate-pulse' : ''}`} />
                <span className={`text-2xl font-bold tabular-nums 
                    ${isUrgent ? 'text-[#916A47] animate-pulse drop-shadow-[0_0_8px_rgba(145,106,71,0.5)]' : isHardWait ? 'text-white/70 animate-pulse' : 'text-white'}`}>
                    {minutes}:{String(seconds).padStart(2, '0')}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-widest ml-2 text-[#916A47]`}>
                    {timerMode === 'soft' ? 'Voting Time' :
                        timerMode === 'transition' ? 'Auto-Voting...' : 'Waiting for AFK'}
                </span>
            </div>

            {timerMode === 'hard' && (
                <div className="text-[10px] text-white/60 font-mono mt-1 pt-1 border-t border-white/5 animate-pulse uppercase tracking-widest mx-4">
                    Some players are AFK...
                </div>
            )}
        </div>
    );
});
 VotingTimer.displayName = 'VotingTimer';
