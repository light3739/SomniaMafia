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

    // Discussion Speech Logic
    const [speakerIndex, setSpeakerIndex] = useState(0);
    const [speechTimeLeft, setSpeechTimeLeft] = useState(60);
    const [isSpeechActive, setIsSpeechActive] = useState(false);
    const [isCountingDown, setIsCountingDown] = useState(false);

    const isVotingPhase = gameState.phase === GamePhase.VOTING;
    const isDayPhase = gameState.phase === GamePhase.DAY;

    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const currentSpeaker = alivePlayers[speakerIndex];
    const isMyTurnToSpeak = currentSpeaker?.address.toLowerCase() === myPlayer?.address.toLowerCase();

    const lastLoggedPhase = useRef<GamePhase | null>(null);

    // Initial phase log
    useEffect(() => {
        if (gameState.phase !== lastLoggedPhase.current) {
            if (isDayPhase) {
                // TEMPORARILY DISABLED: Speech phase - skip directly to voting
                // addLog("Discussion Phase: Players will take turns to speak (60s each).", "info");
                // setSpeakerIndex(0);
                // setSpeechTimeLeft(60);
                // setIsSpeechActive(false);
                // setIsCountingDown(false);

                // Auto-start voting when day begins (host triggers)
                if (gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase()) {
                    addLog("Day Phase: Starting vote...", "info");
                    // Small delay to let UI render
                    setTimeout(() => {
                        handleStartVoting();
                    }, 1000);
                } else {
                    addLog("Day Phase: Waiting for vote to start...", "info");
                }
            } else if (isVotingPhase) {
                playVotingStart(); // Play sound for everyone
                const quorum = Math.floor(alivePlayers.length / 2) + 1;
                addLog(`Voting Phase Started. Quorum needed: ${quorum}.`, "warning");
            }
            lastLoggedPhase.current = gameState.phase;
        }
    }, [gameState.phase, isDayPhase, isVotingPhase, alivePlayers.length, addLog, gameState.players, myPlayer?.address]);

    // Speech Timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isDayPhase && isSpeechActive && speechTimeLeft > 0) {
            interval = setInterval(() => {
                setSpeechTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (speechTimeLeft === 0 && isSpeechActive) {
            handleNextSpeaker();
        }
        return () => clearInterval(interval);
    }, [isDayPhase, isSpeechActive, speechTimeLeft]);

    const handleStartSpeech = () => {
        setIsSpeechActive(true);
        const speakerName = currentSpeaker?.name || `Player ${speakerIndex + 1}`;
        addLog(`🎙️ ${speakerName} started their speech.`, "info");
    };

    const handleNextSpeaker = () => {
        setIsSpeechActive(false);
        if (speakerIndex < alivePlayers.length - 1) {
            setSpeakerIndex(prev => prev + 1);
            setSpeechTimeLeft(60);
        } else {
            // All speakers finished
            startFinalCountdown();
        }
    };

    const startFinalCountdown = () => {
        if (isCountingDown) return;
        setIsCountingDown(true);

        addLog("All players have spoken. Voting starts in...", "warning");

        let count = 3;
        const timer = setInterval(() => {
            if (count > 0) {
                addLog(`${count}...`, "warning");
                count--;
            } else {
                clearInterval(timer);
                if (gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase()) {
                    handleStartVoting();
                }
            }
        }, 1000);
    };

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
                    {isDayPhase && !isCountingDown && (
                        <div className="flex items-center justify-center gap-2 mt-1 text-[#916A47] text-sm font-medium">
                            <User className="w-4 h-4" />
                            <span>Speaker {speakerIndex + 1}/{alivePlayers.length}: {currentSpeaker?.name}</span>
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
                        {/* TEMPORARILY DISABLED: Speech phase UI - day now starts directly with voting */}
                        {isDayPhase && (
                            <motion.div
                                key="day-actions"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="w-full"
                            >
                                <div className="w-full py-6 text-center bg-[#916A47]/5 rounded-xl border border-[#916A47]/20">
                                    <p className="text-[#916A47] font-bold text-xl animate-pulse">
                                        Starting Vote...
                                    </p>
                                </div>
                            </motion.div>
                        )}
                        {/* END DISABLED SPEECH UI */}

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
