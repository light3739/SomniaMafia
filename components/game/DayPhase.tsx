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

interface DayPhaseProps {
    isNightTransition?: boolean;
    delaySeconds?: number;
}

export const DayPhase: React.FC<DayPhaseProps> = React.memo(({ isNightTransition, delaySeconds }) => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        startVotingOnChain,
        voteOnChain,
        forcePhaseTimeoutOnChain,
        addLog,
        isTxPending,
        selectedTarget,
        setSelectedTarget,
        isTestMode
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
        phase: 'initial_delay' | 'speaking' | 'finished';
        currentSpeakerIndex: number;
        currentSpeakerAddress: string | null;
        totalSpeakers: number;
        timeRemaining: number;
        delayDuration?: number;
        isMyTurn: boolean;
    } | null>(null);

    const isVotingPhase = gameState.phase === GamePhase.VOTING;
    const isDayPhase = gameState.phase === GamePhase.DAY;

    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const currentSpeaker = discussionState?.currentSpeakerAddress
        ? gameState.players.find(p => p.address.toLowerCase() === discussionState.currentSpeakerAddress?.toLowerCase())
        : null;

    const lastLoggedPhase = useRef<GamePhase | null>(null);
    const lastSpeakerRef = useRef<string | null>(null);
    const discussionStartedRef = useRef(false);
    const votingTimeoutRef = useRef(false);

    // Voting phase timeout - auto-end voting when timer expires
    useEffect(() => {
        if (!isVotingPhase || isTestMode) return;

        const deadline = gameState.phaseDeadline;
        if (!deadline) return;

        // Only host triggers the timeout
        const isHost = gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase();
        if (!isHost) return;

        // Already triggered
        if (votingTimeoutRef.current) return;

        // Don't trigger if we're in a TX
        if (isProcessing || isTxPending) return;

        const TIMEOUT_BUFFER_SECONDS = 5;

        const checkTimeout = () => {
            const now = Math.floor(Date.now() / 1000);
            const secondsPastDeadline = now - deadline;

            if (secondsPastDeadline >= TIMEOUT_BUFFER_SECONDS) {
                console.log('[DayPhase] Voting timer expired. Host initiating forcePhaseTimeout...');
                votingTimeoutRef.current = true;
                addLog("Voting time expired. Auto-finalizing phase...", "warning");

                forcePhaseTimeoutOnChain().catch(err => {
                    console.error('[DayPhase] forcePhaseTimeout failed:', err);
                    votingTimeoutRef.current = false;
                });
            }
        };

        checkTimeout();
        const interval = setInterval(checkTimeout, 2000);
        return () => clearInterval(interval);
    }, [isVotingPhase, gameState.phaseDeadline, gameState.players, myPlayer?.address, isTestMode, isProcessing, isTxPending, forcePhaseTimeoutOnChain, addLog]);

    // Reset timeout flag when phase changes
    useEffect(() => {
        if (!isVotingPhase) {
            votingTimeoutRef.current = false;
        }
    }, [isVotingPhase]);

    // Логируем начало речи каждого игрока
    useEffect(() => {
        if (isDayPhase && discussionState?.active && discussionState.currentSpeakerAddress) {
            if (discussionState.currentSpeakerAddress !== lastSpeakerRef.current) {
                const speaker = gameState.players.find(p => p.address.toLowerCase() === discussionState.currentSpeakerAddress?.toLowerCase());
                if (speaker) {
                    addLog(`${speaker.name} is now speaking.`, "info");
                }
                lastSpeakerRef.current = discussionState.currentSpeakerAddress;
            }
        }
        if (!isDayPhase) {
            lastSpeakerRef.current = null;
        }
    }, [isDayPhase, discussionState?.active, discussionState?.currentSpeakerAddress, gameState.players, addLog]);

    // Fetch discussion state from backend
    const fetchDiscussionState = useCallback(async () => {
        if (!currentRoomId) return;
        try {
            const response = await fetch(
                `/api/game/discussion?roomId=${currentRoomId}&dayCount=${gameState.dayCount}&playerAddress=${myPlayer?.address || ''}`
            );
            const data = await response.json();
            setDiscussionState(data);
            return data;
        } catch (e) {
            console.error("Failed to fetch discussion state:", e);
            return null;
        }
    }, [currentRoomId, myPlayer?.address, gameState.dayCount]);

    // Start discussion (host only)
    const startDiscussion = useCallback(async () => {
        if (!currentRoomId || discussionStartedRef.current) return;
        discussionStartedRef.current = true;
        try {
            if (!isTestMode) {
                await fetch('/api/game/discussion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: currentRoomId.toString(),
                        dayCount: gameState.dayCount,
                        action: 'start',
                        playerAddress: myPlayer?.address
                    })
                });
            } else {
                // Mock discussion state immediately for test mode
                setDiscussionState({
                    active: true,
                    finished: false,
                    phase: 'speaking',
                    currentSpeakerIndex: 0,
                    currentSpeakerAddress: gameState.players[0]?.address || null,
                    totalSpeakers: gameState.players.filter(p => p.isAlive).length,
                    timeRemaining: 60,
                    isMyTurn: true
                });
            }
            addLog("Discussion Phase started.", "info");
        } catch (e) {
            console.error("Failed to start discussion:", e);
        }
    }, [currentRoomId, myPlayer?.address, addLog, isTestMode, gameState.dayCount, gameState.players]);

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
                    dayCount: gameState.dayCount,
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
    }, [currentRoomId, myPlayer?.address, fetchDiscussionState, gameState.dayCount]);

    // Initial phase log and discussion start
    useEffect(() => {
        if (gameState.phase !== lastLoggedPhase.current) {
            if (isDayPhase) {
                discussionStartedRef.current = false;
                // Host starts discussion
                if (gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase() || isTestMode) {
                    startDiscussion();
                } else {
                    addLog("Day Phase: Discussion starting...", "info");
                }
            } else if (isVotingPhase) {
                playVotingStart(); // Play sound for everyone
                const quorum = Math.floor(alivePlayers.length / 2) + 1;
                const duration = Math.max(0, (gameState.phaseDeadline || 0) - Math.floor(Date.now() / 1000));
                addLog(`Voting Phase Started. Quorum needed: ${quorum}.`, "warning");
            }
            lastLoggedPhase.current = gameState.phase;
        }
    }, [gameState.phase, isDayPhase, isVotingPhase, alivePlayers.length, addLog, gameState.players, myPlayer?.address, startDiscussion, isTestMode, playVotingStart]);

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

    const votingStartedRef = useRef(false);
    const [votingAttemptTs, setVotingAttemptTs] = useState<number>(0);

    // Safety Watchdog: If voting started but phase didn't change in 15s -> Reset
    useEffect(() => {
        if (votingStartedRef.current && votingAttemptTs > 0 && isDayPhase) {
            const timer = setTimeout(() => {
                if (votingStartedRef.current && isDayPhase) {
                    console.warn("[DayPhase] Watchdog: Voting start stuck. Resetting ref.");
                    addLog("Transition stuck. Retrying vote start...", "warning");
                    votingStartedRef.current = false;
                    setVotingAttemptTs(0);
                }
            }, 15000); // 15 seconds timeout
            return () => clearTimeout(timer);
        }
    }, [votingAttemptTs, isDayPhase, addLog]);

    // Handle start voting - defined before useEffect to avoid hoisting issues
    const handleStartVoting = useCallback(async () => {
        console.log('[DayPhase] handleStartVoting called');
        setIsProcessing(true);
        try {
            await startVotingOnChain();
        } catch (e) {
            console.error('[DayPhase] Failed to start voting:', e);
            addLog("Failed to start voting on-chain. Retrying...", "danger");
            votingStartedRef.current = false; // Allow retry on next poll
        } finally {
            setIsProcessing(false);
        }
    }, [startVotingOnChain, addLog]);

    // Auto-transition to voting when discussion finished
    useEffect(() => {
        const isHost = gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase();

        console.log('[DayPhase] Auto-voting check:', {
            finished: discussionState?.finished,
            isDayPhase,
            votingStarted: votingStartedRef.current,
            isHost,
            myAddress: myPlayer?.address,
            hostAddress: gameState.players[0]?.address
        });

        if (discussionState?.finished && isDayPhase && !votingStartedRef.current) {
            // Host triggers voting
            if (isHost) {
                votingStartedRef.current = true;
                setVotingAttemptTs(Date.now());
                console.log('[DayPhase] Host initiating voting transition...');
                addLog("All players have spoken. Starting vote...", "warning");
                const timer = setTimeout(() => {
                    console.log('[DayPhase] Calling handleStartVoting...');
                    handleStartVoting();
                }, 2000); // Small buffer before starting voting
                return () => clearTimeout(timer);
            }
        }

        // Reset the ref if we leave the day phase or discussion is no longer finished
        if (!isDayPhase || !discussionState?.finished) {
            votingStartedRef.current = false;
            setVotingAttemptTs(0);
        }
    }, [discussionState?.finished, isDayPhase, gameState.players, myPlayer?.address, addLog, handleStartVoting]);

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

                {/* Event Feed - Restored height */}
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
                        {/* Night Transition Delay UI */}


                        {/* Discussion Phase UI */}
                        {isDayPhase && !isNightTransition && (
                            <motion.div
                                key="day-actions"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="w-full space-y-3"
                            >
                                {discussionState?.active ? (
                                    <>
                                        {/* Timer Display (Handles both Delay and Speaking phases) */}
                                        <div className="w-full py-1 text-center bg-[#916A47]/5 rounded-xl border border-[#916A47]/20">
                                            {discussionState?.phase === 'initial_delay' ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <Clock className="w-4 h-4 text-[#916A47]" />
                                                    <span className="text-xl font-bold text-white tabular-nums">
                                                        {discussionState?.timeRemaining}s
                                                    </span>
                                                    <span className="text-[#916A47]/50 text-[10px] uppercase font-bold tracking-widest ml-2">
                                                        Starting Discussion...
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2">
                                                    <Clock className="w-4 h-4 text-[#916A47]" />
                                                    <span className="text-xl font-bold text-white tabular-nums">
                                                        {Math.floor((discussionState?.timeRemaining || 0) / 60)}:{String((discussionState?.timeRemaining || 0) % 60).padStart(2, '0')}
                                                    </span>
                                                    <span className="text-[#916A47]/50 text-[10px] uppercase font-bold tracking-widest ml-2">
                                                        {discussionState?.isMyTurn ? 'Your Speech' : `${currentSpeaker?.name || 'Player'} Speaking`}
                                                    </span>
                                                </div>
                                            )}
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
                                                className="w-full h-[44px] mt-2 bg-amber-900/30 hover:bg-amber-900/50 border-amber-500/30 text-amber-200"
                                            >
                                                <ChevronRight className="w-5 h-5 mr-2" />
                                                Force Skip (Host)
                                            </Button>
                                        )}
                                    </>
                                ) : discussionState?.finished ? (
                                    <div className="w-full py-3 text-center bg-[#916A47]/5 rounded-xl border border-[#916A47]/20">
                                        <p className="text-[#916A47] font-bold text-base animate-pulse">
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

                        {/* Voting Phase OR Night Transition (Both share the same slot) */}
                        {(isVotingPhase || isNightTransition) && (
                            <motion.div
                                key="voting-actions"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-3"
                            >
                                {isNightTransition ? (
                                    // Night Transition Delay UI (Replaces Timer & Buttons)
                                    <motion.div
                                        key="transition-timer"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="w-full py-4 text-center bg-indigo-950/40 rounded-xl border border-indigo-500/30 backdrop-blur-sm"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-indigo-400 animate-pulse" />
                                                <span className="text-2xl font-bold text-indigo-100 tabular-nums">
                                                    {delaySeconds}s
                                                </span>
                                            </div>
                                            <p className="text-indigo-300/70 text-sm uppercase font-bold tracking-widest">
                                                Night Phase Starting...
                                            </p>
                                            <p className="text-white/50 text-xs mt-1">
                                                Check game logs for results
                                            </p>
                                        </div>
                                    </motion.div>
                                ) : (
                                    // Standard Voting UI
                                    <>
                                        {/* Voting Timer */}
                                        <VotingTimer />

                                        <Button
                                            onClick={handleVote}
                                            data-custom-sound
                                            isLoading={isProcessing || isTxPending}
                                            disabled={!selectedTarget || isProcessing || isTxPending || voteState.hasVoted}
                                            variant={selectedTarget ? 'primary' : 'outline-gold'}
                                            className="w-full h-[60px] text-lg"
                                        >
                                            {selectedTarget ? (
                                                <>
                                                    Vote for {gameState.players.find(p => p.address.toLowerCase() === selectedTarget.toLowerCase())?.name}
                                                </>
                                            ) : voteState.hasVoted ? (
                                                <>
                                                    Vote Committed
                                                </>
                                            ) : (
                                                'Select a target on the board'
                                            )}
                                        </Button>
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div >
        </div >
    );
});

/**
 * VotingTimer component - shows countdown timer during voting phase
 * Implements "Soft Deadline" logic (1 minute target vs 3 minute contract limit)
 */
const VotingTimer: React.FC = React.memo(() => {
    const { gameState, myPlayer, voteOnChain, addLog } = useGameContext();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [timerMode, setTimerMode] = useState<'soft' | 'transition' | 'hard'>('soft');
    const hasAutoVotedRef = useRef(false);

    // Contract: 180s (3m). Target: 60s (1m). Buffer: 120s.
    const BUFFER = 120;

    useEffect(() => {
        if (!gameState.phaseDeadline) return;

        const tick = () => {
            const now = Math.floor(Date.now() / 1000);
            const realRemaining = Math.max(0, gameState.phaseDeadline! - now);
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

                    if (!hasAutoVotedRef.current && myPlayer && !myPlayer.hasVoted && myPlayer.isAlive) {
                        hasAutoVotedRef.current = true;
                        addLog("1 minute limit reached. Auto-voting for self...", "warning");
                        voteOnChain(myPlayer.address as `0x${string}`).catch(e => {
                            console.error("[AutoVote] Failed:", e);
                            addLog("Auto-vote failed. Please vote manually!", "danger");
                        });
                    }
                } else {
                    // --- PHASE 3: HARD TIMER (Remaining ~115s) ---
                    // If game is still going, show real contract time
                    setTimeLeft(realRemaining);
                    setTimerMode('hard');

                    // LATE JOINER PROTECTION: Auto-vote if in Hard Mode
                    if (!hasAutoVotedRef.current && myPlayer && !myPlayer.hasVoted && myPlayer.isAlive) {
                        hasAutoVotedRef.current = true;
                        addLog("Late join during hard timer. Auto-voting for self...", "warning");
                        voteOnChain(myPlayer.address as `0x${string}`).catch(e => {
                            console.error("[AutoVote] Failed:", e);
                            addLog("Auto-vote failed.", "danger");
                        });
                    }
                }
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [gameState.phaseDeadline, myPlayer, myPlayer?.hasVoted, voteOnChain, addLog]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    // Visual styles based on mode
    // Soft: Normal -> Red at end
    // Transition: Pulsing 0:00
    // Hard: Orange/Red indicating long wait
    const isUrgent = (timerMode === 'soft' && timeLeft <= 10) || timerMode === 'transition';
    const isHardWait = timerMode === 'hard';

    return (
        <div className={`w-full py-2 text-center rounded-xl border transition-colors duration-500
            ${isUrgent ? 'bg-rose-950/30 border-rose-500/50' :
                isHardWait ? 'bg-orange-950/20 border-orange-500/30' :
                    'bg-[#916A47]/10 border-[#916A47]/30'}`}>

            <div className="flex items-center justify-center gap-2">
                <Clock className={`w-4 h-4 ${isUrgent ? 'text-rose-400' : isHardWait ? 'text-orange-400' : 'text-[#916A47]'}`} />
                <span className={`text-2xl font-bold tabular-nums 
                    ${isUrgent ? 'text-rose-400 animate-pulse' : isHardWait ? 'text-orange-400' : 'text-white'}`}>
                    {minutes}:{String(seconds).padStart(2, '0')}
                </span>
                <span className={`text-[10px] uppercase font-bold tracking-widest ml-2 
                    ${isUrgent ? 'text-rose-400/70' : isHardWait ? 'text-orange-400/70' : 'text-[#916A47]/50'}`}>
                    {timerMode === 'soft' ? 'Voting Time' :
                        timerMode === 'transition' ? 'Auto-Voting...' : 'Waiting for AFK'}
                </span>
            </div>

            {timerMode === 'hard' && (
                <div className="text-[10px] text-orange-300/50 mt-1 animate-pulse">
                    Some players are AFK. Waiting full timeout...
                </div>
            )}
        </div>
    );
});
