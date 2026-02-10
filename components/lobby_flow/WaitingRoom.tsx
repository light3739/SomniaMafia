import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { useSessionKey } from '../../hooks/useSessionKey';
import { Button } from '../ui/Button';
import { BackButton } from '../ui/BackButton';
import { GamePhase } from '../../types';
import { Check, Loader2 } from 'lucide-react';

export const WaitingRoom: React.FC = () => {
    const {
        lobbyName,
        gameState,
        startGameOnChain,
        isTxPending,
        currentRoomId,
        myPlayer,
        refreshPlayersList
    } = useGameContext();

    const roomIdNumber = currentRoomId ? Number(currentRoomId) : null;
    const {
        hasSession,
        error: sessionError
    } = useSessionKey(roomIdNumber);

    const router = useRouter();

    // 1. Авто-переход при смене фазы в блокчейне
    useEffect(() => {
        if (gameState.phase === GamePhase.SHUFFLING || gameState.phase === GamePhase.REVEAL) {
            router.push('/game');
        }
    }, [gameState.phase, router]);

    // 2. Room creator (first player) can start the game
    const isRoomCreator = gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase();
    const isParticipant = gameState.players.some(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());

    // V4: Min 4 players for proper mafia game
    const minPlayers = 4;
    const canStartGame = isRoomCreator && gameState.players.length >= minPlayers;

    const handleStart = async () => {
        if (isTxPending) return;
        await startGameOnChain();
    };

    return (
        <div className="relative w-full min-h-screen font-['Montserrat'] flex items-center justify-center p-4">


            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-6 py-10 mt-16"
            >
                <div className="w-full flex items-center justify-start">
                    <BackButton to="/setup" label="Exit to Menu" />
                </div>

                <div className="flex flex-col items-center text-center">
                    <p className="text-[#916A47] text-[10px] uppercase tracking-[0.3em] font-bold mb-2">
                        Somnia Session #{currentRoomId?.toString() || '...'}
                    </p>
                    <h1 className="text-white text-3xl font-light tracking-widest uppercase">
                        {lobbyName || 'Game Lobby'}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-white/40 text-xs uppercase tracking-widest">
                            Syncing with Smart Contract...
                        </span>
                    </div>
                </div>

                <div className="w-full bg-[rgba(15,10,5,0.85)] backdrop-blur-xl rounded-[32px] p-6 border border-white/5 shadow-2xl flex flex-col">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 min-h-[300px] max-h-[400px]">
                        {gameState.players.map((player, index) => {
                            const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();

                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={player.address}
                                    className={`w-full p-4 rounded-2xl flex justify-between items-center border transition-all ${isMe ? 'bg-[#916A47]/10 border-[#916A47]/30' : 'bg-white/[0.02] border-white/5'
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
                                            <span className="text-[10px] font-mono text-white/20">
                                                {player.address.slice(0, 6)}...{player.address.slice(-4)}
                                            </span>
                                        </div>
                                    </div>
                                    {index === 0 && (
                                        <span className="text-[9px] bg-[#916A47]/20 text-[#916A47] px-2 py-1 rounded border border-[#916A47]/30 uppercase font-bold">
                                            Creator
                                        </span>
                                    )}
                                </motion.div>
                            );
                        })}

                        {gameState.players.length === 0 && !isTxPending && (
                            <div className="py-20 text-center text-white/20 italic">
                                Connecting to network...
                            </div>
                        )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="text-white/40 text-[10px] uppercase tracking-tighter font-mono flex items-center gap-2">
                            Status: ZK-Shuffle Secured
                            <button
                                onClick={() => roomIdNumber && refreshPlayersList(BigInt(roomIdNumber))}
                                className="hover:text-white transition-colors"
                                title="Force Refresh"
                            >
                                ⟳
                            </button>
                        </div>
                        <div className="text-white/60 text-sm">
                            Players: <span className="text-[#916A47] font-bold">{gameState.players.length}/16</span>
                        </div>
                    </div>
                </div>

                {/* Session Key Status - V4: Already registered on join */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-full bg-[rgba(15,10,5,0.85)] backdrop-blur-xl rounded-2xl p-5 border border-white/5"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasSession
                                ? 'bg-green-500/20 border border-green-500/40'
                                : 'bg-yellow-500/20 border border-yellow-500/40'
                                }`}>
                                {hasSession ? (
                                    <Check className="w-5 h-5 text-green-400" />
                                ) : (
                                    <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                                )}
                            </div>
                            <div>
                                <h3 className={`font-medium ${hasSession ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {hasSession ? 'Auto-Sign Active ✓' : 'Checking Session...'}
                                </h3>
                                <p className="text-[11px] text-white/40">
                                    {hasSession
                                        ? 'All game actions signed automatically • Gas funded'
                                        : 'Session registered when you joined the room'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {sessionError && (
                        <p className="mt-2 text-xs text-red-400">{sessionError}</p>
                    )}
                </motion.div>

                {/* Room creator can start the game when enough players */}
                {canStartGame ? (
                    <Button
                        onClick={handleStart}
                        isLoading={isTxPending}
                        disabled={isTxPending}
                        className="w-full h-[70px] text-xl tracking-widest uppercase shadow-[0_10px_40px_rgba(145,106,71,0.2)]"
                    >
                        {isTxPending ? "Starting..." : "Start Game"}
                    </Button>
                ) : isParticipant ? (
                    <div className="w-full p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center backdrop-blur-sm">
                        <p className="text-white/30 text-sm italic">
                            {!isRoomCreator && gameState.players.length >= minPlayers
                                ? "Waiting for Host to start the game..."
                                : `Waiting for more players (${gameState.players.length}/${minPlayers} minimum)...`}
                        </p>
                    </div>
                ) : (
                    <div className="w-full p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center backdrop-blur-sm">
                        <p className="text-white/30 text-sm italic">
                            Connecting to room...
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
};