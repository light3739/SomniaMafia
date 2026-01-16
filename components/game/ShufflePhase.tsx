// components/game/ShufflePhase.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { usePublicClient } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { Loader2, Check, Clock, Shuffle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface ShuffleState {
    currentShufflerIndex: number;
    deck: string[];
    isMyTurn: boolean;
    hasCommitted: boolean;
    hasRevealed: boolean;
    pendingDeck: string[] | null;
    pendingSalt: string | null;
}

export const ShufflePhase: React.FC = () => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        commitDeckOnChain,
        revealDeckOnChain,
        addLog,
        isTxPending
    } = useGameContext();

    const publicClient = usePublicClient();
    const [shuffleState, setShuffleState] = useState<ShuffleState>({
        currentShufflerIndex: 0,
        deck: [],
        isMyTurn: false,
        hasCommitted: false,
        hasRevealed: false,
        pendingDeck: null,
        pendingSalt: null
    });
    const [isProcessing, setIsProcessing] = useState(false);

    // Получить данные из контракта
    const fetchShuffleData = useCallback(async () => {
        if (!publicClient || !currentRoomId) return;

        try {
            // Получаем данные комнаты через getRoom (возвращает именованную структуру)
            const roomData = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getRoom',
                args: [currentRoomId],
            }) as any;

            // Получаем текущую колоду
            const deck = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getDeck',
                args: [currentRoomId],
            }) as string[];

            // V3.1: Use named property instead of index
            const currentIndex = Number(roomData.currentShufflerIndex);
            const currentShuffler = gameState.players[currentIndex];
            const isMyTurn = currentShuffler?.address.toLowerCase() === myPlayer?.address.toLowerCase();

            setShuffleState(prev => ({
                ...prev,
                currentShufflerIndex: currentIndex,
                deck: deck,
                isMyTurn: isMyTurn && !prev.hasCommitted
            }));
        } catch (e) {
            console.error("Failed to fetch shuffle data:", e);
        }
    }, [publicClient, currentRoomId, gameState.players, myPlayer]);

    // Polling для обновления состояния
    useEffect(() => {
        fetchShuffleData();
        const interval = setInterval(fetchShuffleData, 3000);
        return () => clearInterval(interval);
    }, [fetchShuffleData]);

    // Состояние для pending deck и salt (для reveal фазы)
    const [pendingDeck, setPendingDeck] = useState<string[] | null>(null);
    const [pendingSalt, setPendingSalt] = useState<`0x${string}` | null>(null);

    // LocalStorage key для persistence
    const SHUFFLE_COMMIT_KEY = `mafia_shuffle_commit_${currentRoomId}_${myPlayer?.address}`;

    // Загружаем данные из localStorage при монтировании
    useEffect(() => {
        if (!currentRoomId || !myPlayer?.address) return;

        const saved = localStorage.getItem(SHUFFLE_COMMIT_KEY);
        if (saved) {
            try {
                const { deck, salt, hasCommitted } = JSON.parse(saved);
                if (deck && salt) {
                    setPendingDeck(deck);
                    setPendingSalt(salt);
                    setShuffleState(prev => ({ ...prev, hasCommitted: true }));
                    addLog("Restored pending shuffle from previous session", "info");
                }
            } catch (e) {
                console.error("Failed to load shuffle commit data:", e);
            }
        }
    }, [currentRoomId, myPlayer?.address, SHUFFLE_COMMIT_KEY, addLog]);

    // Обработка моего хода - фаза COMMIT
    const handleMyTurn = async () => {
        if (!currentRoomId || !myPlayer || isProcessing) return;

        setIsProcessing(true);
        try {
            const shuffleService = getShuffleService();

            // Генерируем ключи если ещё нет
            shuffleService.generateKeys();

            let newDeck: string[];

            if (shuffleState.deck.length === 0) {
                // Первый игрок (хост) — генерирует начальную колоду
                addLog("Generating initial deck...", "info");
                const initialDeck = ShuffleService.generateInitialDeck(gameState.players.length);

                // Перемешиваем
                const shuffled = shuffleService.shuffleArray(initialDeck);

                // Шифруем
                newDeck = shuffleService.encryptDeck(shuffled);
                addLog("Deck created and encrypted!", "success");
            } else {
                // Последующие игроки — перемешивают и перешифровывают
                addLog("Shuffling and re-encrypting deck...", "info");

                // Перемешиваем существующую колоду
                const shuffled = shuffleService.shuffleArray(shuffleState.deck);

                // Шифруем каждую карту своим ключом (поверх существующего шифрования)
                newDeck = shuffleService.encryptDeck(shuffled);
                addLog("Deck re-shuffled and encrypted!", "success");
            }

            // Генерируем соль для commit-reveal
            const salt = ShuffleService.generateSalt();

            // Вычисляем хеш колоды
            const deckHash = ShuffleService.createDeckCommitHash(newDeck, salt);

            // Отправляем commit в контракт
            addLog("Committing deck hash...", "info");
            await commitDeckOnChain(deckHash);

            // Сохраняем deck и salt для reveal в localStorage
            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({
                deck: newDeck,
                salt: salt,
                hasCommitted: true
            }));

            // Сохраняем deck и salt для reveal
            setPendingDeck(newDeck);
            setPendingSalt(salt);

            setShuffleState(prev => ({
                ...prev,
                hasCommitted: true,
                isMyTurn: false
            }));

            addLog("Commit successful! Click Reveal to complete.", "success");

        } catch (e: any) {
            console.error("Commit failed:", e);
            addLog(e.message || "Commit failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // Обработка reveal фазы
    const handleReveal = async () => {
        if (!currentRoomId || !pendingDeck || !pendingSalt || isProcessing) return;

        setIsProcessing(true);
        try {
            addLog("Revealing deck...", "info");
            await revealDeckOnChain(pendingDeck, pendingSalt);

            // Очищаем localStorage после успешного reveal
            localStorage.removeItem(SHUFFLE_COMMIT_KEY);

            // Очищаем pending данные
            setPendingDeck(null);
            setPendingSalt(null);

            setShuffleState(prev => ({
                ...prev,
                hasRevealed: true
            }));

            addLog("Deck revealed successfully!", "success");

        } catch (e: any) {
            console.error("Reveal failed:", e);
            addLog(e.message || "Reveal failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // Текущий шаффлер
    const currentShuffler = gameState.players[shuffleState.currentShufflerIndex];
    const totalPlayers = gameState.players.length;
    const progress = Math.min((shuffleState.currentShufflerIndex / totalPlayers) * 100, 100);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg w-full bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="inline-block mb-4"
                    >
                        <Shuffle className="w-12 h-12 text-[#916A47]" />
                    </motion.div>
                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                        Shuffling Deck
                    </h2>
                    <p className="text-white/50 text-sm">
                        Each player encrypts and shuffles the role cards
                    </p>
                </div>

                {/* LocalStorage Disclaimer */}
                <div className="mb-6 p-3 rounded-xl bg-amber-900/20 border border-amber-500/30 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-[10px] text-amber-200/70 leading-relaxed">
                        <span className="font-bold text-amber-500 block mb-0.5 uppercase tracking-wider">Storage Warning</span>
                        Do not clear browser cache or close the tab during this phase.
                        Your encryption keys are stored locally. Losing them will block the game.
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

                {/* Player List */}
                <div className="space-y-2 mb-8 max-h-[200px] overflow-y-auto">
                    {gameState.players.map((player, index) => {
                        const isCurrentTurn = index === shuffleState.currentShufflerIndex;
                        const isDone = index < shuffleState.currentShufflerIndex;
                        const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();

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
                                        ${isCurrentTurn
                                            ? 'bg-[#916A47] text-black'
                                            : isDone
                                                ? 'bg-green-600 text-white'
                                                : 'bg-white/10 text-white/40'
                                        }
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
                                            Shuffling...
                                        </span>
                                    )}
                                    {!isDone && !isCurrentTurn && <span className="text-white/30">Waiting</span>}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Action Button */}
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
                            <p className="text-center text-white/40 text-xs mt-3">
                                Your turn! Click to shuffle and encrypt the deck.
                            </p>
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
                            <p className="text-center text-white/40 text-xs mt-3">
                                Commit successful! Click to reveal the deck.
                            </p>
                        </motion.div>
                    ) : shuffleState.hasRevealed ? (
                        <motion.div
                            key="submitted"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center py-4"
                        >
                            <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                                <Check className="w-5 h-5" />
                                <span className="font-medium">Your shuffle submitted!</span>
                            </div>
                            <p className="text-white/40 text-sm">
                                Waiting for other players...
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="waiting"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center py-4"
                        >
                            <div className="flex items-center justify-center gap-2 text-white/50 mb-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Waiting for {currentShuffler?.name || 'player'}...</span>
                            </div>
                            <p className="text-white/30 text-xs">
                                The deck is being shuffled and encrypted
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
