// components/game/ShufflePhase.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { usePublicClient, useWriteContract } from 'wagmi';
import { MAFIA_ABI } from '../../contracts/config';
import { Loader2, Check, Clock, Shuffle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface ShuffleState {
    currentShufflerIndex: number;
    deck: string[];
    isMyTurn: boolean;
    hasCommitted: boolean;
    hasRevealed: boolean;
    pendingDeck: string[] | null;
    pendingSalt: string | null;
    phaseDeadline: number; // For timeout handling
}

export const ShufflePhase: React.FC = React.memo(() => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        commitDeckOnChain,
        revealDeckOnChain,
        addLog,
        isTxPending,
        refreshPlayersList,
        runtimeContractAddress
    } = useGameContext();

    const publicClient = usePublicClient();
    const [shuffleState, setShuffleState] = useState<ShuffleState>({
        currentShufflerIndex: 0,
        deck: [],
        isMyTurn: false,
        hasCommitted: false,
        hasRevealed: false,
        pendingDeck: null,
        pendingSalt: null,
        phaseDeadline: 0
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // REF GUARD: Prevents double-launch of handleMyTurn due to React batching delays.
    // React's setState is async, so isProcessing may still be false when the auto-trigger
    // effect re-fires. This synchronous ref is checked immediately.
    const processingRef = useRef(false);
    const autoKickMarkerRef = useRef<string>('');
    // Track last logged deck length to avoid spamming "Loaded deck with N cards" every 1.5s
    const lastLoggedDeckRef = useRef<{ length: number; index: number }>({ length: 0, index: -1 });

    // Состояние для pending deck и salt (для reveal фазы)
    const [pendingDeck, setPendingDeck] = useState<string[] | null>(null);
    const [pendingSalt, setPendingSalt] = useState<string | null>(null);

    const SHUFFLE_COMMIT_KEY = `mafia_shuffle_commit_${currentRoomId}_${myPlayer?.address?.toLowerCase() || ''}`;

    // Restore state from local storage on mount — cross-check with chain flags
    useEffect(() => {
        const saved = localStorage.getItem(SHUFFLE_COMMIT_KEY);
        if (saved) {
            try {
                const { deck, salt, hasCommitted } = JSON.parse(saved);
                if (deck && salt) {
                    setPendingDeck(deck);
                    setPendingSalt(salt);
                    if (hasCommitted) {
                        setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                    } else {
                        // FIX: Cross-check with chain — maybe TX succeeded but localStorage wasn't updated
                        if (publicClient && currentRoomId && myPlayer?.address) {
                            publicClient.readContract({
                                address: runtimeContractAddress,
                                abi: MAFIA_ABI,
                                functionName: 'getPlayerFlags',
                                args: [currentRoomId, myPlayer.address as `0x${string}`],
                            }).then((flags: any) => {
                                // flags[3] = hasCommitted (FLAG_HAS_COMMITTED)
                                const chainCommitted = flags?.[3];
                                if (chainCommitted) {
                                    console.log("[Shuffle Recovery] Chain confirms commit. Promoting to hasCommitted=true.");
                                    localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({ deck, salt, hasCommitted: true }));
                                    setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                                } else {
                                    console.log("Restored pending shuffle state (pre-commit, chain not committed yet)");
                                    setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                                }
                            }).catch(() => {
                                // If chain check fails, fall back to retry mode
                                setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                                console.log("Restored pending shuffle state (chain check failed)");
                            });
                        } else {
                            setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                            console.log("Restored pending shuffle state (pre-commit)");
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to recover pending deck", e);
            }
        }

        // V4 Fix: Restore keys if they exist
        if (currentRoomId && myPlayer) {
            const shuffleService = getShuffleService();
            if (!shuffleService.hasKeys()) {
                shuffleService.loadKeys(currentRoomId.toString(), myPlayer.address);
            }
        }
    }, [SHUFFLE_COMMIT_KEY]);



    // Fetch data from contract
    const fetchShuffleData = useCallback(async () => {
        if (!publicClient || !currentRoomId) return;

        // Skip heavy contract reads while we're mid-commit+reveal. The polling would
        // read stale data (deck not yet updated) and spam logs. Let handleMyTurn finish first.
        if (processingRef.current) return;

        try {
            // 1 & 2 ATOMIC READ: Prevent RPC load balancing caching issues
            const results = await publicClient.multicall({
                contracts: [
                    {
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI as any,
                        functionName: 'getRoom',
                        args: [currentRoomId],
                    },
                    {
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI as any,
                        functionName: 'getDeck',
                        args: [currentRoomId],
                    }
                ],
                allowFailure: true
            });

            const roomDataResult = results[0];
            const deckDataResult = results[1];

            const roomData = roomDataResult.status === 'success' ? (roomDataResult.result as any) : null;
            let deck = deckDataResult.status === 'success' ? (deckDataResult.result as string[]) : [];

            // Парсим индексы
            let currentIndex = 0;
            let revealedCount = 0;
            let deadline = 0;

            if (Array.isArray(roomData)) {
                currentIndex = Number(roomData[8]);
                deadline = Number(roomData[10]);
                revealedCount = Number(roomData[14]);
            } else if (roomData && typeof roomData === 'object') {
                currentIndex = Number(roomData.currentShufflerIndex);
                deadline = Number(roomData.phaseDeadline);
                revealedCount = Number(roomData.revealedCount);
            }

            if (isNaN(currentIndex)) currentIndex = 0;

            if (currentIndex > 0 || revealedCount > 0) {
                // PRIMARY: Multicall result (most reliable - always returns current deck atomically with room data)
                if (deck.length > 0) {
                    // Only log when deck state actually changes to avoid spamming
                    if (lastLoggedDeckRef.current.length !== deck.length || lastLoggedDeckRef.current.index !== currentIndex) {
                        console.log(`[Direct Sync] Loaded deck with ${deck.length} cards (idx=${currentIndex})`);
                        lastLoggedDeckRef.current = { length: deck.length, index: currentIndex };
                    }
                }

                // FALLBACK: Read from DeckRevealed events (10000 blocks ≈ 16 min on Somnia)
                if (deck.length === 0) {
                    try {
                        const currentBlock = await publicClient.getBlockNumber();
                        const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;

                        const logs = await publicClient.getContractEvents({
                            address: runtimeContractAddress,
                            abi: MAFIA_ABI,
                            eventName: 'DeckRevealed',
                            args: { roomId: currentRoomId } as any,
                            fromBlock: fromBlock
                        });

                        if (logs && logs.length > 0) {
                            const lastLog = logs[logs.length - 1];
                            // @ts-expect-error event args are not strongly typed here
                            deck = (lastLog.args as any).deck as string[];
                            console.log(`[Event Sync] Loaded deck with ${deck.length} cards from logs`);
                        }
                    } catch (err) {
                        console.warn("[Event Sync] Events not available either");
                    }
                }
            }

            // Логика определения хода
            const currentShuffler = gameState.players[currentIndex];
            let isMyTurnFromContract = false;
            if (currentShuffler && myPlayer) {
                isMyTurnFromContract = currentShuffler.address.toLowerCase() === myPlayer.address.toLowerCase();
            }

            // Debug: Log shuffle sync state
            if (isMyTurnFromContract || deck.length === 0) {
                console.log(`[Shuffle Sync] idx=${currentIndex}, deck=${deck.length} cards, isMyTurn=${isMyTurnFromContract}, shuffler=${currentShuffler?.name || '?'}`);
            }

            // Если я не первый игрок, но колоды нет — блокируем ход
            if (isMyTurnFromContract && currentIndex > 0 && deck.length === 0) {
                console.warn("[Shuffle Sync] ⚠️ My turn but deck is EMPTY! Blocking until deck syncs.");
                isMyTurnFromContract = false;
            }

            setShuffleState(prev => {
                // STICKY MAX: Never allow index to go backwards
                const safeIndex = Math.max(prev.currentShufflerIndex, currentIndex);

                // If we already revealed locally, don't let RPC overwrite it
                if (prev.hasRevealed) {
                    return { ...prev, currentShufflerIndex: safeIndex, deck: deck.length > 0 ? deck : prev.deck };
                }

                // If we're mid-commit+reveal, don't overwrite local state
                if (prev.hasCommitted) {
                    return { ...prev, currentShufflerIndex: safeIndex, deck: deck.length > 0 ? deck : prev.deck };
                }

                return {
                    ...prev,
                    currentShufflerIndex: safeIndex,
                    deck: deck,
                    isMyTurn: isMyTurnFromContract,
                    phaseDeadline: deadline
                };
            });
        } catch (error) {
            console.error("Shuffle sync error:", error);
        }
    }, [publicClient, currentRoomId, gameState.players, myPlayer]);

    // Force Sync Function
    const forceSync = useCallback(async () => {
        if (!currentRoomId) return;
        setIsSyncing(true);
        try {
            await fetchShuffleData();
            await refreshPlayersList(currentRoomId);
        } finally {
            setIsSyncing(false);
        }
    }, [currentRoomId, fetchShuffleData, refreshPlayersList]);

    // Handle Timeout Kick
    const { writeContractAsync } = useWriteContract();

    const handleTimeoutKick = useCallback(async () => {
        if (!currentRoomId) return;
        setIsProcessing(true);
        try {
            const hash = await writeContractAsync({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'forcePhaseTimeout',
                args: [currentRoomId],
            });
            addLog(`Timeout kick tx sent: ${hash.substring(0, 10)}...`, 'info');
        } catch (err) {
            console.error("Kick failed", err);
            addLog("Failed to kick player", 'danger');
        } finally {
            setIsProcessing(false);
        }
    }, [currentRoomId, writeContractAsync, addLog]);

    // AUTO-UNSTICK: after deadline, one deterministic alive player triggers timeout kick.
    // This keeps shuffle from stalling during demos without spamming duplicate txs.
    useEffect(() => {
        if (!currentRoomId || !myPlayer || !shuffleState.phaseDeadline) return;

        const checkAndKick = () => {
            if (processingRef.current || isProcessing || isTxPending) return;

            const nowSec = Math.floor(Date.now() / 1000);
            const deadline = shuffleState.phaseDeadline;
            const GRACE_SECONDS = 5;

            if (nowSec <= deadline + GRACE_SECONDS) return;

            const aliveSorted = [...gameState.players]
                .filter((p) => p.isAlive)
                .sort((a, b) => a.address.localeCompare(b.address));

            const shouldTrigger =
                aliveSorted.length > 0 &&
                aliveSorted[0].address.toLowerCase() === myPlayer.address.toLowerCase();

            if (!shouldTrigger) return;

            const marker = `${currentRoomId.toString()}:${deadline}`;
            if (autoKickMarkerRef.current === marker) return;
            autoKickMarkerRef.current = marker;

            addLog('Shuffle timeout reached. Auto-kicking stalled turn...', 'warning');
            handleTimeoutKick().catch(() => {
                autoKickMarkerRef.current = '';
            });
        };

        checkAndKick();
        const timer = setInterval(checkAndKick, 2000);
        return () => clearInterval(timer);
    }, [
        currentRoomId,
        myPlayer,
        shuffleState.phaseDeadline,
        gameState.players,
        isProcessing,
        isTxPending,
        handleTimeoutKick,
        addLog,
    ]);

    // Polling
    useEffect(() => {
        fetchShuffleData();
        const interval = setInterval(fetchShuffleData, 1500);
        return () => clearInterval(interval);
    }, [fetchShuffleData]);

    // MUST-HAVE: resync when user returns to tab or regains connection.
    useEffect(() => {
        const handleVisibility = () => {
            if (!document.hidden) {
                fetchShuffleData();
                if (currentRoomId) refreshPlayersList(currentRoomId);
            }
        };

        const handleOnline = () => {
            fetchShuffleData();
            if (currentRoomId) refreshPlayersList(currentRoomId);
            addLog('Connection restored. Syncing shuffle state...', 'info');
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };
    }, [fetchShuffleData, refreshPlayersList, currentRoomId, addLog]);

    // MUST-HAVE: warn before closing tab during own shuffle turn.
    useEffect(() => {
        const shouldWarn =
            shuffleState.isMyTurn &&
            !shuffleState.hasRevealed &&
            !gameState.players.some((p) => p.address.toLowerCase() === myPlayer?.address?.toLowerCase() && !p.isAlive);

        if (!shouldWarn) return;

        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'Your shuffle turn is in progress. Leaving now may stall the game.';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [shuffleState.isMyTurn, shuffleState.hasRevealed, gameState.players, myPlayer?.address]);



    const handleMyTurn = useCallback(async () => {
        // Double-launch guard: check BOTH React state AND synchronous ref.
        // The ref is needed because React batches setState, so isProcessing may still be
        // false when the auto-trigger effect re-fires milliseconds after the first call.
        if (!currentRoomId || !myPlayer || isProcessing || processingRef.current) return;

        processingRef.current = true;
        setIsProcessing(true);
        try {
            const shuffleService = getShuffleService();
            // CRITICAL: Only generate keys if we don't have them yet.
            // If generateKeys() is called again (e.g., due to a re-render or race condition),
            // it overwrites the keys that were already used to encrypt the deck on-chain.
            // This causes all subsequent role decryptions to fail (wrong decryption key → wrong roles).
            if (!shuffleService.hasKeys()) {
                shuffleService.generateKeys();
                console.log("[Shuffle] Generated fresh SRA keys");
            } else {
                console.log("[Shuffle] Reusing existing SRA keys");
            }

            // V4 Fix: Identify Active Slots (Alive players)
            const activeIndices = gameState.players
                .map((p, i) => p.isAlive ? i : -1)
                .filter(i => i !== -1);

            let newDeck: string[];

            if (shuffleState.currentShufflerIndex === 0) {
                // I am the host (first player) - Generate fresh deck
                if (shuffleState.deck.length > 0) {
                    console.warn("Host sees existing deck, resetting...");
                }
                const initialDeck = ShuffleService.generateDistributedDeck(
                    gameState.players.map(p => ({ isAlive: p.isAlive })),
                    currentRoomId?.toString()
                );
                const shuffled = shuffleService.shuffleSubarray(initialDeck, activeIndices);
                newDeck = shuffleService.encryptDeck(shuffled);
            } else {
                // Subsequent player - Shuffle existing deck
                if (shuffleState.deck.length === 0) {
                    throw new Error("Deck is empty! Sync error.");
                }
                const shuffled = shuffleService.shuffleSubarray(shuffleState.deck, activeIndices);
                newDeck = shuffleService.encryptDeck(shuffled);
            }

            const salt = ShuffleService.generateSalt();
            const deckHash = ShuffleService.createDeckCommitHash(newDeck, salt);

            // Save state BEFORE transaction to prevent data loss
            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({
                deck: newDeck, salt: salt, hasCommitted: false
            }));
            shuffleService.saveKeys(currentRoomId.toString(), myPlayer.address);

            // === STEP 1: COMMIT ===
            console.log("[Shuffle] Step 1/2: Committing deck hash...");
            await commitDeckOnChain(deckHash);

            // Update localStorage
            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({
                deck: newDeck, salt: salt, hasCommitted: true
            }));

            setShuffleState(prev => ({
                ...prev,
                hasCommitted: true,
                isMyTurn: true
            }));

            console.log("[Shuffle] Commit success! Waiting 500ms before reveal...");

            // === STEP 2: REVEAL (atomic, no separate effect needed) ===
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log("[Shuffle] Step 2/2: Revealing deck...");
            // Strip 0x prefix if present — keep consistent with new salt format
            await revealDeckOnChain(newDeck, salt);

            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setPendingDeck(null);
            setPendingSalt(null);

            setShuffleState(prev => ({
                ...prev,
                hasRevealed: true,
                currentShufflerIndex: prev.currentShufflerIndex + 1
            }));

            console.log("[Shuffle] ✅ Commit+Reveal complete!");
            setTimeout(fetchShuffleData, 200); // Quick re-fetch after reveal

        } catch (e: any) {
            console.error("[Shuffle] Failed:", e);
            const errMsg = e?.message || e?.toString() || '';
            addLog(errMsg.substring(0, 120) || "Shuffle failed", "danger");

            // If contract reverted (InvalidReveal, PhaseDeadlinePassed, etc.),
            // clear saved state to prevent infinite recovery retry loops
            const isContractRevert = errMsg.includes('reverted') || errMsg.includes('InvalidReveal') ||
                errMsg.includes('PhaseDeadlinePassed') || errMsg.includes('revert');
            if (isContractRevert) {
                console.warn("[Shuffle] Contract revert — clearing saved state to prevent retry loop.");
                localStorage.removeItem(SHUFFLE_COMMIT_KEY);
                setPendingDeck(null);
                setPendingSalt(null);
            }
            // Non-revert errors (network issues) keep saved state for manual recovery via handleReveal
        } finally {
            processingRef.current = false;
            setIsProcessing(false);
        }
    }, [currentRoomId, myPlayer, isProcessing, shuffleState.currentShufflerIndex, shuffleState.deck, gameState.players.length, SHUFFLE_COMMIT_KEY, commitDeckOnChain, revealDeckOnChain, addLog, fetchShuffleData]);

    // Manual reveal — for recovery only (e.g., localStorage restore after page refresh mid-commit)
    const handleReveal = useCallback(async () => {
        if (!currentRoomId || !pendingDeck || !pendingSalt || isProcessing) return;

        setIsProcessing(true);
        try {
            console.log("[Shuffle Recovery] Revealing deck from saved state...");
            await revealDeckOnChain(pendingDeck, pendingSalt);

            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setPendingDeck(null);
            setPendingSalt(null);

            setShuffleState(prev => ({
                ...prev,
                hasRevealed: true,
                currentShufflerIndex: prev.currentShufflerIndex + 1
            }));

            setTimeout(fetchShuffleData, 200);
        } catch (e: any) {
            console.error("Reveal failed:", e);
            addLog(e.message || "Reveal failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    }, [currentRoomId, pendingDeck, pendingSalt, isProcessing, revealDeckOnChain, SHUFFLE_COMMIT_KEY, fetchShuffleData, addLog]);

    const currentShuffler = gameState.players[shuffleState.currentShufflerIndex];
    const totalPlayers = gameState.players.length;
    const progress = Math.min((shuffleState.currentShufflerIndex / totalPlayers) * 100, 100);

    // AUTOMATION: Trigger handleMyTurn automatically if it's my turn
    // handleMyTurn now does BOTH commit + reveal atomically
    useEffect(() => {
        // Check the synchronous ref FIRST to avoid re-triggering while the previous
        // handleMyTurn is still running (setState hasn't flushed isProcessing yet)
        if (processingRef.current) return;

        const canExecuteAuto =
            shuffleState.isMyTurn &&
            !shuffleState.hasCommitted &&
            !isProcessing &&
            !isTxPending &&
            !shuffleState.hasRevealed &&
            gameState.players.length > 0;

        if (canExecuteAuto) {
            console.log("[Shuffle Auto] My turn detected, starting commit+reveal...");
            handleMyTurn();
        }
    }, [shuffleState.isMyTurn, shuffleState.hasCommitted, shuffleState.hasRevealed, isProcessing, isTxPending, gameState.players.length, handleMyTurn]);

    // RECOVERY: Auto-reveal if we have pending commit from localStorage restore
    // (e.g., page was refreshed between commit and reveal)
    useEffect(() => {
        const needsRecoveryReveal =
            shuffleState.isMyTurn &&
            shuffleState.hasCommitted &&
            !shuffleState.hasRevealed &&
            !isProcessing &&
            !isTxPending &&
            pendingDeck &&
            pendingSalt;

        if (needsRecoveryReveal) {
            console.log("[Shuffle Recovery] Found pending commit without reveal, auto-revealing...");
            const timer = setTimeout(() => {
                handleReveal();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [shuffleState.isMyTurn, shuffleState.hasCommitted, shuffleState.hasRevealed, isProcessing, isTxPending, pendingDeck, pendingSalt, handleReveal]);

    return useMemo(() => (
        <div className="w-full h-full flex flex-col items-center overflow-y-auto overflow-x-hidden p-8 custom-scrollbar">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-[520px] max-w-[90vw] bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl relative pointer-events-auto my-auto"
            >
                {/* Sync Button - positioned absolute */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                    {/* Timeout Kick Button */}
                    {Date.now() / 1000 > shuffleState.phaseDeadline && shuffleState.phaseDeadline > 0 && (
                        <Button
                            variant="secondary"
                            onClick={handleTimeoutKick}
                            disabled={isProcessing}
                            className="animate-pulse text-xs px-2 py-1"
                        >
                            <Clock className="w-3 h-3 mr-1" />
                            Kick
                        </Button>
                    )}

                    <Button variant="ghost" onClick={forceSync} disabled={isSyncing} className="p-1">
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                <div className="text-center mb-6">
                    {/* Animated Shuffle Icon */}
                    <div className="w-10 h-10 mx-auto mb-3 relative overflow-hidden">
                        {/* Arrow 1 - top */}
                        <motion.div
                            className="absolute top-1 left-0 right-0 flex items-center justify-center"
                            animate={{
                                x: [0, 20, -20, 0],
                                opacity: [1, 0, 0, 1]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                                times: [0, 0.4, 0.5, 1]
                            }}
                        >
                            <svg width="24" height="12" viewBox="0 0 24 12" fill="none" className="text-[#916A47]">
                                <path d="M2 6h16M14 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </motion.div>
                        {/* Arrow 2 - bottom */}
                        <motion.div
                            className="absolute bottom-1 left-0 right-0 flex items-center justify-center rotate-180"
                            animate={{
                                x: [0, 20, -20, 0],
                                opacity: [1, 0, 0, 1]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                                times: [0, 0.4, 0.5, 1],
                                delay: 0.75
                            }}
                        >
                            <svg width="24" height="12" viewBox="0 0 24 12" fill="none" className="text-[#916A47]">
                                <path d="M2 6h16M14 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </motion.div>
                    </div>
                    <h2 className="text-2xl font-['Cinzel'] text-white mb-1">
                        Shuffling Deck
                    </h2>
                    <p className="text-white/40 text-[13px]">
                        {shuffleState.deck.length} cards in deck • Player {shuffleState.currentShufflerIndex + 1} of {gameState.players.length}
                    </p>
                </div>

                <div className="space-y-1.5 mb-4 max-h-[240px] overflow-y-auto custom-scrollbar pr-2">
                    {gameState.players.map((player, index) => {
                        const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                        let isDone = index < shuffleState.currentShufflerIndex;
                        if (isMe && shuffleState.hasRevealed) isDone = true;
                        const isCurrentTurn = index === shuffleState.currentShufflerIndex && !isDone;

                        return (
                            <motion.div
                                key={player.address}
                                layout
                                className={`
                                    flex items-center justify-between p-3 rounded-xl border transition-all h-12 relative overflow-hidden
                                    ${isCurrentTurn
                                        ? 'bg-[#916A47]/20 border-[#916A47]/40 shadow-[0_0_15px_rgba(145,106,71,0.1)]'
                                        : isDone
                                            ? 'bg-[#916A47]/10 border-[#916A47]/30'
                                            : 'bg-white/5 border-white/10'
                                    }
                                `}
                            >
                                {isCurrentTurn && isProcessing && (
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#916A47]/10 to-transparent"
                                        animate={{ x: ['-100%', '100%'] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    />
                                )}
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className={`
                                        w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                                        ${isCurrentTurn ? 'bg-[#916A47] text-black' : isDone ? 'bg-[#916A47] text-white' : 'bg-white/10 text-white/40'}
                                    `}>
                                        {isDone ? <Check className="w-3 h-3" /> : index + 1}
                                    </div>
                                    <span className={`text-sm font-medium ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                        {player.name} {isMe && '(You)'}
                                    </span>
                                </div>
                                <div className="text-[10px] relative z-10">
                                    {isDone && <span className="text-[#916A47] font-medium">Done</span>}
                                    {isCurrentTurn && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[#916A47] font-bold">
                                                {isProcessing ? 'Shuffling...' : 'Your Turn'}
                                            </span>
                                            {isProcessing && <RefreshCw className="w-3 h-3 animate-spin text-[#916A47]" />}
                                        </div>
                                    )}
                                    {!isDone && !isCurrentTurn && <span className="text-white/20">Waiting</span>}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Progress Bar with integrated status */}
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-4">
                    <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#916A47]/10">
                        {shuffleState.hasRevealed ? (
                            <Check className="w-4 h-4 text-green-400" />
                        ) : (
                            <Loader2 className="w-4 h-4 text-[#916A47] animate-spin" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between text-[10px] mb-1.5">
                            <span className={shuffleState.hasRevealed ? 'text-green-400 uppercase' : 'text-white/40 uppercase'}>
                                {shuffleState.hasRevealed
                                    ? 'COMPLETE! WAITING FOR OTHERS...'
                                    : shuffleState.isMyTurn
                                        ? (shuffleState.hasCommitted ? 'REVEALING DECK...' : 'SHUFFLING & ENCRYPTING...')
                                        : `WAITING FOR ${currentShuffler?.name?.toUpperCase() || 'PLAYER'}...`
                                }
                            </span>
                            <span className="font-mono text-[#916A47] font-bold">{Math.floor(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden p-[1px]">
                            <motion.div
                                className={`h-full rounded-full ${shuffleState.hasRevealed ? 'bg-green-500' : 'bg-gradient-to-r from-[#916A47] to-[#c9a227]'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.8 }}
                            />
                        </div>
                    </div>
                </div>
            </motion.div >
        </div >
    ), [shuffleState, gameState.players, myPlayer, isProcessing, isTxPending, isSyncing, forceSync, handleMyTurn, handleReveal, handleTimeoutKick, currentShuffler?.name, progress]);
});

ShufflePhase.displayName = 'ShufflePhase';
