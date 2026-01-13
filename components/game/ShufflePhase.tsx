// components/game/ShufflePhase.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { usePublicClient } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { Loader2, Check, Clock, Shuffle } from 'lucide-react';
import { Button } from '../ui/Button';

interface ShuffleState {
    currentShufflerIndex: number;
    deck: string[];
    isMyTurn: boolean;
    hasSubmitted: boolean;
}

export const ShufflePhase: React.FC = () => {
    const { 
        gameState, 
        currentRoomId, 
        myPlayer, 
        submitDeckOnChain, 
        addLog,
        isTxPending 
    } = useGameContext();
    
    const publicClient = usePublicClient();
    const [shuffleState, setShuffleState] = useState<ShuffleState>({
        currentShufflerIndex: 0,
        deck: [],
        isMyTurn: false,
        hasSubmitted: false
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
                isMyTurn: isMyTurn && !prev.hasSubmitted
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

    // Обработка моего хода
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
            
            // Отправляем в контракт
            await submitDeckOnChain(newDeck);
            
            setShuffleState(prev => ({
                ...prev,
                hasSubmitted: true,
                isMyTurn: false
            }));
            
        } catch (e: any) {
            console.error("Shuffle failed:", e);
            addLog(e.message || "Shuffle failed", "danger");
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
                    {shuffleState.isMyTurn && !shuffleState.hasSubmitted ? (
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
                    ) : shuffleState.hasSubmitted ? (
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
