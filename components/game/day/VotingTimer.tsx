import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { useGameContext } from '../../../contexts/GameContext';
import { GamePhase } from '../../../types';

export const VotingTimer: React.FC = React.memo(() => {
    const { gameState, myPlayer, voteOnChain, addLog } = useGameContext();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [timerMode, setTimerMode] = useState<'soft' | 'transition' | 'hard'>('soft');
    const hasAutoVotedRef = useRef(false);

    // Contract: 90s (1.5m). Target: 30s soft timer. Buffer: 60s hard timer.
    const BUFFER = 60;

    // Primitives for dependency array stability
    const phaseDeadline = gameState.phaseDeadline;
    const myAddress = myPlayer?.address;
    const hasVoted = myPlayer?.hasVoted;
    const isAlive = myPlayer?.isAlive;
    const isVotingPhase = gameState.phase === GamePhase.VOTING;

    useEffect(() => {
        if (!phaseDeadline) return;

        const tick = () => {
            const now = Math.floor(Date.now() / 1000);
            const realRemaining = Math.max(0, phaseDeadline - now);
            const softRemaining = realRemaining - BUFFER;

            if (softRemaining > 0) {
                // --- PHASE 1: SOFT TIMER (0-60s) ---
                setTimeLeft(softRemaining);
                setTimerMode('soft');
            } else {
                // --- PHASE 2: DEADLINE REACHED ---
                const overtimeSeconds = Math.abs(softRemaining);

                if (overtimeSeconds < 5) {
                    // --- TRANSITION (0-5s after deadline) ---
                    // Show 0:00 and attempt auto-vote
                    setTimeLeft(0);
                    setTimerMode('transition');

                    // Guard: only auto-vote if still in VOTING phase (prevents stale fire after NightStarted resets hasVoted flags)
                    if (!hasAutoVotedRef.current && myAddress && !hasVoted && isAlive && isVotingPhase) {
                        hasAutoVotedRef.current = true;
                        addLog("1 minute limit reached. Auto-voting for self...", "warning");
                        const freshPlayer = gameState.players.find(p => p.address.toLowerCase() === myAddress.toLowerCase());
                        if (freshPlayer?.hasVoted) return; // Already voted manually
                        voteOnChain(myAddress as `0x${string}`).catch(e => {
                            console.error("[AutoVote] Failed:", e);
                            hasAutoVotedRef.current = false; // Allow retry
                            addLog("Auto-vote failed. Please vote manually!", "danger");
                        });
                    }
                } else {
                    // --- PHASE 3: HARD TIMER (Remaining ~115s) ---
                    // If game is still going, show real contract time
                    setTimeLeft(realRemaining);
                    setTimerMode('hard');

                    // LATE JOINER PROTECTION: Auto-vote if in Hard Mode
                    if (!hasAutoVotedRef.current && myAddress && !hasVoted && isAlive && isVotingPhase) {
                        hasAutoVotedRef.current = true;
                        addLog("Late join during hard timer. Auto-voting for self...", "warning");
                        const freshPlayer = gameState.players.find(p => p.address.toLowerCase() === myAddress.toLowerCase());
                        if (freshPlayer?.hasVoted) return;
                        voteOnChain(myAddress as `0x${string}`).catch(e => {
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
    }, [phaseDeadline, myAddress, hasVoted, isAlive, isVotingPhase, voteOnChain, addLog, gameState.players]);

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
