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
import { Eye, EyeOff, Check, Users, Skull, Shield, Search, Loader2, RefreshCw } from 'lucide-react';

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
        color: 'text-rose-500',
        bgColor: 'from-rose-950/50 to-rose-900/30',
        description: 'Eliminate all civilians to win. Vote by day, kill by night.'
    },
    [Role.DOCTOR]: {
        icon: <Shield className="w-16 h-16" />,
        color: 'text-teal-500',
        bgColor: 'from-teal-950/50 to-teal-900/30',
        description: 'Save one player each night from the mafia attack.'
    },
    [Role.DETECTIVE]: {
        icon: <Search className="w-16 h-16" />,
        color: 'text-sky-500',
        bgColor: 'from-sky-950/50 to-sky-900/30',
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

export const RoleReveal: React.FC = React.memo(() => {
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

        // V4: Restore keys on mount if missing (Refresh handling)
        if (myPlayer) {
            const shuffleService = getShuffleService();
            if (!shuffleService.hasKeys()) {
                const loaded = shuffleService.loadKeys(currentRoomId.toString(), myPlayer.address);
                if (loaded) {
                    console.log("[RoleReveal] Keys recovered from local storage");
                }
            }
        }

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
    }, [publicClient, currentRoomId, findMyCardIndex, myPlayer]);

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

            // addLog(`Collected ${keys.size} decryption keys`, "info");
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
            const [isActive, hasConfirmedRole, hasVoted, hasCommitted, hasRevealed, hasSharedKeys, hasClaimedMafia] = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getPlayerFlags',
                args: [currentRoomId, address as `0x${string}`],
            }) as [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

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
    const shareMyKey = useCallback(async () => {
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

            // addLog(`Sharing keys to ${recipients.length} players...`, "info");
            await shareKeysToAllOnChain(recipients, encryptedKeys);
            setRevealState(prev => ({ ...prev, hasSharedKeys: true }));
            // addLog("All keys shared in one tx!", "success");
        } catch (e: any) {
            console.error("Failed to share keys:", e);
            addLog(e.message || "Failed to share keys", "danger");
        } finally {
            setIsProcessing(false);
        }
    }, [gameState.players, myPlayer, isProcessing, revealState.hasSharedKeys, shareKeysToAllOnChain, addLog, stringToHex]);

    // Расшифровать все карты чтобы найти союзников по роли
    const decryptAllCardsForTeammates = useCallback(async (
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
    }, [revealState.deck, revealState.myCardIndex, gameState.players]);

    // Расшифровать мою роль
    const decryptMyRole = useCallback(async () => {
        if (revealState.myCardIndex < 0 || revealState.deck.length === 0) return;

        setIsProcessing(true);
        try {
            // Собираем ключи
            const keys = await collectKeys();

            if (!keys || keys.size < gameState.players.length - 1) {
                // addLog(`Waiting for keys: ${keys?.size || 0}/${gameState.players.length - 1}`, "warning");
                setIsProcessing(false);
                return;
            }

            const shuffleService = getShuffleService();
            if (!shuffleService.hasKeys()) {
                console.log("[RoleReveal] Keys not generated, skipping decryption");
                setIsProcessing(false);
                return;
            }

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

            // Обновляем gameState с моей ролью и ролями союзников (если я мафия)
            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => {
                    const addr = p.address.toLowerCase();
                    if (addr === myPlayer?.address.toLowerCase()) {
                        return { ...p, role };
                    }
                    if (role === Role.MAFIA && teammates.some(t => t.toLowerCase() === addr)) {
                        return { ...p, role: Role.MAFIA };
                    }
                    return p;
                })
            }));

            addLog(`Your role: ${role}`, "success");
        } catch (e: any) {
            console.error("Failed to decrypt role:", e);
            addLog(e.message || "Failed to decrypt", "danger");
        } finally {
            setIsProcessing(false);
        }
    }, [revealState.myCardIndex, revealState.deck, gameState.players, myPlayer, collectKeys, addLog, setGameState, decryptAllCardsForTeammates]);



    // Подтвердить роль (с предварительным коммитом)
    const handleConfirmRole = useCallback(async () => {
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
    }, [revealState.myRole, commitAndConfirmRoleOnChain]);

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
                        <motion.div
                            key="exchange"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl pointer-events-auto"
                        >
                            <div className="text-center mb-6">
                                <Search className="w-10 h-10 text-[#916A47] mx-auto mb-3" />
                                <h2 className="text-2xl font-['Playfair_Display'] text-white mb-1">
                                    Role Reveal
                                </h2>
                                <p className="text-white/40 text-[13px]">
                                    {revealState.hasSharedKeys ? 'Keys shared. Collecting from others...' : 'Decrypting game data...'}
                                </p>
                            </div>

                            {/* Players Key Status List */}
                            <div className="space-y-1.5 mb-4 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
                                {gameState.players.map((player, index) => {
                                    const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                                    const hasKey = revealState.collectedKeys.has(player.address.toLowerCase());
                                    const isProcessingMe = isMe && isProcessing && !revealState.hasSharedKeys;

                                    return (
                                        <motion.div
                                            key={player.address}
                                            layout
                                            className={`
                                                flex items-center justify-between p-3 rounded-xl border transition-all h-12 relative overflow-hidden
                                                ${hasKey || (isMe && revealState.hasSharedKeys)
                                                    ? 'bg-[#916A47]/15 border-[#916A47]/30 shadow-[0_0_10px_rgba(145,106,71,0.1)]'
                                                    : isMe
                                                        ? 'bg-[#916A47]/20 border-[#916A47]/40'
                                                        : 'bg-white/5 border-white/10'
                                                }
                                            `}
                                        >
                                            {/* Scanner effect for active tasks */}
                                            {(isProcessingMe || (!hasKey && !isMe)) && (
                                                <motion.div
                                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                                                    animate={{ x: ['-100%', '100%'] }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                />
                                            )}

                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className={`
                                                    w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                                                    ${isMe && !revealState.hasSharedKeys ? 'bg-[#916A47] text-black' : (hasKey || (isMe && revealState.hasSharedKeys)) ? 'bg-[#916A47] text-white' : 'bg-white/10 text-white/40'}
                                                `}>
                                                    {(hasKey || (isMe && revealState.hasSharedKeys)) ? <Check className="w-3 h-3" /> : index + 1}
                                                </div>
                                                <span className={`text-sm font-medium ${(isMe && !revealState.hasSharedKeys) ? 'text-[#916A47]' : 'text-white'}`}>
                                                    {player.name} {isMe && '(You)'}
                                                </span>
                                            </div>
                                            <div className="text-[10px] relative z-10 font-mono">
                                                {(hasKey || (isMe && revealState.hasSharedKeys)) ? (
                                                    <span className="text-[#916A47] font-bold uppercase tracking-wider">Ready</span>
                                                ) : isProcessingMe ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[#916A47] font-bold">Sharing...</span>
                                                        <RefreshCw className="w-3 h-3 animate-spin text-[#916A47]" />
                                                    </div>
                                                ) : (
                                                    <span className="text-white/20 uppercase tracking-widest">Waiting</span>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Integrated Progress Bar */}
                            <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-4">
                                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#916A47]/10">
                                    <Eye className="w-4 h-4 text-[#916A47]" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
                                        <span>KEYS COLLECTED</span>
                                        <span className="font-mono text-[#916A47] font-bold">{keysCollected} / {keysNeeded}</span>
                                    </div>
                                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden p-[1px]">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-[#916A47] to-[#c9a227] rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(keysCollected / keysNeeded) * 100}%` }}
                                            transition={{ duration: 0.8 }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                                {!revealState.hasSharedKeys ? (
                                    <Button
                                        onClick={shareMyKey}
                                        isLoading={isProcessing}
                                        disabled={isProcessing || isTxPending}
                                        className="w-full h-12 text-base"
                                    >
                                        Share Decryption Key
                                    </Button>
                                ) : !revealState.isRevealed && (
                                    <div className="text-center py-2 bg-[#916A47]/5 rounded-xl border border-[#916A47]/20">
                                        <div className="flex items-center justify-center gap-2 text-[#916A47] text-sm font-medium">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>{keysCollected < keysNeeded ? `Waiting for ${keysNeeded - keysCollected} keys...` : 'All keys ready! Decrypting...'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        // Phase 2: Role Revealed
                        <motion.div
                            key="revealed"
                            initial={{ opacity: 0, rotateY: 90 }}
                            animate={{ opacity: 1, rotateY: 0 }}
                            transition={{ type: "spring", duration: 0.8 }}
                            className={`bg-gradient-to-br ${roleConfig.bgColor} backdrop-blur-xl rounded-3xl border border-white/20 p-12 shadow-2xl pointer-events-auto w-[400px] h-[400px] flex flex-col justify-between mx-auto`}
                        >
                            <div className="text-center flex-1 flex flex-col justify-center">
                                {/* Role Name */}
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className={`text-4xl font-['Playfair_Display'] mb-6 ${roleConfig.color}`}
                                >
                                    {revealState.myRole}
                                </motion.h2>

                                {/* Description */}
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="text-white/60 text-sm max-w-xs mx-auto"
                                >
                                    {roleConfig.description}
                                </motion.p>
                            </div>

                            <div className="space-y-3 mt-6">
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
                                    <div className="flex items-center justify-center gap-2 text-[#916A47] py-4">
                                        <Check className="w-5 h-5" />
                                        <span>Role Confirmed! Waiting for others...</span>
                                    </div>
                                )}

                                {/* Confirmation count */}
                                <div className="text-xs text-white/30 text-center">
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
});

RoleReveal.displayName = 'RoleReveal';

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
}> = React.memo(({ revealState, isProcessing, isTxPending, gameState, myPlayer, shareMyKey, decryptMyRole, handleConfirmRole }) => {

    const keysNeeded = gameState.players.length - 1;

    // Countdown timer for viewing role before auto-confirm
    const ROLE_VIEW_TIME = 10; // seconds
    const [countdown, setCountdown] = useState<number | null>(null);
    const [hasStartedCountdown, setHasStartedCountdown] = useState(false);

    // 1. Auto-share keys (first step)
    useEffect(() => {
        const canShare = !revealState.hasSharedKeys && !isProcessing && !isTxPending && myPlayer;

        if (canShare) {
            console.log("[RoleReveal Auto] Sharing my decryption keys...");
            shareMyKey();
        }
    }, [revealState.hasSharedKeys, isProcessing, isTxPending, myPlayer, shareMyKey]);

    // 2. Auto-decrypt role when all keys are present
    useEffect(() => {
        const canAutoDecrypt =
            revealState.hasSharedKeys &&  // Must have shared first
            !revealState.isRevealed &&
            !isProcessing &&
            !isTxPending &&
            revealState.deck.length > 0 &&
            revealState.collectedKeys.size >= keysNeeded &&
            keysNeeded > 0;  // Avoid division by zero

        // Log state for debugging
        console.log("[RoleReveal Auto] Decrypt check:", {
            hasSharedKeys: revealState.hasSharedKeys,
            isRevealed: revealState.isRevealed,
            isProcessing,
            isTxPending,
            deckLength: revealState.deck.length,
            collectedKeys: revealState.collectedKeys.size,
            keysNeeded,
            canAutoDecrypt
        });

        if (canAutoDecrypt) {
            console.log("[RoleReveal Auto] All keys collected. Decrypting role...");
            decryptMyRole();
        }
    }, [revealState.hasSharedKeys, revealState.isRevealed, revealState.collectedKeys.size, revealState.deck.length, keysNeeded, isProcessing, isTxPending, decryptMyRole]);

    // 3. Start countdown when role is revealed
    useEffect(() => {
        if (revealState.isRevealed && revealState.myRole !== null && !hasStartedCountdown && !revealState.hasConfirmed) {
            console.log("[RoleReveal Auto] Role revealed. Starting countdown...");
            setCountdown(ROLE_VIEW_TIME);
            setHasStartedCountdown(true);
        }
    }, [revealState.isRevealed, revealState.myRole, hasStartedCountdown, revealState.hasConfirmed]);

    // 4. Countdown timer tick
    useEffect(() => {
        if (countdown === null || countdown <= 0) return;

        const timer = setTimeout(() => {
            setCountdown(prev => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown]);

    // 5. Auto-confirm when countdown reaches 0
    useEffect(() => {
        const canAutoConfirm =
            countdown === 0 &&
            revealState.isRevealed &&
            !revealState.hasConfirmed &&
            !isProcessing &&
            !isTxPending &&
            revealState.myRole !== null;

        console.log("[RoleReveal Auto] Confirm check:", {
            countdown,
            isRevealed: revealState.isRevealed,
            hasConfirmed: revealState.hasConfirmed,
            isProcessing,
            isTxPending,
            myRole: revealState.myRole,
            canAutoConfirm
        });

        if (canAutoConfirm) {
            console.log("[RoleReveal Auto] Countdown finished. Auto-confirming...");
            handleConfirmRole();
        }
    }, [countdown, revealState.isRevealed, revealState.hasConfirmed, revealState.myRole, isProcessing, isTxPending, handleConfirmRole]);

    // Render countdown UI overlay
    if (countdown !== null && countdown > 0 && !revealState.hasConfirmed) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
            >
                <div className="bg-black/80 backdrop-blur-xl border border-[#916A47]/40 rounded-2xl px-6 py-4 shadow-2xl">
                    <div className="flex items-center gap-4">
                        {/* Circular countdown */}
                        <div className="relative w-14 h-14">
                            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                                {/* Background circle */}
                                <circle
                                    cx="28"
                                    cy="28"
                                    r="24"
                                    fill="none"
                                    stroke="rgba(145, 106, 71, 0.2)"
                                    strokeWidth="4"
                                />
                                {/* Progress circle */}
                                <motion.circle
                                    cx="28"
                                    cy="28"
                                    r="24"
                                    fill="none"
                                    stroke="#916A47"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={2 * Math.PI * 24}
                                    initial={{ strokeDashoffset: 0 }}
                                    animate={{ strokeDashoffset: 2 * Math.PI * 24 * (1 - countdown / ROLE_VIEW_TIME) }}
                                    transition={{ duration: 0.3 }}
                                />
                            </svg>
                            {/* Countdown number */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <motion.span
                                    key={countdown}
                                    initial={{ scale: 1.3, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-xl font-bold text-[#916A47] font-mono"
                                >
                                    {countdown}
                                </motion.span>
                            </div>
                        </div>

                        {/* Text */}
                        <div>
                            <p className="text-white font-medium text-sm">Memorize your role</p>
                            <p className="text-white/40 text-xs">Auto-confirming in {countdown}s...</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    return null;
});
