// components/game/RoleReveal.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { stringToHex, hexToString } from '../../services/cryptoUtils';
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
    hasSharedKeys: boolean;  // Track if we already shared
    teammates: string[];     // Addresses of fellow mafia members
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
        shareKeysToAllOnChain,
        commitRoleOnChain,
        confirmRoleOnChain,
        commitAndConfirmRoleOnChain,
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
        hasConfirmed: false,
        hasSharedKeys: false,
        teammates: []
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

    // V3.1: Собрать ВСЕ ключи от всех игроков - используем getAllKeysForMe
    const collectKeys = useCallback(async () => {
        if (!publicClient || !currentRoomId || !myPlayer || !address) return;

        try {
            // V3.1: getAllKeysForMe возвращает все ключи, которые другие игроки расшарили МНЕ
            const [senders, keyBytes] = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getAllKeysForMe',
                args: [currentRoomId],
                account: address,
            }) as [string[], string[]];

            const keys = new Map<string, string>();

            // Собираем все ключи от всех отправителей
            for (let i = 0; i < senders.length; i++) {
                if (keyBytes[i] && keyBytes[i] !== '0x') {
                    keys.set(senders[i], keyBytes[i]);
                }
            }

            setRevealState(prev => ({
                ...prev,
                collectedKeys: keys
            }));

            addLog(`Collected ${keys.size} decryption keys`, "info");
            return keys;
        } catch (e) {
            console.error("Failed to collect keys:", e);
            return new Map();
        }
    }, [publicClient, currentRoomId, myPlayer, address, addLog]);

    // Check if we already shared keys (from contract)
    const checkIfShared = useCallback(async () => {
        if (!publicClient || !currentRoomId || !address) return;

        // Don't overwrite optimistic UI during active transactions
        if (isProcessing || isTxPending) {
            console.log('[RoleReveal] Skipping sync: transaction in progress');
            return;
        }

        try {
            const [isActive, hasConfirmedRole, hasVoted, hasCommitted, hasRevealed, hasSharedKeys] = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getPlayerFlags',
                args: [currentRoomId, address],
            }) as [boolean, boolean, boolean, boolean, boolean, boolean];

            setRevealState(prev => ({
                ...prev,
                // Sticky true: if we know we shared/confirmed locally, keep it true even if RPC lags
                hasSharedKeys: prev.hasSharedKeys || hasSharedKeys,
                hasConfirmed: prev.hasConfirmed || hasConfirmedRole
            }));
        } catch (e) {
            console.error("Failed to check flags:", e);
        }
    }, [publicClient, currentRoomId, address, isProcessing, isTxPending]);

    // Check flags on mount and periodically
    useEffect(() => {
        checkIfShared();
        const interval = setInterval(checkIfShared, 2000);
        return () => clearInterval(interval);
    }, [checkIfShared]);

    // V3: Поделиться своим ключом со всеми (batch - одна транзакция!)
    const shareMyKey = async () => {
        if (!myPlayer || isProcessing || revealState.hasSharedKeys) return;

        setIsProcessing(true);
        try {
            const shuffleService = getShuffleService();
            const myDecryptionKey = shuffleService.getDecryptionKey();

            // V3: Собираем всех получателей и ключи в массивы
            const recipients: string[] = [];
            const encryptedKeys: string[] = [];

            for (const player of gameState.players) {
                if (player.address.toLowerCase() === myPlayer.address.toLowerCase()) continue;
                recipients.push(player.address);
                // Convert decryption key to hex bytes for Solidity
                encryptedKeys.push(stringToHex(myDecryptionKey));
            }

            addLog(`Sharing keys to ${recipients.length} players...`, "info");
            await shareKeysToAllOnChain(recipients, encryptedKeys);
            setRevealState(prev => ({ ...prev, hasSharedKeys: true }));
            addLog("All keys shared in one tx!", "success");
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
                // Convert hex bytes back to string before using as decryption key
                const decryptionKey = hexToString(key);
                myEncryptedCard = shuffleService.decryptWithKey(myEncryptedCard, decryptionKey);
            }

            // Преобразуем число в роль
            const role = ShuffleService.roleNumberToRole(myEncryptedCard);

            // Если я мафия — расшифровываем ВСЕ карты чтобы найти союзников
            let teammates: string[] = [];
            if (role === Role.MAFIA) {
                teammates = await decryptAllCardsForTeammates(keys, shuffleService, Role.MAFIA);
                if (teammates.length > 0) {
                    const names = teammates.map(addr =>
                        gameState.players.find(p => p.address.toLowerCase() === addr.toLowerCase())?.name || addr.slice(0, 8)
                    );
                    addLog(`Your fellow mafia: ${names.join(', ')}`, "info");
                }
            }

            setRevealState(prev => ({
                ...prev,
                myRole: role,
                isRevealed: true,
                teammates
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

    // Расшифровать все карты чтобы найти союзников по роли
    const decryptAllCardsForTeammates = async (
        keys: Map<string, string>,
        shuffleService: ShuffleService,
        targetRole: Role
    ): Promise<string[]> => {
        const teammates: string[] = [];

        for (let i = 0; i < revealState.deck.length; i++) {
            // Пропускаем свою карту
            if (i === revealState.myCardIndex) continue;

            try {
                let encryptedCard = revealState.deck[i];

                // Расшифровываем своим ключом
                encryptedCard = shuffleService.decrypt(encryptedCard);

                // Расшифровываем ключами других игроков
                for (const [_, key] of keys) {
                    const decryptionKey = hexToString(key);
                    encryptedCard = shuffleService.decryptWithKey(encryptedCard, decryptionKey);
                }

                const cardRole = ShuffleService.roleNumberToRole(encryptedCard);

                if (cardRole === targetRole) {
                    // Находим игрока по индексу
                    const player = gameState.players[i];
                    if (player) {
                        teammates.push(player.address);
                    }
                }
            } catch (e) {
                console.warn(`Failed to decrypt card ${i}:`, e);
            }
        }

        return teammates;
    };

    // Подтвердить роль (с предварительным коммитом)
    const handleConfirmRole = async () => {
        // Проверка, что роль расшифрована
        if (revealState.myRole === null) return;

        // Маппинг ролей (String -> Number), так как контракт ждет uint8
        // NONE=0, MAFIA=1, DOCTOR=2, DETECTIVE=3, CITIZEN=4
        const roleMap: Record<string, number> = {
            [Role.MAFIA]: 1,
            [Role.DOCTOR]: 2,
            [Role.DETECTIVE]: 3,
            [Role.CIVILIAN]: 4,
            [Role.UNKNOWN]: 0
        };

        const roleNum = roleMap[revealState.myRole] || 4; // Fallback to Citizen

        setIsProcessing(true);
        try {
            // 1. Генерируем соль
            const salt = ShuffleService.generateSalt();

            // 2. ВЫЗЫВАЕМ НОВУЮ АТОМАРНУЮ ФУНКЦИЮ (Commit + Confirm за одну транзакцию)
            await commitAndConfirmRoleOnChain(roleNum, salt);

            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
        } catch (e: any) {
            console.error(e);
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
                            className="bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl pointer-events-auto"
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
                                    isLoading={isProcessing && !revealState.hasSharedKeys}
                                    disabled={isProcessing || isTxPending || revealState.hasSharedKeys}
                                    variant="outline-gold"
                                    className="w-full"
                                >
                                    {revealState.hasSharedKeys ? (
                                        <span className="flex items-center gap-2">
                                            <Check className="w-4 h-4" /> Keys Shared
                                        </span>
                                    ) : isProcessing ? (
                                        'Auto-sharing keys...'
                                    ) : (
                                        'Share My Decryption Key'
                                    )}
                                </Button>

                                <Button
                                    onClick={decryptMyRole}
                                    isLoading={isProcessing}
                                    disabled={isProcessing || keysCollected < keysNeeded}
                                    className="w-full"
                                >
                                    {revealState.isRevealed ? (
                                        <span className="flex items-center gap-2">
                                            <Check className="w-4 h-4" /> Decrypted
                                        </span>
                                    ) : keysCollected < keysNeeded ? (
                                        `Waiting for ${keysNeeded - keysCollected} more keys...`
                                    ) : isProcessing ? (
                                        'Auto-decrypting role...'
                                    ) : (
                                        'Decrypt My Role'
                                    )}
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
                            className={`bg-gradient-to-br ${roleConfig.bgColor} backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl pointer-events-auto`}
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
                                        className="text-white/60 text-sm mb-4 max-w-xs mx-auto"
                                    >
                                        {roleConfig.description}
                                    </motion.p>
                                )}

                                {/* Mafia Teammates - shown only to mafia members */}
                                {showRole && revealState.myRole === Role.MAFIA && revealState.teammates.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.9 }}
                                        className="mb-6 p-4 bg-red-950/30 border border-red-500/30 rounded-xl"
                                    >
                                        <p className="text-red-400 text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                                            <Skull className="w-4 h-4" />
                                            Your Fellow Mafia
                                        </p>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {revealState.teammates.map(addr => {
                                                const player = gameState.players.find(p => p.address.toLowerCase() === addr.toLowerCase());
                                                return (
                                                    <span
                                                        key={addr}
                                                        className="px-3 py-1 bg-red-500/20 border border-red-500/40 rounded-full text-red-300 text-sm"
                                                    >
                                                        {player?.name || addr.slice(0, 8)}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
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
                                        {isProcessing ? 'Auto-confirming role...' : 'I Understand My Role'}
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
                {/* AUTOMATION: Role Reveal Hands-Free Flow */}
                <RoleRevealAuto
                    revealState={revealState}
                    isProcessing={isProcessing}
                    isTxPending={isTxPending}
                    gameState={gameState}
                    myPlayer={myPlayer}
                    shareMyKey={shareMyKey}
                    decryptMyRole={decryptMyRole}
                    handleConfirmRole={handleConfirmRole}
                />
            </motion.div >
        </div >
    );
};

// Help automation component to avoid dependency issues and keep main component clean
const RoleRevealAuto: React.FC<{
    revealState: RevealState,
    isProcessing: boolean,
    isTxPending: boolean,
    gameState: any,
    myPlayer: any,
    shareMyKey: () => Promise<void>,
    decryptMyRole: () => Promise<void>,
    handleConfirmRole: () => Promise<void>
}> = ({ revealState, isProcessing, isTxPending, gameState, myPlayer, shareMyKey, decryptMyRole, handleConfirmRole }) => {

    // 1. Auto-share keys
    useEffect(() => {
        if (!revealState.hasSharedKeys && !isProcessing && !isTxPending && myPlayer) {
            console.log("[RoleReveal Auto] Sharing my decryption keys...");
            shareMyKey();
        }
    }, [revealState.hasSharedKeys, isProcessing, isTxPending, myPlayer, shareMyKey]);

    // 2. Auto-decrypt role when all keys are present
    useEffect(() => {
        const keysNeeded = gameState.players.length - 1;
        const canAutoDecrypt =
            !revealState.isRevealed &&
            !isProcessing &&
            !isTxPending &&
            revealState.deck.length > 0 &&
            revealState.collectedKeys.size >= keysNeeded &&
            gameState.players.length > 0;

        if (canAutoDecrypt) {
            console.log("[RoleReveal Auto] All keys collected. Decrypting role...");
            decryptMyRole();
        }
    }, [revealState.isRevealed, revealState.collectedKeys.size, revealState.deck.length, gameState.players.length, isProcessing, isTxPending, decryptMyRole]);

    // 3. Auto-confirm role once revealed
    useEffect(() => {
        if (revealState.isRevealed && !revealState.hasConfirmed && !isProcessing && !isTxPending && revealState.myRole) {
            console.log("[RoleReveal Auto] Role revealed. Auto-confirming...");
            handleConfirmRole();
        }
    }, [revealState.isRevealed, revealState.hasConfirmed, revealState.myRole, isProcessing, isTxPending, handleConfirmRole]);

    return null;
};
