// components/game/ShufflePhase.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { usePublicClient, useWriteContract } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
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
        refreshPlayersList
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

    // Состояние для pending deck и salt (для reveal фазы)
    const [pendingDeck, setPendingDeck] = useState<string[] | null>(null);
    const [pendingSalt, setPendingSalt] = useState<string | null>(null);

    const SHUFFLE_COMMIT_KEY = `mafia_shuffle_commit_${currentRoomId}_${myPlayer?.address}`;

    // Restore state from local storage on mount
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
                        // If we have data but not committed, it means we crashed/refreshed during TX or before it finished.
                        // Restore state so user can click "Retry" or we can auto-retry if needed.
                        setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                        console.log("Restored pending shuffle state (pre-commit)");
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

        try {
            // 1. Получаем состояние комнаты (легкий запрос)
            const roomData = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getRoom',
                args: [currentRoomId],
            }) as any;

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

            // 2. ЧИТАЕМ КОЛОДУ ЧЕРЕЗ СОБЫТИЯ (EVENTS), А НЕ ЧЕРЕЗ getDeck
            // Это решает проблему с зависанием чтения огромного массива
            let deck: string[] = [];

            if (currentIndex > 0 || revealedCount > 0) {
                try {
                    // Get current block number and limit range to 1000 blocks (Somnia RPC limit)
                    const currentBlock = await publicClient.getBlockNumber();
                    const fromBlock = currentBlock > 1000n ? currentBlock - 1000n : 0n;

                    // Ищем все события DeckRevealed для этой комнаты
                    const logs = await publicClient.getContractEvents({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        eventName: 'DeckRevealed',
                        args: { roomId: currentRoomId } as any,
                        fromBlock: fromBlock
                    });

                    // Если события есть, берем колоду из самого последнего
                    if (logs && logs.length > 0) {
                        const lastLog = logs[logs.length - 1];
                        // @ts-ignore
                        deck = (lastLog.args as any).deck as string[];
                        console.log(`[Event Sync] Loaded deck with ${deck.length} cards from logs`);
                    }
                } catch (err) {
                    // Silently fall through to getDeck fallback
                    console.warn("[Event Sync] Events not available, using direct read");
                }
            }

            // Fallback: Если событий не нашли (или RPC глючит), пробуем прямой метод, но он может упасть
            if (deck.length === 0 && (currentIndex > 0 || revealedCount > 0)) {
                try {
                    deck = await publicClient.readContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'getDeck',
                        args: [currentRoomId],
                    }) as string[];
                    console.log(`[Direct Sync] Loaded deck with ${deck.length} cards`);
                } catch (e) {
                    console.warn("Direct getDeck failed, waiting for events...");
                }
            }

            // Логика определения хода
            const currentShuffler = gameState.players[currentIndex];
            let isMyTurnFromContract = false;
            if (currentShuffler && myPlayer) {
                isMyTurnFromContract = currentShuffler.address.toLowerCase() === myPlayer.address.toLowerCase();
            }

            // Если я не первый игрок, но колоды нет — блокируем ход
            if (isMyTurnFromContract && currentIndex > 0 && deck.length === 0) {
                console.warn("My turn, but deck not synced yet.");
                isMyTurnFromContract = false;
            }

            setShuffleState(prev => {
                // STICKY MAX: Never allow index to go backwards
                const safeIndex = Math.max(prev.currentShufflerIndex, currentIndex);

                // If we already revealed locally, don't let RPC overwrite it with stale 'revealed=false'
                if (prev.hasRevealed) {
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
                address: MAFIA_CONTRACT_ADDRESS,
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

    // Polling
    useEffect(() => {
        fetchShuffleData();
        const interval = setInterval(fetchShuffleData, 3000);
        return () => clearInterval(interval);
    }, [fetchShuffleData]);



    const handleMyTurn = useCallback(async () => {
        if (!currentRoomId || !myPlayer || isProcessing) return;

        setIsProcessing(true);
        try {
            const shuffleService = getShuffleService();
            shuffleService.generateKeys(); // Generate my E/D keys

            let newDeck: string[];

            if (shuffleState.currentShufflerIndex === 0) {
                // I am the host (first player) - Generate fresh deck
                if (shuffleState.deck.length > 0) {
                    console.warn("Host sees existing deck, resetting...");
                }
                addLog("Generating initial deck...", "info");
                const initialDeck = ShuffleService.generateInitialDeck(gameState.players.length);
                const shuffled = shuffleService.shuffleArray(initialDeck);
                newDeck = shuffleService.encryptDeck(shuffled);
            } else {
                // I am a subsequent player - Shuffle existing deck
                if (shuffleState.deck.length === 0) {
                    throw new Error("Deck is empty! Sync error.");
                }
                addLog("Shuffling and re-encrypting deck...", "info");
                const shuffled = shuffleService.shuffleArray(shuffleState.deck);
                newDeck = shuffleService.encryptDeck(shuffled);
            }

            const salt = ShuffleService.generateSalt();
            const deckHash = ShuffleService.createDeckCommitHash(newDeck, salt);

            // V4 Fix: Save state BEFORE transaction to prevent data loss
            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({
                deck: newDeck,
                salt: salt,
                hasCommitted: false // Not yet committed
            }));

            // V4 Fix: Save keys immediately
            shuffleService.saveKeys(currentRoomId.toString(), myPlayer.address);

            addLog("Committing deck hash...", "info");
            await commitDeckOnChain(deckHash);

            // Update to committed=true
            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({
                deck: newDeck,
                salt: salt,
                hasCommitted: true
            }));

            setPendingDeck(newDeck);
            setPendingSalt(salt);

            setShuffleState(prev => ({
                ...prev,
                hasCommitted: true,
                isMyTurn: true
            }));

            addLog("Commit successful! Click Reveal to complete.", "success");

        } catch (e: any) {
            console.error("Commit failed:", e);
            addLog(e.message || "Commit failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    }, [currentRoomId, myPlayer, isProcessing, shuffleState.currentShufflerIndex, shuffleState.deck, gameState.players.length, SHUFFLE_COMMIT_KEY, commitDeckOnChain, addLog]);

    const handleReveal = useCallback(async () => {
        if (!currentRoomId || !pendingDeck || !pendingSalt || isProcessing) return;

        setIsProcessing(true);
        try {
            addLog("Revealing deck...", "info");
            await revealDeckOnChain(pendingDeck, pendingSalt);

            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setPendingDeck(null);
            setPendingSalt(null);

            setShuffleState(prev => ({
                ...prev,
                hasRevealed: true,
                currentShufflerIndex: prev.currentShufflerIndex + 1
            }));

            addLog("Deck revealed successfully!", "success");
            setTimeout(fetchShuffleData, 1000); // Trigger immediate update

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
    useEffect(() => {
        const canExecuteAuto =
            shuffleState.isMyTurn &&
            !shuffleState.hasCommitted &&
            !isProcessing &&
            !isTxPending &&
            !shuffleState.hasRevealed &&
            gameState.players.length > 0;

        if (canExecuteAuto) {
            console.log("[Shuffle Auto] Detected my turn. Starting automatic shuffle/reveal...");
            handleMyTurn();
        }
    }, [shuffleState.isMyTurn, shuffleState.hasCommitted, shuffleState.hasRevealed, isProcessing, isTxPending, gameState.players.length, handleMyTurn]);

    // AUTO-REVEAL: Trigger handleReveal if we have committed but not revealed
    useEffect(() => {
        const canAutoReveal =
            shuffleState.isMyTurn &&
            shuffleState.hasCommitted &&
            !shuffleState.hasRevealed &&
            !isProcessing &&
            !isTxPending &&
            pendingDeck &&
            pendingSalt;

        if (canAutoReveal) {
            console.log("[Shuffle Auto] Detected commit complete. Starting automatic reveal...");
            handleReveal();
        }
    }, [shuffleState.isMyTurn, shuffleState.hasCommitted, shuffleState.hasRevealed, isProcessing, isTxPending, pendingDeck, pendingSalt, handleReveal]);

    return useMemo(() => (
        <div className="w-full h-full flex flex-col items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-[520px] max-w-[90vw] bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl relative pointer-events-auto"
            >
                {/* Sync Button */}
                <div className="flex items-center gap-4">
                    {/* Timeline display */}
                    <div className="text-sm text-gray-400">
                        Player {shuffleState.currentShufflerIndex + 1} of {gameState.players.length}
                    </div>

                    {/* Timeout Kick Button */}
                    {Date.now() / 1000 > shuffleState.phaseDeadline && shuffleState.phaseDeadline > 0 && (
                        <Button
                            variant="secondary"
                            onClick={handleTimeoutKick}
                            disabled={isProcessing}
                            className="animate-pulse"
                        >
                            <Clock className="w-4 h-4 mr-2" />
                            Kick Timeout
                        </Button>
                    )}

                    <Button variant="ghost" onClick={forceSync} disabled={isSyncing}>
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                <div className="text-center mb-6">
                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-1">
                        Shuffling Deck
                    </h2>
                    <p className="text-white/50 text-xs">
                        {shuffleState.deck.length} cards in deck • Player {shuffleState.currentShufflerIndex + 1} of {gameState.players.length}
                    </p>
                </div>

                <div className="space-y-1.5 mb-4 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
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
                                            ? 'bg-green-900/10 border-green-500/20'
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
                                        ${isCurrentTurn ? 'bg-[#916A47] text-black' : isDone ? 'bg-green-600 text-white' : 'bg-white/10 text-white/40'}
                                    `}>
                                        {isDone ? <Check className="w-3 h-3" /> : index + 1}
                                    </div>
                                    <span className={`text-sm font-medium ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                        {player.name} {isMe && '(You)'}
                                    </span>
                                </div>
                                <div className="text-[10px] relative z-10">
                                    {isDone && <span className="text-green-400 font-medium">Done</span>}
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

                <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-4">
                    <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#916A47]/10">
                        <Shuffle className="w-4 h-4 text-[#916A47]" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
                            <span>TOTAL PROGRESS</span>
                            <span className="font-mono text-[#916A47] font-bold">{Math.floor(progress)}%</span>
                        </div>
                        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden p-[1px]">
                            <motion.div
                                className="h-full bg-gradient-to-r from-[#916A47] to-[#c9a227] rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.8 }}
                            />
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {shuffleState.isMyTurn && !shuffleState.hasCommitted ? (
                        <motion.div key="my-turn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Button onClick={handleMyTurn} isLoading={isProcessing || isTxPending} className="w-full h-12 text-base">
                                Shuffle & Encrypt
                            </Button>
                        </motion.div>
                    ) : shuffleState.hasCommitted && !shuffleState.hasRevealed ? (
                        <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Button onClick={handleReveal} isLoading={isProcessing || isTxPending} className="w-full h-12 text-base">
                                Reveal Deck
                            </Button>
                        </motion.div>
                    ) : shuffleState.hasRevealed ? (
                        <div className="text-center py-2">
                            <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
                                <Check className="w-4 h-4" />
                                <span>Complete! Waiting for others...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-2">
                            <div className="flex items-center justify-center gap-2 text-white/30 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Waiting for {currentShuffler?.name || 'player'}...</span>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div >
        </div >
    ), [shuffleState, gameState.players, myPlayer, isProcessing, isTxPending, isSyncing, forceSync, handleMyTurn, handleReveal, handleTimeoutKick, currentShuffler?.name, progress]);
});

ShufflePhase.displayName = 'ShufflePhase';
