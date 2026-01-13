// components/game/RoleReveal.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { usePublicClient, useAccount } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { Role, GamePhase } from '../../types';
import { Button } from '../ui/Button';
import { Eye, EyeOff, Check, Users, Skull, Shield, Search, Loader2 } from 'lucide-react';

interface RevealState {
    deck: string[];
    collectedKeys: Map<string, string>; // address -> decryption key
    myCardIndex: number;
    myRole: Role | null;
    isRevealed: boolean;
    hasConfirmed: boolean;
}

const RoleConfig: Record<Role, { icon: React.ReactNode; color: string; bgColor: string; description: string }> = {
    [Role.MAFIA]: {
        icon: <Skull className="w-16 h-16" />,
        color: 'text-red-500',
        bgColor: 'from-red-950/50 to-red-900/30',
        description: 'Eliminate all civilians to win. Vote by day, kill by night.'
    },
    [Role.DOCTOR]: {
        icon: <Shield className="w-16 h-16" />,
        color: 'text-green-500',
        bgColor: 'from-green-950/50 to-green-900/30',
        description: 'Save one player each night from the mafia attack.'
    },
    [Role.DETECTIVE]: {
        icon: <Search className="w-16 h-16" />,
        color: 'text-blue-500',
        bgColor: 'from-blue-950/50 to-blue-900/30',
        description: 'Investigate one player each night to reveal their alignment.'
    },
    [Role.CIVILIAN]: {
        icon: <Users className="w-16 h-16" />,
        color: 'text-amber-500',
        bgColor: 'from-amber-950/50 to-amber-900/30',
        description: 'Find and vote out the mafia during the day to survive.'
    },
    [Role.UNKNOWN]: {
        icon: <EyeOff className="w-16 h-16" />,
        color: 'text-gray-500',
        bgColor: 'from-gray-950/50 to-gray-900/30',
        description: 'Role unknown'
    }
};

export const RoleReveal: React.FC = () => {
    const { 
        gameState, 
        currentRoomId, 
        myPlayer,
        shareKeyOnChain,
        confirmRoleOnChain,
        addLog,
        isTxPending,
        setGameState
    } = useGameContext();
    
    const publicClient = usePublicClient();
    const { address } = useAccount();
    const [revealState, setRevealState] = useState<RevealState>({
        deck: [],
        collectedKeys: new Map(),
        myCardIndex: -1,
        myRole: null,
        isRevealed: false,
        hasConfirmed: false
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [showRole, setShowRole] = useState(false);

    // Синхронизируем локальный hasConfirmed с данными из контракта
    useEffect(() => {
        if (myPlayer?.hasConfirmedRole && !revealState.hasConfirmed) {
            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
        }
    }, [myPlayer?.hasConfirmedRole, revealState.hasConfirmed]);

    // Найти индекс моей карты в колоде
    const findMyCardIndex = useCallback((): number => {
        if (!myPlayer) return -1;
        const myIndex = gameState.players.findIndex(
            p => p.address.toLowerCase() === myPlayer.address.toLowerCase()
        );
        return myIndex;
    }, [gameState.players, myPlayer]);

    // Получить колоду из контракта
    const fetchDeck = useCallback(async () => {
        if (!publicClient || !currentRoomId) return;

        try {
            const deck = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getDeck',
                args: [currentRoomId],
            }) as string[];

            const myCardIndex = findMyCardIndex();

            setRevealState(prev => ({
                ...prev,
                deck,
                myCardIndex
            }));
        } catch (e) {
            console.error("Failed to fetch deck:", e);
        }
    }, [publicClient, currentRoomId, findMyCardIndex]);

    // Собрать ключи от других игроков
    const collectKeys = useCallback(async () => {
        if (!publicClient || !currentRoomId || !myPlayer || !address) return;

        const keys = new Map<string, string>();

        for (const player of gameState.players) {
            if (player.address.toLowerCase() === myPlayer.address.toLowerCase()) continue;

            try {
                // Важно: передаём account чтобы контракт знал кто вызывает (для msg.sender в getKeyFrom)
                const key = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'getKeyFrom',
                    args: [currentRoomId, player.address],
                    account: address, // <-- Критически важно!
                }) as string;

                if (key && key !== '') {
                    keys.set(player.address.toLowerCase(), key);
                }
            } catch (e) {
                // Ключ ещё не отправлен
            }
        }

        setRevealState(prev => ({
            ...prev,
            collectedKeys: keys
        }));

        return keys;
    }, [publicClient, currentRoomId, myPlayer, gameState.players, address]);

    // Поделиться своим ключом со всеми
    const shareMyKey = async () => {
        if (!myPlayer || isProcessing) return;

        setIsProcessing(true);
        try {
            const shuffleService = getShuffleService();
            const myDecryptionKey = shuffleService.getDecryptionKey();

            // Отправляем ключ каждому игроку
            for (const player of gameState.players) {
                if (player.address.toLowerCase() === myPlayer.address.toLowerCase()) continue;
                
                addLog(`Sharing key with ${player.name}...`, "info");
                await shareKeyOnChain(player.address, myDecryptionKey);
            }

            addLog("All keys shared!", "success");
        } catch (e: any) {
            console.error("Failed to share keys:", e);
            addLog(e.message || "Failed to share keys", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // Расшифровать мою роль
    const decryptMyRole = async () => {
        if (revealState.myCardIndex < 0 || revealState.deck.length === 0) return;

        setIsProcessing(true);
        try {
            // Собираем ключи
            const keys = await collectKeys();
            
            if (!keys || keys.size < gameState.players.length - 1) {
                addLog(`Waiting for keys: ${keys?.size || 0}/${gameState.players.length - 1}`, "warning");
                setIsProcessing(false);
                return;
            }

            const shuffleService = getShuffleService();
            let myEncryptedCard = revealState.deck[revealState.myCardIndex];

            // Расшифровываем своим ключом
            myEncryptedCard = shuffleService.decrypt(myEncryptedCard);

            // Расшифровываем ключами других игроков
            for (const [_, key] of keys) {
                myEncryptedCard = shuffleService.decryptWithKey(myEncryptedCard, key);
            }

            // Преобразуем число в роль
            const role = ShuffleService.roleNumberToRole(myEncryptedCard);

            setRevealState(prev => ({
                ...prev,
                myRole: role,
                isRevealed: true
            }));

            // Обновляем gameState с моей ролью
            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => 
                    p.address.toLowerCase() === myPlayer?.address.toLowerCase()
                        ? { ...p, role }
                        : p
                )
            }));

            addLog(`Your role: ${role}`, "success");
        } catch (e: any) {
            console.error("Failed to decrypt role:", e);
            addLog(e.message || "Failed to decrypt", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // Подтвердить роль
    const handleConfirmRole = async () => {
        setIsProcessing(true);
        try {
            await confirmRoleOnChain();
            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
        } catch (e: any) {
            addLog(e.message || "Failed to confirm", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchDeck();
    }, [fetchDeck]);

    // Polling for keys
    useEffect(() => {
        const interval = setInterval(collectKeys, 3000);
        return () => clearInterval(interval);
    }, [collectKeys]);

    const roleConfig = revealState.myRole ? RoleConfig[revealState.myRole] : RoleConfig[Role.UNKNOWN];
    const keysCollected = revealState.collectedKeys.size;
    const keysNeeded = gameState.players.length - 1;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg w-full"
            >
                <AnimatePresence mode="wait">
                    {!revealState.isRevealed ? (
                        // Phase 1: Key Exchange
                        <motion.div
                            key="exchange"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl"
                        >
                            <div className="text-center mb-8">
                                <Eye className="w-12 h-12 text-[#916A47] mx-auto mb-4" />
                                <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                                    Role Reveal
                                </h2>
                                <p className="text-white/50 text-sm">
                                    Exchange decryption keys to reveal your role
                                </p>
                            </div>

                            {/* Progress */}
                            <div className="mb-6">
                                <div className="flex justify-between text-xs text-white/40 mb-2">
                                    <span>Keys Collected</span>
                                    <span>{keysCollected} / {keysNeeded}</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-[#916A47] to-[#c9a227]"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(keysCollected / keysNeeded) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                                <Button
                                    onClick={shareMyKey}
                                    isLoading={isProcessing && !revealState.isRevealed}
                                    disabled={isProcessing || isTxPending}
                                    variant="outline-gold"
                                    className="w-full"
                                >
                                    Share My Decryption Key
                                </Button>
                                
                                <Button
                                    onClick={decryptMyRole}
                                    isLoading={isProcessing}
                                    disabled={isProcessing || keysCollected < keysNeeded}
                                    className="w-full"
                                >
                                    {keysCollected < keysNeeded 
                                        ? `Waiting for ${keysNeeded - keysCollected} more keys...`
                                        : 'Decrypt My Role'
                                    }
                                </Button>
                            </div>

                            {/* Players status */}
                            <div className="mt-6 pt-4 border-t border-white/10">
                                <p className="text-xs text-white/30 mb-3">Key Status:</p>
                                <div className="flex flex-wrap gap-2">
                                    {gameState.players.map(player => {
                                        const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                                        const hasKey = revealState.collectedKeys.has(player.address.toLowerCase());
                                        
                                        return (
                                            <div
                                                key={player.address}
                                                className={`
                                                    px-2 py-1 rounded-full text-xs flex items-center gap-1
                                                    ${isMe 
                                                        ? 'bg-[#916A47]/30 text-[#916A47]' 
                                                        : hasKey 
                                                            ? 'bg-green-900/30 text-green-400'
                                                            : 'bg-white/5 text-white/30'
                                                    }
                                                `}
                                            >
                                                {hasKey && <Check className="w-3 h-3" />}
                                                {player.name.slice(0, 8)}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        // Phase 2: Role Revealed
                        <motion.div
                            key="revealed"
                            initial={{ opacity: 0, rotateY: 90 }}
                            animate={{ opacity: 1, rotateY: 0 }}
                            transition={{ type: "spring", duration: 0.8 }}
                            className={`bg-gradient-to-br ${roleConfig.bgColor} backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl`}
                        >
                            <div className="text-center">
                                {/* Role Icon */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.3, type: "spring" }}
                                    className={`${roleConfig.color} mb-6`}
                                >
                                    {showRole ? roleConfig.icon : <EyeOff className="w-16 h-16 mx-auto text-white/30" />}
                                </motion.div>

                                {/* Role Name */}
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 }}
                                    className={`text-4xl font-['Playfair_Display'] mb-4 ${showRole ? roleConfig.color : 'text-white/30'}`}
                                >
                                    {showRole ? revealState.myRole : '???'}
                                </motion.h2>

                                {/* Description */}
                                {showRole && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.7 }}
                                        className="text-white/60 text-sm mb-8 max-w-xs mx-auto"
                                    >
                                        {roleConfig.description}
                                    </motion.p>
                                )}

                                {/* Toggle visibility */}
                                <Button
                                    onClick={() => setShowRole(!showRole)}
                                    variant="outline-gold"
                                    className="mb-4"
                                >
                                    {showRole ? (
                                        <><EyeOff className="w-4 h-4 mr-2" /> Hide Role</>
                                    ) : (
                                        <><Eye className="w-4 h-4 mr-2" /> Show Role</>
                                    )}
                                </Button>

                                {/* Confirm Button */}
                                {!revealState.hasConfirmed ? (
                                    <Button
                                        onClick={handleConfirmRole}
                                        isLoading={isProcessing || isTxPending}
                                        disabled={isProcessing || isTxPending}
                                        className="w-full"
                                    >
                                        I Understand My Role
                                    </Button>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 text-green-400 py-4">
                                        <Check className="w-5 h-5" />
                                        <span>Role Confirmed! Waiting for others...</span>
                                    </div>
                                )}

                                {/* Confirmation count */}
                                <div className="mt-4 text-xs text-white/30">
                                    {gameState.players.filter(p => p.hasConfirmedRole).length} / {gameState.players.length} confirmed
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
