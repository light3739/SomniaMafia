// components/game/DayPhase.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSoundEffects } from '../ui/SoundEffects';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { signRequest } from '@/services/requestSigning';
import { buildDiscussionMessage } from '@/services/signingSchema';
import { MAFIA_ABI } from '../../contracts/config';
import { GamePhase } from '../../types';
import { GameLog } from './GameLog';
import { emitGameSignal } from '../../services/signalBus';

// Internal Components
import { DiscussionSection } from './day/DiscussionSection';
import { VotingSection } from './day/VotingSection';

export interface DiscussionState {
    active: boolean;
    finished: boolean;
    phase: 'initial_delay' | 'speaking' | 'finished';
    currentSpeakerIndex: number;
    currentSpeakerAddress: string | null;
    totalSpeakers: number;
    timeRemaining: number;
    delayDuration?: number;
    isMyTurn: boolean;
}

interface DayPhaseProps {
    isNightTransition?: boolean;
    delaySeconds?: number;
    hideActions?: boolean;
    initialDiscussionState?: Partial<DiscussionState>;
    disablePolling?: boolean;
}

export const DayPhase: React.FC<DayPhaseProps> = React.memo(({
    isNightTransition, delaySeconds, hideActions, initialDiscussionState, disablePolling
}) => {
    const {
        gameState, currentRoomId, myPlayer, startVotingOnChain, voteOnChain,
        forcePhaseTimeoutOnChain, addLog, isTxPending, selectedTarget,
        setSelectedTarget, isTestMode, setVoteMap, runtimeContractAddress,
        showVotingResults
    } = useGameContext();

    const { chainId, address } = useAccount();
    const { playVoteSound, playVotingStart } = useSoundEffects();
    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    const [voteState, setVoteState] = useState({ myVote: null as string | null, voteCounts: new Map<string, number>(), hasVoted: false });
    const [isProcessing, setIsProcessing] = useState(false);
    const [discussionState, setDiscussionState] = useState<Partial<DiscussionState> | null>(initialDiscussionState || null);
    const [smoothTimeRemaining, setSmoothTimeRemaining] = useState<number>(0);

    const isVotingPhase = gameState.phase === GamePhase.VOTING;
    const isDayPhase = gameState.phase === GamePhase.DAY;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const currentSpeaker = discussionState?.currentSpeakerAddress ? gameState.players.find(p => p.address.toLowerCase() === discussionState.currentSpeakerAddress?.toLowerCase()) : null;

    const lastLoggedPhase = useRef<GamePhase | null>(null);
    const lastSpeakerRef = useRef<string | null>(null);
    const discussionStartedRef = useRef(false);
    const votingTimeoutRef = useRef(false);
    const latestDayCountRef = useRef(gameState.dayCount);
    const dayTimeoutRef = useRef(false);
    const votingStartedRef = useRef(false);
    const [votingAttemptTs, setVotingAttemptTs] = useState<number>(0);

    const lastServerTimeRef = useRef<number>(0);
    const lastUpdateTsRef = useRef<number>(0);

    useEffect(() => { latestDayCountRef.current = gameState.dayCount; }, [gameState.dayCount]);

    // ── Voting logic ──
    const handleStartVoting = useCallback(async () => {
        setIsProcessing(true);
        try { await startVotingOnChain(); }
        catch (e) {
            addLog("Failed to start voting on-chain.", "danger");
            votingStartedRef.current = false;
        } finally { setIsProcessing(false); }
    }, [startVotingOnChain, addLog]);

    // ── Voting Automated Transition logic (Waterfall) ──
    const { finalizeVotingOnChain } = useGameContext();

    useEffect(() => {
        if (!isVotingPhase || isTestMode) return;
        const deadline = gameState.phaseDeadline;
        if (!deadline || deadline === 0) return;

        const check = async () => {
            if (votingTimeoutRef.current) return;

            const now = Math.floor(Date.now() / 1000);
            const past = now - deadline;
            const sorted = [...gameState.players].filter(p => p.isAlive).sort((a,b) => a.address.localeCompare(b.address));
            const myIdx = sorted.findIndex(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());
            
            // If I'm not alive/found, I shouldn't trigger
            if (myIdx === -1) return;

            // Wait 5s buffer + 5s per player index
            const myTriggerTime = (5 + myIdx * 5);

            // LOG FOR DEBUGGING
            if (past > 0 && past % 10 === 0) {
                 console.log(`[Voting Waterfall] Check: Past deadline ${past}s, Need ${myTriggerTime}s. Index: ${myIdx}, isTxPending: ${isTxPending}`);
            }

            if (past >= myTriggerTime) {
                // FORCE OVERRIDE: If we're past deadline + trigger by more than 10s, ignore local pending flag (stuck case)
                if (isTxPending && past < (myTriggerTime + 10)) {
                    return;
                }

                votingTimeoutRef.current = true;
                addLog(`Voting results ready. Transitioning to night...`, "warning");
                
                // Use finalizeVotingOnChain if possible, otherwise generic timeout fallback
                try {
                    await finalizeVotingOnChain();
                } catch (err) {
                    console.error('[VotingWaterfall] Finalize failed, trying forcePhase:', err);
                    forcePhaseTimeoutOnChain().catch(() => {
                        // On failure, allow retry in 10s
                        setTimeout(() => { votingTimeoutRef.current = false; }, 10000);
                    });
                }
            }
        };
        const iv = setInterval(check, 2000);
        return () => clearInterval(iv);
    }, [isVotingPhase, gameState.phaseDeadline, gameState.players, myPlayer?.address, isTestMode, finalizeVotingOnChain, forcePhaseTimeoutOnChain, addLog, isTxPending]);

    // ── Discussion logic ──
    const fetchDiscussionState = useCallback(async () => {
        if (!currentRoomId) return;
        const curDay = latestDayCountRef.current;
        try {
            const res = await fetch(`/api/game/discussion?roomId=${currentRoomId}&dayCount=${curDay}&playerAddress=${myPlayer?.address || ''}&chainId=${chainId || ''}&t=${Date.now()}`);
            const data = await res.json();
            if (latestDayCountRef.current === curDay) {
                setDiscussionState(data);
                if (data.timeRemaining !== undefined && data.timeRemaining !== lastServerTimeRef.current) {
                    lastServerTimeRef.current = data.timeRemaining;
                    lastUpdateTsRef.current = Date.now();
                    setSmoothTimeRemaining(data.timeRemaining);
                }
            }
        } catch (e) { console.error(e); }
    }, [currentRoomId, myPlayer?.address, chainId]);

    const startDiscussion = useCallback(async () => {
        if (!currentRoomId || discussionStartedRef.current) return;
        discussionStartedRef.current = true;
        try {
            if (!isTestMode) {
                const actor = myPlayer?.address;
                if (!actor) throw new Error('No address');
                const signed = await signRequest({
                    address: actor, roomId: Number(currentRoomId), walletClient,
                    buildMessage: ({ nonce, timestamp }) => buildDiscussionMessage({ roomId: currentRoomId.toString(), dayCount: gameState.dayCount, action: 'start', nonce, timestamp, chainId })
                });
                await fetch('/api/game/discussion', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId: currentRoomId.toString(), dayCount: gameState.dayCount, action: 'start', playerAddress: actor, signature: signed.signature, signerAddress: signed.signerAddress, nonce: signed.nonce, timestamp: signed.timestamp, chainId })
                });
            } else setDiscussionState({ active: true, finished: false, phase: 'speaking', currentSpeakerAddress: gameState.players[0]?.address, timeRemaining: 60 });
            addLog("Discussion Phase started.", "info");
        } catch (e) { discussionStartedRef.current = false; }
    }, [currentRoomId, myPlayer?.address, addLog, isTestMode, gameState.dayCount, gameState.players, walletClient, chainId]);

    const skipSpeech = useCallback(async () => {
        if (!currentRoomId || !myPlayer?.address) return;
        setIsProcessing(true);
        try {
            const signed = await signRequest({
                address: myPlayer.address, roomId: Number(currentRoomId), walletClient,
                buildMessage: ({ nonce, timestamp }) => buildDiscussionMessage({ roomId: currentRoomId.toString(), dayCount: gameState.dayCount, action: 'skip', nonce, timestamp, chainId })
            });
            await fetch('/api/game/discussion', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: currentRoomId.toString(), dayCount: gameState.dayCount, action: 'skip', playerAddress: myPlayer.address, signature: signed.signature, signerAddress: signed.signerAddress, nonce: signed.nonce, timestamp: signed.timestamp, chainId })
            });
            await fetchDiscussionState();
        } catch (e) { console.error(e); } finally { setIsProcessing(false); }
    }, [currentRoomId, myPlayer?.address, gameState.dayCount, walletClient, chainId, fetchDiscussionState]);

    // ── Effects ──
    useEffect(() => {
        if (isDayPhase && discussionState?.active && discussionState.currentSpeakerAddress !== lastSpeakerRef.current) {
            const spk = gameState.players.find(p => p.address.toLowerCase() === discussionState.currentSpeakerAddress?.toLowerCase());
            if (spk) addLog(`${spk.name} is now speaking.`, "info");
            lastSpeakerRef.current = discussionState.currentSpeakerAddress || null;
        }
    }, [isDayPhase, discussionState?.active, discussionState?.currentSpeakerAddress, gameState.players, addLog]);

    useEffect(() => {
        if (gameState.phase !== lastLoggedPhase.current) {
            if (isDayPhase) { discussionStartedRef.current = false; setDiscussionState(null); addLog("Day Phase started.", "info"); }
            else if (isVotingPhase) { playVotingStart(); addLog("Voting Phase started.", "warning"); }
            lastLoggedPhase.current = gameState.phase;
        }
    }, [gameState.phase, isDayPhase, isVotingPhase, addLog, playVotingStart]);

    useEffect(() => {
        if (!isDayPhase || discussionState?.active || discussionStartedRef.current) return;
        const sorted = [...gameState.players].filter(p => p.isAlive).sort((a,b) => a.address.localeCompare(b.address));
        const myIdx = sorted.findIndex(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());
        if (myIdx === -1) return;
        const timer = setTimeout(startDiscussion, myIdx * 3000);
        return () => clearTimeout(timer);
    }, [isDayPhase, discussionState?.active, gameState.players, myPlayer?.address, startDiscussion]);

    useEffect(() => {
        if (!isDayPhase || !currentRoomId || disablePolling || discussionState?.finished) return;
        const poll = async () => {
            if (!isDayPhase || !currentRoomId) return;
            await fetchDiscussionState();
            if (!isDayPhase || !currentRoomId || discussionState?.finished) return;
            setTimeout(poll, (document.hidden ? 10000 : 1500));
        };
        poll();
    }, [isDayPhase, currentRoomId, fetchDiscussionState, discussionState?.finished, disablePolling]);

    useEffect(() => {
        if (!discussionState?.active || discussionState?.finished) return;
        const iv = setInterval(() => {
            const elapsed = Math.floor((Date.now() - lastUpdateTsRef.current) / 1000);
            setSmoothTimeRemaining(Math.max(0, lastServerTimeRef.current - elapsed));
        }, 300);
        return () => clearInterval(iv);
    }, [discussionState?.active, discussionState?.finished]);

    useEffect(() => {
        if (!isDayPhase || isTestMode || votingStartedRef.current || !gameState.phaseDeadline) return;
        const sorted = [...gameState.players].filter(p => p.isAlive).sort((a,b) => a.address.localeCompare(b.address));
        const myIdx = sorted.findIndex(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());
        if (myIdx === -1) return;
        const check = () => {
            if (dayTimeoutRef.current || votingStartedRef.current || !isDayPhase) return;
            if ((Math.floor(Date.now() / 1000) - gameState.phaseDeadline) >= (5 + myIdx * 5)) {
                dayTimeoutRef.current = true; votingStartedRef.current = true;
                addLog('Day timeout. Starting vote...', 'warning');
                handleStartVoting().catch(() => { dayTimeoutRef.current = false; votingStartedRef.current = false; });
            }
        };
        const iv = setInterval(check, 2000);
        return () => clearInterval(iv);
    }, [isDayPhase, gameState.phaseDeadline, gameState.players, myPlayer?.address, isTestMode, handleStartVoting, addLog]);

    useEffect(() => {
        const sorted = [...gameState.players].filter(p => p.isAlive).sort((a,b) => a.address.localeCompare(b.address));
        const myIdx = sorted.findIndex(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());
        if (discussionState?.finished && isDayPhase && !votingStartedRef.current && myIdx !== -1) {
            const timer = setTimeout(async () => {
                if (!discussionState?.finished || !isDayPhase || votingStartedRef.current) return;
                votingStartedRef.current = true;
                addLog("Discussion finished. Starting vote...", "warning");
                handleStartVoting();
            }, myIdx * 3000 + 1000);
            return () => clearTimeout(timer);
        }
    }, [discussionState?.finished, isDayPhase, gameState.players, myPlayer?.address, addLog, handleStartVoting]);

    const handleVote = async () => {
        if (!selectedTarget || !address || !currentRoomId) return;
        playVoteSound();
        const prev = { v: voteState.myVote, h: voteState.hasVoted, t: selectedTarget };
        setVoteState(p => ({ ...p, hasVoted: true, myVote: selectedTarget }));
        setVoteMap(prev => ({ ...prev, [address.toLowerCase()]: selectedTarget.toLowerCase() }));
        setSelectedTarget(null);
        setIsProcessing(true);
        emitGameSignal({ type: 'OPTIMISTIC_VOTE', voter: address.toLowerCase(), target: selectedTarget.toLowerCase(), roomId: currentRoomId.toString() });
        try { await voteOnChain(selectedTarget); }
        catch (e: any) { setVoteState(p => ({ ...p, hasVoted: prev.h, myVote: prev.v })); setSelectedTarget(prev.t); addLog(e.shortMessage || "Vote failed", "danger"); setVoteMap(m => { const nm = {...m}; delete nm[address.toLowerCase()]; return nm; }); }
        finally { setIsProcessing(false); }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-start p-4 md:p-8 pt-5 md:pt-6">
            <div className="max-w-2xl w-full flex flex-col">
                <div className="text-center mb-4 flex-shrink-0 h-[40px] flex items-center justify-center">
                    <h2 
                        className="text-2xl font-['Cinzel'] text-white cursor-pointer hover:text-gold/80 transition-colors"
                        onClick={() => (window as any).refreshGame?.()}
                        title="Click to manual sync"
                    >
                        {hideActions ? 'Voting Results' : isVotingPhase ? 'Elimination Vote' : 'Discussion Phase'}
                    </h2>
                </div>
                <div className="mb-4 h-[360px] flex-shrink-0 w-full rounded-md overflow-hidden border-t border-t-white/10 border-x border-x-white/5 border-b-black bg-[#0A0A0A] shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                    <GameLog liveDiscussion={{ active: discussionState?.active, finished: discussionState?.finished, currentSpeakerName: currentSpeaker?.name || null }} forceVotingActive={isVotingPhase || showVotingResults} />
                </div>
                <div className={`min-h-[140px] flex flex-col justify-start transition-opacity duration-300 ${hideActions ? 'opacity-0 pointer-events-none' : ''}`}>
                    <AnimatePresence mode="wait">
                        {isDayPhase && !isNightTransition ? (
                            <DiscussionSection
                                discussionState={discussionState} isTestMode={isTestMode}
                                smoothTimeRemaining={smoothTimeRemaining} currentSpeaker={currentSpeaker}
                                currentRoomId={currentRoomId} myPlayer={myPlayer}
                                isProcessing={isProcessing} onSkip={skipSpeech}
                            />
                        ) : (isVotingPhase || isNightTransition) ? (
                            <VotingSection
                                isVotingPhase={isVotingPhase} isNightTransition={!!isNightTransition}
                                delaySeconds={delaySeconds} currentRoomId={currentRoomId} myPlayer={myPlayer}
                                isProcessing={isProcessing} isTxPending={isTxPending}
                                voteState={voteState} selectedTarget={selectedTarget}
                                gameState={gameState} onVote={handleVote}
                            />
                        ) : null}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
});

DayPhase.displayName = 'DayPhase';
