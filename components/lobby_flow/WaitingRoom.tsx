import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import lobbyBg from '../../assets/lobby_background.png';
import { Button } from '../ui/Button';
import { BackButton } from '../ui/BackButton';
import { GamePhase } from '../../types';

export const WaitingRoom: React.FC = () => {
    const {
        lobbyName,
        playerName,
        gameState,
        startGameOnChain,
        isTxPending,
        currentRoomId
    } = useGameContext();

    const navigate = useNavigate();

    // Следим за изменением фазы в блокчейне
    useEffect(() => {
        // Как только контракт переходит в SHUFFLING или ROLE_REVEAL — пора играть
        if (gameState.phase === GamePhase.SHUFFLING || gameState.phase === GamePhase.ROLE_REVEAL) {
            navigate('/game');
        }
    }, [gameState.phase, navigate]);

    const handleStart = async () => {
        if (isTxPending) return;
        await startGameOnChain();
    };

    // Определяем, является ли текущий пользователь хостом (только он может нажать Старт)
    // В нашем контракте хост — это тот, кто создал комнату (первый в списке)
    const isHost = gameState.players[0]?.address.toLowerCase() === gameState.myPlayerId?.toLowerCase();

    return (
        <div className="relative w-full min-h-screen font-['Montserrat'] flex items-center justify-center p-4">
            {/* Fixed Background */}
            <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${lobbyBg})` }}
            >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-6 py-10 mt-16"
            >
                <div className="w-full flex items-center justify-start">
                    <BackButton to="/setup" label="Leave Lobby" />
                </div>

                <div className="flex flex-col items-center text-center">
                    <p className="text-[#916A47] text-[10px] uppercase tracking-[0.3em] font-bold mb-2">
                        On-Chain Session #{currentRoomId?.toString() || '...'}
                    </p>
                    <h1 className="text-white text-3xl font-light tracking-widest uppercase">
                        {lobbyName || 'Decentralized Lobby'}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-white/40 text-xs uppercase tracking-widest">
                            Waiting for players to sync...
                        </span>
                    </div>
                </div>

                {/* Lobby List */}
                <div className="w-full bg-[rgba(15,10,5,0.85)] backdrop-blur-xl rounded-[32px] p-6 border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 min-h-[300px] max-h-[400px]">
                        {gameState.players.map((player, index) => {
                            const isMe = player.address.toLowerCase() === gameState.myPlayerId?.toLowerCase();

                            return (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    key={player.address}
                                    className={`w-full p-4 rounded-2xl flex justify-between items-center border transition-all ${isMe
                                            ? 'bg-[#916A47]/10 border-[#916A47]/30'
                                            : 'bg-white/[0.02] border-white/5'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isMe ? 'bg-[#916A47] text-black' : 'bg-white/5 text-white/40'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                                {player.name} {isMe && '(You)'}
                                            </span>
                                            <span className="text-[10px] font-mono text-white/20 uppercase tracking-tighter">
                                                {player.address.slice(0, 6)}...{player.address.slice(-4)}
                                            </span>
                                        </div>
                                    </div>

                                    {index === 0 && (
                                        <span className="text-[9px] bg-white/5 text-white/40 px-2 py-1 rounded-md border border-white/10 uppercase tracking-widest">
                                            Host
                                        </span>
                                    )}
                                </motion.div>
                            );
                        })}

                        {gameState.players.length < 4 && (
                            <div className="py-8 text-center text-white/10 italic text-sm">
                                Need at least 4 players to start...
                            </div>
                        )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-white/20 text-xs uppercase tracking-widest">Network: Somnia Testnet</span>
                        <div className="text-white/60 text-sm font-medium">
                            Players: <span className="text-[#916A47]">{gameState.players.length}/16</span>
                        </div>
                    </div>
                </div>

                {/* Кнопка управления (видна всем, но активна только для хоста) */}
                {isHost ? (
                    <Button
                        onClick={handleStart}
                        isLoading={isTxPending}
                        disabled={isTxPending || gameState.players.length < 4}
                        className="w-full h-[70px] text-xl tracking-[0.2em] font-light shadow-[0_10px_30px_rgba(145,106,71,0.2)]"
                    >
                        {isTxPending ? "Confirming on Chain..." : "Start Game"}
                    </Button>
                ) : (
                    <div className="w-full p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
                        <p className="text-white/30 text-sm italic">
                            Waiting for the Host to initiate the shuffle...
                        </p>
                    </div>
                )}
            </motion.div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(145, 106, 71, 0.3);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #916A47;
                }
            `}</style>
        </div>
    );
};