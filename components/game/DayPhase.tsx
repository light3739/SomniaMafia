// components/game/DayPhase.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSoundEffects } from '../ui/SoundEffects';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { GamePhase, Player } from '../../types';
import { Button } from '../ui/Button';
import { Sun, Vote, Check, Clock, User, Skull, Mic, MicOff, ChevronRight } from 'lucide-react';
import { GameLog } from './GameLog';

interface VoteState {
    myVote: string | null;
    voteCounts: Map<string, number>;
    hasVoted: boolean;
}

export const DayPhase: React.FC = React.memo(() => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        startVotingOnChain,
        voteOnChain,
        addLog,
        isTxPending,
        selectedTarget,
        setSelectedTarget,
    } = useGameContext();
    const {
        playClickSound,
        playTypeSound,
        playVoteSound,
        playProposeSound,
        playApproveSound,
        playRejectSound,
        playVotingStart // New sound function
    } = useSoundEffects();

    const publicClient = usePublicClient();
    const [voteState, setVoteState] = useState<VoteState>({
        myVote: null,
        voteCounts: new Map(),
        hasVoted: false
    });
    const [isProcessing, setIsProcessing] = useState(false);

    // Discussion Speech Logic (synced with backend)
    const [discussionState, setDiscussionState] = useState<{
        active: boolean;
        finished: boolean;
        currentSpeakerIndex: number;
        currentSpeakerAddress: string | null;
        totalSpeakers: number;
        timeRemaining: number;
        isMyTurn: boolean;
    } | null>(null);

    const isVotingPhase = gameState.phase === GamePhase.VOTING;
    const isDayPhase = gameState.phase === GamePhase.DAY;

    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const currentSpeaker = discussionState?.currentSpeakerAddress
        ? gameState.players.find(p => p.address.toLowerCase() === discussionState.currentSpeakerAddress?.toLowerCase())
        : null;

    const lastLoggedPhase = useRef<GamePhase | null>(null);
    const discussionStartedRef = useRef(false);

    // Fetch discussion state from backend
    const fetchDiscussionState = useCallback(async () => {
        if (!currentRoomId) return;
        try {
            const response = await fetch(
                `/api/game/discussion?roomId=${currentRoomId}&playerAddress=${myPlayer?.address || ''}`
            );
            const data = await response.json();
            setDiscussionState(data);
            return data;
        } catch (e) {
            console.error("Failed to fetch discussion state:", e);
            return null;
        }
    }, [currentRoomId, myPlayer?.address]);

    // Start discussion (host only)
    const startDiscussion = useCallback(async () => {
        if (!currentRoomId || discussionStartedRef.current) return;
        discussionStartedRef.current = true;
        try {
            await fetch('/api/game/discussion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: currentRoomId.toString(),
                    action: 'start',
                    playerAddress: myPlayer?.address
                })
            });
            addLog("Discussion Phase: Players speak in turns (60s each).", "info");
        } catch (e) {
            console.error("Failed to start discussion:", e);
        }
    }, [currentRoomId, myPlayer?.address, addLog]);

    // Skip speech (current speaker only)
    const skipSpeech = useCallback(async () => {
        if (!currentRoomId) return;
        setIsProcessing(true);
        try {
            await fetch('/api/game/discussion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: currentRoomId.toString(),
                    action: 'skip',
                    playerAddress: myPlayer?.address
                })
            });
            await fetchDiscussionState();
        } catch (e) {
            console.error("Failed to skip speech:", e);
        } finally {
            setIsProcessing(false);
        }
    }, [currentRoomId, myPlayer?.address, fetchDiscussionState]);

    // Initial phase log and discussion start
    useEffect(() => {
        if (gameState.phase !== lastLoggedPhase.current) {
            if (isDayPhase) {
                discussionStartedRef.current = false;
                // Host starts discussion
                if (gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase()) {
                    startDiscussion();
                } else {
                    addLog("Day Phase: Discussion starting...", "info");
                }
            } else if (isVotingPhase) {
                playVotingStart(); // Play sound for everyone
                const quorum = Math.floor(alivePlayers.length / 2) + 1;
                addLog(`Voting Phase Started. Quorum needed: ${quorum}.`, "warning");
            }
            lastLoggedPhase.current = gameState.phase;
        }
    }, [gameState.phase, isDayPhase, isVotingPhase, alivePlayers.length, addLog, gameState.players, myPlayer?.address, startDiscussion]);

    // Poll discussion state
    // Poll discussion state (Adaptive)
    useEffect(() => {
        if (!isDayPhase || !currentRoomId) return;
        if (discussionState?.finished) return; // Stop polling if finished

        let timeoutId: NodeJS.Timeout;

        const poll = async () => {
            await fetchDiscussionState();
            // Adaptive delay: 1.5s if visible, 10s if hidden background tab
            const delay = typeof document !== 'undefined' && document.hidden ? 10000 : 1500;
            timeoutId = setTimeout(poll, delay);
        };

        poll();

        // Handle visibility change to resume fast polling immediately
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                clearTimeout(timeoutId);
                poll();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isDayPhase, currentRoomId, fetchDiscussionState, discussionState?.finished]);

    // Auto-transition to voting when discussion finished
    useEffect(() => {
        if (discussionState?.finished && isDayPhase) {
            // Host triggers voting
            if (gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase()) {
                addLog("All players have spoken. Starting vote...", "warning");
                setTimeout(() => {
                    handleStartVoting();
                }, 2000);
            }
        }
    }, [discussionState?.finished, isDayPhase, gameState.players, myPlayer?.address, addLog]);

    // Voting Logic (Polling)
    const fetchVoteCounts = useCallback(async () => {
        if (!publicClient || !currentRoomId) return;
        try {
            const counts = new Map<string, number>();
            for (const player of gameState.players) {
                if (!player.isAlive) continue;
                const count = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'voteCounts',
                    args: [BigInt(String(currentRoomId || 0)), player.address as `0x${string}`],
                }) as unknown as bigint;
                counts.set(player.address.toLowerCase(), Number(count));
            }
            if (isProcessing || isTxPending) return;
            if (myPlayer) {
                const myVote = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'votes',
                    args: [BigInt(String(currentRoomId || 0)), myPlayer.address as `0x${string}`],
                }) as `0x${string}`;
                const hasVoted = myVote !== '0x0000000000000000000000000000000000000000';
                setVoteState(prev => ({
                    ...prev,
                    voteCounts: counts,
                    myVote: (hasVoted ? myVote : null) || prev.myVote,
                    hasVoted: prev.hasVoted || hasVoted
                }));
            }
        } catch (e) {
            console.error("Failed to fetch votes:", e);
        }
    }, [publicClient, currentRoomId, gameState.players, myPlayer, isProcessing, isTxPending]);

    useEffect(() => {
        if (isVotingPhase) {
            fetchVoteCounts();
            const interval = setInterval(fetchVoteCounts, 3000);
            return () => clearInterval(interval);
        }
    }, [fetchVoteCounts, isVotingPhase]);

    const handleStartVoting = async () => {
        setIsProcessing(true);
        try {
            await startVotingOnChain();
        } catch (e) {
            addLog("Failed to start voting on-chain", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleVote = async () => {
        if (!selectedTarget) return;
        playVoteSound();
        const prevVote = voteState.myVote;
        const prevHasVoted = voteState.hasVoted;
        setVoteState(prev => ({ ...prev, hasVoted: true, myVote: selectedTarget }));
        setSelectedTarget(null);
        setIsProcessing(true);
        try {
            await voteOnChain(selectedTarget);
        } catch (e: any) {
            setVoteState(prev => ({ ...prev, hasVoted: prevHasVoted, myVote: prevVote }));
            addLog(e.shortMessage || "Vote failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl w-full"
            >
                {/* Header */}
                <div className="text-center mb-4">
                    <h2 className="text-2xl font-['Playfair_Display'] text-white">
                        {isVotingPhase ? 'Elimination Vote' : 'Discussion Phase'}
                    </h2>
                    {isDayPhase && discussionState?.active && (
                        <div className="flex items-center justify-center gap-2 mt-1 text-[#916A47] text-sm font-medium">
                            <User className="w-4 h-4" />
                            <span>Speaker {(discussionState?.currentSpeakerIndex || 0) + 1}/{discussionState?.totalSpeakers || alivePlayers.length}: {currentSpeaker?.name}</span>
                        </div>
                    )}
                </div>

                {/* Event Feed - Larger height */}
                <div className="mb-4 h-[360px] w-full rounded-2xl overflow-hidden border border-[#916A47]/20 bg-black/40 backdrop-blur-sm relative">
                    <div className="absolute top-2 right-3 z-10 flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-[#916A47]/40" />
                        <div className="w-1 h-1 rounded-full bg-[#916A47]/20" />
                    </div>
                    <GameLog />
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <AnimatePresence mode="wait">
                        {/* Discussion Phase UI */}
                        {isDayPhase && (
                            <motion.div
                                key="day-actions"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="w-full space-y-3"
                            >
                                {discussionState?.active ? (
                                    <>
                                        {/* Timer display */}
                                        <div className="w-full py-4 text-center bg-[#916A47]/5 rounded-xl border border-[#916A47]/20">
                                            <div className="flex items-center justify-center gap-3">
                                                <Clock className="w-6 h-6 text-[#916A47]" />
                                                <span className="text-3xl font-bold text-white tabular-nums">
                                                    {Math.floor((discussionState?.timeRemaining || 0) / 60)}:{String((discussionState?.timeRemaining || 0) % 60).padStart(2, '0')}
                                                </span>
                                            </div>
                                            <p className="text-[#916A47]/70 text-sm mt-1">
                                                {discussionState?.isMyTurn ? '🎙️ Your turn to speak!' : `${currentSpeaker?.name || 'Player'} is speaking...`}
                                            </p>
                                        </div>

                                        {/* Skip button (only for current speaker) */}
                                        {discussionState?.isMyTurn && (
                                            <Button
                                                onClick={skipSpeech}
                                                disabled={isProcessing}
                                                isLoading={isProcessing}
                                                variant="outline-gold"
                                                className="w-full h-[50px]"
                                            >
                                                <ChevronRight className="w-5 h-5 mr-2" />
                                                Finish Speech Early
                                            </Button>
                                        )}

                                        {/* Host Force Skip (if not speaker) */}
                                        {!discussionState?.isMyTurn && gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase() && (
                                            <Button
                                                onClick={skipSpeech}
                                                disabled={isProcessing}
                                                isLoading={isProcessing}
                                                variant="secondary"
                                                className="w-full h-[50px] mt-2 bg-red-900/40 hover:bg-red-900/60 border-red-500/30 text-red-200"
                                            >
                                                <ChevronRight className="w-5 h-5 mr-2" />
                                                Force Skip (Host)
                                            </Button>
                                        )}
                                    </>
                                ) : discussionState?.finished ? (
                                    <div className="w-full py-6 text-center bg-[#916A47]/5 rounded-xl border border-[#916A47]/20">
                                        <p className="text-[#916A47] font-bold text-xl animate-pulse">
                                            Starting Vote...
                                        </p>
                                    </div>
                                ) : (
                                    <div className="w-full py-6 text-center bg-[#916A47]/5 rounded-xl border border-[#916A47]/20">
                                        <p className="text-[#916A47] font-medium text-lg animate-pulse">
                                            Waiting for discussion to start...
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {isVotingPhase && (
                            <motion.div
                                key="voting-actions"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-3"
                            >
                                <Button
                                    onClick={handleVote}
                                    data-custom-sound
                                    isLoading={isProcessing || isTxPending}
                                    disabled={!selectedTarget || isProcessing || isTxPending}
                                    variant={selectedTarget ? 'primary' : 'outline-gold'}
                                    className="w-full h-[60px] text-lg"
                                >
                                    {selectedTarget ? (
                                        <>
                                            <Vote className="w-6 h-6 mr-2" />
                                            Vote for {gameState.players.find(p => p.address.toLowerCase() === selectedTarget.toLowerCase())?.name}
                                        </>
                                    ) : voteState.hasVoted ? (
                                        <>
                                            <Check className="w-6 h-6 mr-2" />
                                            Vote Committed
                                        </>
                                    ) : (
                                        'Select a target on the board'
                                    )}
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
});
