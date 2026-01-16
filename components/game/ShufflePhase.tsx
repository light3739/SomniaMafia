// components/game/ShufflePhase.tsx
import React, { useEffect, useState, useCallback } from 'react';
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

export const ShufflePhase: React.FC = () => {
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
                    setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                }
            } catch (e) {
                console.error("Failed to recover pending deck", e);
            }
        }
    }, [SHUFFLE_COMMIT_KEY]);

    // Force Sync Function
    const forceSync = async () => {
        if (!currentRoomId) return;
        setIsSyncing(true);
        try {
            await fetchShuffleData();
            await refreshPlayersList(currentRoomId);
        } finally {
            setIsSyncing(false);
        }
    };

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
                    // Ищем все события DeckRevealed для этой комнаты
                    const logs = await publicClient.getContractEvents({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        eventName: 'DeckRevealed',
                        args: { roomId: currentRoomId } as any,
                        fromBlock: 'earliest'
                    });

                    // Если события есть, берем колоду из самого последнего
                    if (logs && logs.length > 0) {
                        const lastLog = logs[logs.length - 1];
                        // @ts-ignore
                        deck = (lastLog.args as any).deck as string[];
                        console.log(`[Event Sync] Loaded deck with ${deck.length} cards from logs`);
                    }
                } catch (err) {
                    console.error("Failed to read events:", err);
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

    // Handle Timeout Kick
    const { writeContractAsync } = useWriteContract();

    const handleTimeoutKick = async () => {
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
    };

    // Polling
    useEffect(() => {
        fetchShuffleData();
        const interval = setInterval(fetchShuffleData, 3000);
        return () => clearInterval(interval);
    }, [fetchShuffleData]);



    const handleMyTurn = async () => {
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

            addLog("Committing deck hash...", "info");
            await commitDeckOnChain(deckHash);

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
    };

    const handleReveal = async () => {
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
    };

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

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg w-full bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl relative"
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
                </div>     <div className="text-center mb-8">
                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                        Shuffling Deck
                    </h2>
                    <p className="text-white/50 text-sm">
                        {shuffleState.deck.length} cards in deck • Player {shuffleState.currentShufflerIndex + 1}'s turn
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-xs text-white/40 mb-2">
                        <span>Progress</span>
                        <span>{shuffleState.currentShufflerIndex} / {totalPlayers}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-[#916A47] to-[#c9a227]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>

                <div className="space-y-2 mb-8 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {gameState.players.map((player, index) => {
                        const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();

                        // Logic: A player is "Done" if their index is less than current shuffler
                        // OR if it's me and I've revealed locally
                        let isDone = index < shuffleState.currentShufflerIndex;
                        if (isMe && shuffleState.hasRevealed) isDone = true;

                        const isCurrentTurn = index === shuffleState.currentShufflerIndex && !isDone;

                        return (
                            <motion.div
                                key={player.address}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`
                                    flex items-center justify-between p-3 rounded-xl border transition-all
                                    ${isCurrentTurn
                                        ? 'bg-[#916A47]/20 border-[#916A47]/50'
                                        : isDone
                                            ? 'bg-green-900/20 border-green-500/30'
                                            : 'bg-white/5 border-white/10'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                        ${isCurrentTurn ? 'bg-[#916A47] text-black' : isDone ? 'bg-green-600 text-white' : 'bg-white/10 text-white/40'}
                                    `}>
                                        {isDone ? <Check className="w-4 h-4" /> : index + 1}
                                    </div>
                                    <span className={`font-medium ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                        {player.name} {isMe && '(You)'}
                                    </span>
                                </div>
                                <div className="text-xs">
                                    {isDone && <span className="text-green-400">Done</span>}
                                    {isCurrentTurn && (
                                        <span className="text-[#916A47] flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Turn
                                        </span>
                                    )}
                                    {!isDone && !isCurrentTurn && <span className="text-white/30">Waiting</span>}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <AnimatePresence mode="wait">
                    {shuffleState.isMyTurn && !shuffleState.hasCommitted ? (
                        <motion.div
                            key="my-turn"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <Button
                                onClick={handleMyTurn}
                                isLoading={isProcessing || isTxPending}
                                disabled={isProcessing || isTxPending}
                                className="w-full h-14 text-lg"
                            >
                                {isProcessing ? 'Encrypting...' : 'Shuffle & Encrypt Deck'}
                            </Button>
                        </motion.div>
                    ) : shuffleState.hasCommitted && !shuffleState.hasRevealed ? (
                        <motion.div
                            key="reveal"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <Button
                                onClick={handleReveal}
                                isLoading={isProcessing || isTxPending}
                                disabled={isProcessing || isTxPending}
                                className="w-full h-14 text-lg"
                            >
                                {isProcessing ? 'Revealing...' : 'Reveal Deck'}
                            </Button>
                        </motion.div>
                    ) : shuffleState.hasRevealed ? (
                        <div className="text-center py-4">
                            <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                                <Check className="w-5 h-5" />
                                <span className="font-medium">Shuffle Complete!</span>
                            </div>
                            <p className="text-white/40 text-sm">Waiting for others...</p>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <div className="flex items-center justify-center gap-2 text-white/50 mb-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Waiting for {currentShuffler?.name || 'player'}...</span>
                            </div>
                            {shuffleState.currentShufflerIndex > 0 && shuffleState.deck.length === 0 && (
                                <p className="text-amber-500/50 text-xs mt-1">
                                    Syncing deck from previous player...
                                </p>
                            )}
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
