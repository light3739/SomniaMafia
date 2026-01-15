// components/game/GameOver.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient, useAccount } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { hexToString } from '../../services/cryptoUtils';
import { Role } from '../../types';
import { Button } from '../ui/Button';
import { Trophy, Skull, Users, Shield, Search, Home, RotateCcw, Eye } from 'lucide-react';

const RoleIcons: Record<Role, React.ReactNode> = {
    [Role.MAFIA]: <Skull className="w-5 h-5 text-red-500" />,
    [Role.MANIAC]: <Skull className="w-5 h-5 text-purple-500" />,
    [Role.DOCTOR]: <Shield className="w-5 h-5 text-green-500" />,
    [Role.DETECTIVE]: <Search className="w-5 h-5 text-blue-500" />,
    [Role.CIVILIAN]: <Users className="w-5 h-5 text-amber-500" />,
    [Role.UNKNOWN]: <Users className="w-5 h-5 text-gray-500" />
};

const RoleColors: Record<Role, string> = {
    [Role.MAFIA]: 'text-red-400',
    [Role.MANIAC]: 'text-purple-400',
    [Role.DOCTOR]: 'text-green-400',
    [Role.DETECTIVE]: 'text-blue-400',
    [Role.CIVILIAN]: 'text-amber-400',
    [Role.UNKNOWN]: 'text-gray-400'
};

const RoleBgColors: Record<Role, string> = {
    [Role.MAFIA]: 'bg-red-900/50',
    [Role.MANIAC]: 'bg-purple-900/50',
    [Role.DOCTOR]: 'bg-green-900/50',
    [Role.DETECTIVE]: 'bg-blue-900/50',
    [Role.CIVILIAN]: 'bg-amber-900/50',
    [Role.UNKNOWN]: 'bg-gray-900/50'
};

type Winner = 'MAFIA' | 'MANIAC' | 'TOWN' | 'DRAW';

export const GameOver: React.FC = () => {
    const { gameState, myPlayer, currentRoomId, setGameState } = useGameContext();
    const publicClient = usePublicClient();
    const { address } = useAccount();
    const navigate = useNavigate();
    const [revealedRoles, setRevealedRoles] = useState<Map<string, Role>>(new Map());
    const [isRevealing, setIsRevealing] = useState(false);
    const [winner, setWinner] = useState<Winner>('DRAW');

    // Расшифровать все роли в конце игры
    const revealAllRoles = useCallback(async () => {
        if (!publicClient || !currentRoomId || isRevealing) return;
        
        setIsRevealing(true);
        try {
            // Получаем колоду одним вызовом
            const deck = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getDeck',
                args: [currentRoomId],
            }) as string[];
            
            // Собираем ключи от всех игроков
            const keys = new Map<string, string>();
            for (const player of gameState.players) {
                if (player.address.toLowerCase() === address?.toLowerCase()) continue;
                try {
                    const key = await publicClient.readContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'playerDeckKeys',
                        args: [currentRoomId, player.address, address],
                    }) as `0x${string}`;
                    if (key && key !== '0x') {
                        keys.set(player.address, key);
                    }
                } catch { }
            }
            
            const shuffleService = getShuffleService();
            const roles = new Map<string, Role>();
            
            // Расшифровываем все карты
            for (let i = 0; i < deck.length && i < gameState.players.length; i++) {
                try {
                    let encryptedCard = deck[i];
                    
                    // Расшифровываем своим ключом
                    encryptedCard = shuffleService.decrypt(encryptedCard);
                    
                    // Расшифровываем ключами других
                    for (const [_, key] of keys) {
                        const decryptionKey = hexToString(key);
                        encryptedCard = shuffleService.decryptWithKey(encryptedCard, decryptionKey);
                    }
                    
                    const role = ShuffleService.roleNumberToRole(encryptedCard);
                    roles.set(gameState.players[i].address.toLowerCase(), role);
                } catch (e) {
                    console.warn(`Failed to decrypt card ${i}:`, e);
                }
            }
            
            setRevealedRoles(roles);
            
            // Обновляем gameState с раскрытыми ролями
            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => ({
                    ...p,
                    role: roles.get(p.address.toLowerCase()) || p.role
                }))
            }));
            
            // Определяем победителя
            determineWinner(roles);
            
        } catch (e) {
            console.error("Failed to reveal roles:", e);
        } finally {
            setIsRevealing(false);
        }
    }, [publicClient, currentRoomId, gameState.players, address, setGameState, isRevealing]);

    // Определяем победителя на основе раскрытых ролей
    const determineWinner = (roles: Map<string, Role>) => {
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        
        let aliveMafia = 0;
        let aliveManiac = 0;
        let aliveTown = 0; // civilian + doctor + detective
        
        for (const player of alivePlayers) {
            const role = roles.get(player.address.toLowerCase()) || player.role;
            if (role === Role.MAFIA) aliveMafia++;
            else if (role === Role.MANIAC) aliveManiac++;
            else if (role !== Role.UNKNOWN) aliveTown++;
        }
        
        // Условия победы:
        // MANIAC wins: только маньяк жив (или маньяк + 1 город и нет мафии)
        // MAFIA wins: мафия >= город И маньяк мёртв
        // TOWN wins: мафия = 0 И маньяк = 0
        // DRAW: никто не выжил
        
        if (alivePlayers.length === 0) {
            setWinner('DRAW');
        } else if (aliveManiac > 0 && aliveMafia === 0 && aliveTown <= 1) {
            setWinner('MANIAC');
        } else if (aliveMafia > 0 && aliveMafia >= aliveTown && aliveManiac === 0) {
            setWinner('MAFIA');
        } else if (aliveMafia === 0 && aliveManiac === 0) {
            setWinner('TOWN');
        } else {
            // Игра должна продолжаться, но раз мы в GameOver - значит что-то пошло не так
            setWinner('DRAW');
        }
    };

    // Reveal на монтирование
    useEffect(() => {
        revealAllRoles();
    }, [revealAllRoles]);

    const myRole = revealedRoles.get(myPlayer?.address.toLowerCase() || '') || myPlayer?.role || Role.UNKNOWN;
    
    const didIWin = 
        (winner === 'MAFIA' && myRole === Role.MAFIA) ||
        (winner === 'MANIAC' && myRole === Role.MANIAC) ||
        (winner === 'TOWN' && (myRole === Role.CIVILIAN || myRole === Role.DOCTOR || myRole === Role.DETECTIVE));

    const winnerConfig = {
        'MAFIA': { 
            title: 'Mafia Wins!', 
            description: 'The mafia has taken control of the town...', 
            color: 'text-red-400',
            bg: 'from-red-950/50 to-red-900/30 border-red-500/30',
            trophy: 'text-red-500'
        },
        'MANIAC': { 
            title: 'Maniac Wins!', 
            description: 'The lone killer stands victorious...', 
            color: 'text-purple-400',
            bg: 'from-purple-950/50 to-purple-900/30 border-purple-500/30',
            trophy: 'text-purple-500'
        },
        'TOWN': { 
            title: 'Town Wins!', 
            description: 'Justice prevails! All evil has been eliminated.', 
            color: 'text-amber-400',
            bg: 'from-amber-950/50 to-amber-900/30 border-amber-500/30',
            trophy: 'text-amber-500'
        },
        'DRAW': { 
            title: 'Draw!', 
            description: 'No one survived...', 
            color: 'text-gray-400',
            bg: 'from-gray-950/50 to-gray-900/30 border-gray-500/30',
            trophy: 'text-gray-500'
        }
    };

    const config = winnerConfig[winner];

    const handlePlayAgain = () => {
        sessionStorage.removeItem('currentRoomId');
        navigate('/setup');
    };

    const handleHome = () => {
        sessionStorage.removeItem('currentRoomId');
        navigate('/');
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
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
                    className={`text-center p-8 rounded-3xl mb-8 bg-gradient-to-br ${config.bg} border`}
                >
                    <motion.div
                        initial={{ rotate: -180, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ delay: 0.4, type: "spring" }}
                        className="mb-4"
                    >
                        <Trophy className={`w-20 h-20 mx-auto ${config.trophy}`} />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className={`text-4xl md:text-5xl font-['Playfair_Display'] mb-2 ${config.color}`}
                    >
                        {config.title}
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-white/60"
                    >
                        {config.description}
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
                    <div className="flex items-center gap-2 mb-4">
                        <Eye className="w-5 h-5 text-[#916A47]" />
                        <h3 className="text-white/50 text-sm uppercase tracking-wider">All Roles Revealed</h3>
                        {isRevealing && <span className="text-xs text-white/30">(decrypting...)</span>}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {gameState.players.map((player, index) => {
                            const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                            const isDead = !player.isAlive;
                            const role = revealedRoles.get(player.address.toLowerCase()) || player.role;
                            const roleKnown = role !== Role.UNKNOWN;

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
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${RoleBgColors[role]}`}>
                                            {RoleIcons[role]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium truncate ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                                {player.name} {isMe && '(You)'}
                                            </p>
                                            <p className={`text-xs ${roleKnown ? RoleColors[role] : 'text-gray-500'}`}>
                                                {roleKnown ? role : '🔒 Encrypted'}
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
