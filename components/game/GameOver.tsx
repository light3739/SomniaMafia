// components/game/GameOver.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../../contexts/GameContext';
import { Role } from '../../types';
import { Button } from '../ui/Button';
import { Trophy, Skull, Users, Shield, Search, Home, RotateCcw } from 'lucide-react';

const RoleIcons: Record<Role, React.ReactNode> = {
    [Role.MAFIA]: <Skull className="w-5 h-5 text-red-500" />,
    [Role.DOCTOR]: <Shield className="w-5 h-5 text-green-500" />,
    [Role.DETECTIVE]: <Search className="w-5 h-5 text-blue-500" />,
    [Role.CIVILIAN]: <Users className="w-5 h-5 text-amber-500" />,
    [Role.UNKNOWN]: <Users className="w-5 h-5 text-gray-500" />
};

export const GameOver: React.FC = () => {
    const { gameState, myPlayer } = useGameContext();
    const navigate = useNavigate();

    // Определяем победителя по оставшимся игрокам
    // В реальной игре это должно приходить из контракта
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const aliveMafia = alivePlayers.filter(p => p.role === Role.MAFIA);
    const aliveCivilians = alivePlayers.filter(p => p.role !== Role.MAFIA);
    
    const mafiaWins = aliveMafia.length >= aliveCivilians.length || aliveCivilians.length === 0;
    const winner = mafiaWins ? 'MAFIA' : 'CIVILIANS';

    // Проверяем, победил ли я
    const myRole = myPlayer?.role || Role.UNKNOWN;
    const didIWin = (mafiaWins && myRole === Role.MAFIA) || (!mafiaWins && myRole !== Role.MAFIA);

    const handlePlayAgain = () => {
        // Очистить сессию и вернуться в лобби
        sessionStorage.removeItem('currentRoomId');
        navigate('/setup');
    };

    const handleHome = () => {
        sessionStorage.removeItem('currentRoomId');
        navigate('/');
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", duration: 0.8 }}
                className="max-w-2xl w-full"
            >
                {/* Winner Banner */}
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className={`
                        text-center p-8 rounded-3xl mb-8
                        ${mafiaWins 
                            ? 'bg-gradient-to-br from-red-950/50 to-red-900/30 border border-red-500/30' 
                            : 'bg-gradient-to-br from-amber-950/50 to-amber-900/30 border border-amber-500/30'
                        }
                    `}
                >
                    <motion.div
                        initial={{ rotate: -180, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ delay: 0.4, type: "spring" }}
                        className="mb-4"
                    >
                        <Trophy className={`w-20 h-20 mx-auto ${mafiaWins ? 'text-red-500' : 'text-amber-500'}`} />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className={`text-4xl md:text-5xl font-['Playfair_Display'] mb-2 ${mafiaWins ? 'text-red-400' : 'text-amber-400'}`}
                    >
                        {mafiaWins ? 'Mafia Wins!' : 'Town Wins!'}
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-white/60"
                    >
                        {mafiaWins 
                            ? 'The mafia has taken control of the town...' 
                            : 'Justice prevails! All mafia members have been eliminated.'
                        }
                    </motion.p>

                    {/* Personal result */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1 }}
                        className={`
                            mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full
                            ${didIWin 
                                ? 'bg-green-900/30 text-green-400 border border-green-500/30' 
                                : 'bg-gray-900/30 text-gray-400 border border-gray-500/30'
                            }
                        `}
                    >
                        {didIWin ? (
                            <>
                                <Trophy className="w-4 h-4" />
                                <span className="font-medium">You Won!</span>
                            </>
                        ) : (
                            <>
                                <Skull className="w-4 h-4" />
                                <span className="font-medium">You Lost</span>
                            </>
                        )}
                        <span className="text-white/40">as {myRole}</span>
                    </motion.div>
                </motion.div>

                {/* All Players Reveal */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    className="bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-6"
                >
                    <h3 className="text-white/50 text-sm uppercase tracking-wider mb-4">Game Results</h3>
                    <p className="text-white/30 text-xs mb-4">
                        Note: Only your role is revealed. Other players' roles remain encrypted.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {gameState.players.map((player, index) => {
                            const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                            const isDead = !player.isAlive;
                            const roleKnown = player.role !== Role.UNKNOWN;

                            return (
                                <motion.div
                                    key={player.address}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 1.4 + index * 0.1 }}
                                    className={`
                                        p-3 rounded-xl border
                                        ${isDead 
                                            ? 'bg-gray-900/50 border-gray-800 opacity-60' 
                                            : isMe 
                                                ? 'bg-[#916A47]/20 border-[#916A47]/40'
                                                : 'bg-white/5 border-white/10'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center
                                            ${player.role === Role.MAFIA 
                                                ? 'bg-red-900/50' 
                                                : player.role === Role.DOCTOR
                                                    ? 'bg-green-900/50'
                                                    : player.role === Role.DETECTIVE
                                                        ? 'bg-blue-900/50'
                                                        : 'bg-amber-900/50'
                                            }
                                        `}>
                                            {RoleIcons[player.role]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium truncate ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                                {player.name} {isMe && '(You)'}
                                            </p>
                                            <p className={`text-xs ${
                                                !roleKnown
                                                    ? 'text-gray-500'
                                                    : player.role === Role.MAFIA 
                                                        ? 'text-red-400' 
                                                        : player.role === Role.DOCTOR
                                                            ? 'text-green-400'
                                                            : player.role === Role.DETECTIVE
                                                                ? 'text-blue-400'
                                                                : 'text-amber-400'
                                            }`}>
                                                {roleKnown ? player.role : '🔒 Hidden'}
                                            </p>
                                        </div>
                                        {isDead && (
                                            <Skull className="w-4 h-4 text-red-500/50" />
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    className="flex gap-4"
                >
                    <Button
                        onClick={handlePlayAgain}
                        className="flex-1"
                    >
                        <RotateCcw className="w-5 h-5 mr-2" />
                        Play Again
                    </Button>
                    <Button
                        onClick={handleHome}
                        variant="outline-gold"
                        className="flex-1"
                    >
                        <Home className="w-5 h-5 mr-2" />
                        Home
                    </Button>
                </motion.div>

                {/* Game Stats */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.2 }}
                    className="mt-6 text-center"
                >
                    <p className="text-white/20 text-xs">
                        Game lasted {gameState.dayCount} days • {gameState.players.filter(p => !p.isAlive).length} eliminated
                    </p>
                </motion.div>
            </motion.div>
        </div>
    );
};
