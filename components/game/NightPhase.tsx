// components/game/NightPhase.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient, useAccount } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { hexToString } from '../../services/cryptoUtils';
import { Role, Player } from '../../types';
import { Button } from '../ui/Button';
import { Moon, Skull, Shield, Search, Eye, Check, Clock, User, Lock, AlertCircle } from 'lucide-react';

// Night action types matching contract enum
enum NightActionType {
    NONE = 0,
    KILL = 1,
    HEAL = 2,
    CHECK = 3
}

interface NightState {
    hasCommitted: boolean;
    hasRevealed: boolean;
    commitHash: string | null;
    salt: string | null;
    investigationResult: Role | null; // Detective's investigation result
    teammates: string[]; // Fellow mafia members (addresses)
    committedTarget: string | null; // Store the committed target
}

const RoleActions: Record<Role, { action: NightActionType; label: string; icon: React.ReactNode; color: string }> = {
    [Role.MAFIA]: {
        action: NightActionType.KILL,
        label: 'Kill',
        icon: <Skull className="w-5 h-5" />,
        color: 'text-red-500'
    },
    [Role.MANIAC]: {
        action: NightActionType.KILL,
        label: 'Murder',
        icon: <Skull className="w-5 h-5" />,
        color: 'text-purple-500'
    },
    [Role.DOCTOR]: {
        action: NightActionType.HEAL,
        label: 'Protect',
        icon: <Shield className="w-5 h-5" />,
        color: 'text-green-500'
    },
    [Role.DETECTIVE]: {
        action: NightActionType.CHECK,
        label: 'Investigate',
        icon: <Search className="w-5 h-5" />,
        color: 'text-blue-500'
    },
    [Role.CIVILIAN]: {
        action: NightActionType.NONE,
        label: 'Sleep',
        icon: <Moon className="w-5 h-5" />,
        color: 'text-gray-500'
    },
    [Role.UNKNOWN]: {
        action: NightActionType.NONE,
        label: 'Wait',
        icon: <Moon className="w-5 h-5" />,
        color: 'text-gray-500'
    }
};

export const NightPhase: React.FC = () => {
    const {
        gameState,
        myPlayer,
        commitNightActionOnChain,
        revealNightActionOnChain,
        addLog,
        isTxPending,
        selectedTarget,
        setSelectedTarget,
        currentRoomId
    } = useGameContext();

    const [nightState, setNightState] = useState<NightState>({
        hasCommitted: false,
        hasRevealed: false,
        commitHash: null,
        salt: null,
        investigationResult: null,
        teammates: [],
        committedTarget: null
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const publicClient = usePublicClient();
    const { address } = useAccount();

    // Sync with contract flags (hasCommitted, hasRevealed)
    const syncWithContract = useCallback(async () => {
        if (!publicClient || !currentRoomId || !address) return;

        try {
            const [isActive, hasConfirmedRole, hasVoted, hasCommitted, hasRevealed, hasSharedKeys] = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getPlayerFlags',
                args: [currentRoomId, address],
            }) as [boolean, boolean, boolean, boolean, boolean, boolean];

            setNightState(prev => ({
                ...prev,
                hasCommitted,
                hasRevealed
            }));
        } catch (e) {
            console.error("Failed to sync night state:", e);
        }
    }, [publicClient, currentRoomId, address]);

    // Sync on mount and periodically
    useEffect(() => {
        syncWithContract();
        const interval = setInterval(syncWithContract, 2000);
        return () => clearInterval(interval);
    }, [syncWithContract]);

    // Моя роль
    const myRole = myPlayer?.role || Role.UNKNOWN;
    const roleConfig = RoleActions[myRole];
    const canAct = roleConfig.action !== NightActionType.NONE;

    // Get selected player name (from side card selection)
    const selectedPlayer = gameState.players.find(p => p.address === selectedTarget);

    // Storage key for night commit data
    const NIGHT_COMMIT_KEY = `mafia_night_commit_${currentRoomId}_${address}`;

    // Load mafia teammates on mount (only for mafia role)
    const loadMafiaTeammates = useCallback(async () => {
        if (!publicClient || !currentRoomId || !myPlayer || myRole !== Role.MAFIA) return;
        if (nightState.teammates.length > 0) return; // Already loaded

        try {
            // Get deck from contract
            const deck = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getDeck',
                args: [currentRoomId],
            }) as string[];

            // Get all keys shared with me
            const [senders, keyBytes] = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getAllKeysForMe',
                args: [currentRoomId],
                account: address,
            }) as [string[], string[]];

            const keys = new Map<string, string>();
            for (let i = 0; i < senders.length; i++) {
                if (keyBytes[i] && keyBytes[i] !== '0x') {
                    keys.set(senders[i], keyBytes[i]);
                }
            }

            // Find my card index
            const myCardIndex = gameState.players.findIndex(
                p => p.address.toLowerCase() === myPlayer.address.toLowerCase()
            );

            const shuffleService = getShuffleService();
            const teammates: string[] = [];

            // Decrypt all cards to find fellow mafia
            for (let i = 0; i < deck.length; i++) {
                if (i === myCardIndex) continue; // Skip my own card

                try {
                    let encryptedCard = deck[i];

                    // Decrypt with my key
                    encryptedCard = shuffleService.decrypt(encryptedCard);

                    // Decrypt with other players' keys
                    for (const [_, key] of keys) {
                        const decryptionKey = hexToString(key);
                        encryptedCard = shuffleService.decryptWithKey(encryptedCard, decryptionKey);
                    }

                    const cardRole = ShuffleService.roleNumberToRole(encryptedCard);

                    if (cardRole === Role.MAFIA) {
                        const player = gameState.players[i];
                        if (player && player.isAlive) {
                            teammates.push(player.address);
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to decrypt card ${i}:`, e);
                }
            }

            if (teammates.length > 0) {
                setNightState(prev => ({ ...prev, teammates }));
                const names = teammates.map(addr =>
                    gameState.players.find(p => p.address.toLowerCase() === addr.toLowerCase())?.name || addr.slice(0, 8)
                );
                addLog(`Your mafia allies: ${names.join(', ')}`, "info");
            }
        } catch (e) {
            console.error("Failed to load mafia teammates:", e);
        }
    }, [publicClient, currentRoomId, myPlayer, myRole, address, gameState.players, nightState.teammates.length, addLog]);

    // Load teammates when mafia enters night phase
    useEffect(() => {
        if (myRole === Role.MAFIA) {
            loadMafiaTeammates();
        }
    }, [myRole, loadMafiaTeammates]);

    // Load saved commit data from localStorage on mount
    useEffect(() => {
        if (!currentRoomId || !address) return;

        const saved = localStorage.getItem(NIGHT_COMMIT_KEY);
        if (saved) {
            try {
                const { salt, commitHash, committedTarget } = JSON.parse(saved);
                setNightState(prev => ({
                    ...prev,
                    salt,
                    commitHash,
                    committedTarget
                }));
            } catch (e) {
                console.error("Failed to load night commit data:", e);
            }
        }
    }, [currentRoomId, address, NIGHT_COMMIT_KEY]);

    // Commit action
    const handleCommit = async () => {
        if (!selectedTarget || nightState.hasCommitted) return;

        // Check if we're actually in NIGHT phase
        if (gameState.phase !== 5) { // 5 = NIGHT
            addLog(`Cannot commit: game is in phase ${gameState.phase}, not NIGHT (5)`, "danger");
            console.error('[Night] Wrong phase for commit:', gameState.phase);
            return;
        }

        setIsProcessing(true);
        try {
            // Генерируем соль
            const salt = ShuffleService.generateSalt();

            // Создаём хэш: keccak256(abi.encodePacked(action, target, salt))
            const hash = ShuffleService.createCommitHash(
                roleConfig.action,
                selectedTarget,
                salt
            );

            // DEBUG: Log commit details
            console.log('[Night Commit]', {
                action: roleConfig.action,
                target: selectedTarget,
                salt: salt,
                hash: hash
            });

            // Отправляем хэш в контракт СНАЧАЛА
            await commitNightActionOnChain(hash);

            // Только после успешного commit сохраняем данные
            localStorage.setItem(NIGHT_COMMIT_KEY, JSON.stringify({
                salt,
                commitHash: hash,
                committedTarget: selectedTarget,
                action: roleConfig.action
            }));

            // Сохраняем локально для reveal
            setNightState(prev => ({
                ...prev,
                commitHash: hash,
                salt: salt,
                hasCommitted: true,
                committedTarget: selectedTarget
            }));

            addLog("Night action committed!", "success");
        } catch (e: any) {
            console.error("Commit failed:", e);
            addLog(e.message || "Commit failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // Decrypt target's role (for Detective)
    const decryptTargetRole = useCallback(async (targetAddress: string): Promise<Role | null> => {
        if (!publicClient || !currentRoomId) return null;

        try {
            // Find target's index in players array
            const targetIndex = gameState.players.findIndex(
                p => p.address.toLowerCase() === targetAddress.toLowerCase()
            );
            if (targetIndex < 0) return null;

            // Get deck from contract
            const deckLength = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getDeckLength',
                args: [currentRoomId],
            }) as bigint;

            const deck: string[] = [];
            for (let i = 0; i < Number(deckLength); i++) {
                const card = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'roomDeck',
                    args: [currentRoomId, BigInt(i)],
                }) as string;
                deck.push(card);
            }

            if (targetIndex >= deck.length) return null;

            // Collect all keys
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
            let encryptedCard = deck[targetIndex];

            // Decrypt with my key
            encryptedCard = shuffleService.decrypt(encryptedCard);

            // Decrypt with others' keys
            for (const [_, key] of keys) {
                const decryptionKey = hexToString(key);
                encryptedCard = shuffleService.decryptWithKey(encryptedCard, decryptionKey);
            }

            return ShuffleService.roleNumberToRole(encryptedCard);
        } catch (e) {
            console.error("Failed to decrypt target role:", e);
            return null;
        }
    }, [publicClient, currentRoomId, gameState.players, address]);

    // Reveal action
    const handleReveal = async () => {
        if (!nightState.committedTarget || !nightState.salt || nightState.hasRevealed) return;

        // DEBUG: Log reveal details
        console.log('[Night Reveal]', {
            action: roleConfig.action,
            target: nightState.committedTarget,
            salt: nightState.salt,
            expectedHash: nightState.commitHash
        });

        setIsProcessing(true);
        try {
            await revealNightActionOnChain(
                roleConfig.action,
                nightState.committedTarget,
                nightState.salt
            );

            // Clear localStorage after successful reveal
            localStorage.removeItem(NIGHT_COMMIT_KEY);

            // If detective, decrypt target's role
            let investigationResult: Role | null = null;
            if (myRole === Role.DETECTIVE && roleConfig.action === NightActionType.CHECK) {
                investigationResult = await decryptTargetRole(nightState.committedTarget || '');
                if (investigationResult) {
                    const targetName = gameState.players.find(
                        p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase()
                    )?.name || 'Unknown';
                    addLog(`Investigation: ${targetName} is ${investigationResult}!`, "success");
                }
            }

            setNightState(prev => ({
                ...prev,
                hasRevealed: true,
                investigationResult
            }));
            setSelectedTarget(null); // Clear selection after reveal
            addLog("Night action revealed!", "success");
        } catch (e: any) {
            console.error("Reveal failed:", e);
            addLog(e.message || "Reveal failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // Civilians just wait - show blocked UI
    if (!canAct) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-indigo-950/30 backdrop-blur-xl rounded-3xl border border-indigo-500/20 p-8 text-center"
                >
                    {/* Lock Icon */}
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.5, 1, 0.5],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="relative mx-auto mb-6 w-fit"
                    >
                        <Moon className="w-16 h-16 text-indigo-400" />
                        <div className="absolute -bottom-1 -right-1 bg-indigo-900/80 rounded-full p-1">
                            <Lock className="w-5 h-5 text-indigo-300" />
                        </div>
                    </motion.div>

                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                        Night Phase
                    </h2>
                    <p className="text-white/50 text-sm mb-4">
                        You are a <span className="text-indigo-300 font-medium">{myRole}</span>.
                        You have no night abilities.
                    </p>

                    {/* Blocked message */}
                    <div className="bg-indigo-900/30 rounded-xl p-4 border border-indigo-500/20 mb-4">
                        <div className="flex items-center justify-center gap-2 text-indigo-300 mb-2">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm font-medium">Actions locked</span>
                        </div>
                        <p className="text-indigo-200/50 text-xs">
                            Close your eyes and wait for dawn
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-indigo-300">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-sm">Others are making their moves...</span>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Active role UI (Mafia/Doctor/Detective) - NO central grid, use side cards
    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-lg w-full"
            >
                {/* Header */}
                <div className="text-center mb-6">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-white/10 mb-4`}>
                        <span className={roleConfig.color}>{roleConfig.icon}</span>
                        <span className={`font-bold ${roleConfig.color}`}>{myRole}</span>
                    </div>

                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                        {myRole === Role.MAFIA && 'Choose your victim'}
                        {myRole === Role.DOCTOR && 'Choose who to protect'}
                        {myRole === Role.DETECTIVE && 'Choose who to investigate'}
                    </h2>
                    <p className="text-white/50 text-sm">
                        {myRole === Role.MAFIA && 'Choose your target to eliminate'}
                        {myRole === Role.MANIAC && 'Choose your victim - you work alone!'}
                        {myRole === Role.DOCTOR && 'Choose a player to protect tonight'}
                        {myRole === Role.DETECTIVE && 'Choose a player to investigate'}
                    </p>
                </div>

                {/* Mafia Teammates */}
                {myRole === Role.MAFIA && nightState.teammates.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-4 bg-red-950/30 border border-red-500/30 rounded-2xl"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Skull className="w-4 h-4 text-red-500" />
                            <span className="text-red-400 text-sm font-medium">Your Fellow Mafia</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {nightState.teammates.map(addr => {
                                const teammate = gameState.players.find(p => p.address.toLowerCase() === addr.toLowerCase());
                                return (
                                    <span
                                        key={addr}
                                        className={`px-3 py-1 rounded-full text-sm ${teammate?.isAlive
                                            ? 'bg-red-900/50 text-red-300 border border-red-500/30'
                                            : 'bg-gray-900/50 text-gray-500 border border-gray-500/30 line-through'
                                            }`}
                                    >
                                        {teammate?.name || addr.slice(0, 8)}
                                    </span>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Selected Target Display */}
                <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Selected Target</p>
                    <p className="text-white/30 text-[10px] mb-3">Click on a player card on the sides to select</p>

                    {selectedTarget && selectedPlayer ? (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`p-4 rounded-xl border-2 ${myRole === Role.MAFIA ? 'bg-red-900/20 border-red-500/50' :
                                myRole === Role.DOCTOR ? 'bg-green-900/20 border-green-500/50' :
                                    'bg-blue-900/20 border-blue-500/50'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${myRole === Role.MAFIA ? 'bg-red-500/30' :
                                        myRole === Role.DOCTOR ? 'bg-green-500/30' :
                                            'bg-blue-500/30'
                                        }`}>
                                        {roleConfig.icon}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">{selectedPlayer.name}</p>
                                        <p className="text-white/40 text-xs font-mono">
                                            {selectedPlayer.address.slice(0, 6)}...{selectedPlayer.address.slice(-4)}
                                        </p>
                                    </div>
                                </div>
                                <span className={`${roleConfig.color} font-medium`}>{roleConfig.label}</span>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="p-4 rounded-xl border border-dashed border-white/20 text-center">
                            <p className="text-white/30">No target selected</p>
                            <p className="text-white/20 text-xs mt-1">Click on a player card on the sides</p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <AnimatePresence mode="wait">
                        {!nightState.hasCommitted ? (
                            <motion.div
                                key="commit"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <Button
                                    onClick={handleCommit}
                                    isLoading={isProcessing || isTxPending}
                                    disabled={!selectedTarget || isProcessing || isTxPending}
                                    className="w-full h-[50px]"
                                >
                                    <Lock className="w-5 h-5 mr-2" />
                                    {selectedTarget
                                        ? `Confirm: ${roleConfig.label} ${selectedPlayer?.name}`
                                        : 'Select a target first'
                                    }
                                </Button>
                                <p className="text-center text-white/30 text-xs mt-2">
                                    Step 1: Lock in your choice (encrypted)
                                </p>
                            </motion.div>
                        ) : !nightState.hasRevealed ? (
                            <motion.div
                                key="reveal"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <div className="flex items-center justify-center gap-2 text-green-400 mb-3 py-2">
                                    <Check className="w-5 h-5" />
                                    <span>Committed!</span>
                                </div>
                                <Button
                                    onClick={handleReveal}
                                    isLoading={isProcessing || isTxPending}
                                    disabled={isProcessing || isTxPending}
                                    variant="outline-gold"
                                    className="w-full h-[50px]"
                                >
                                    <Eye className="w-5 h-5 mr-2" />
                                    Reveal Action
                                </Button>
                                <p className="text-center text-white/30 text-xs mt-2">
                                    Step 2: Reveal your action to execute it
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-4"
                            >
                                <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                                    <Check className="w-5 h-5" />
                                    <span className="font-medium">Action Completed!</span>
                                </div>

                                {/* Detective Investigation Result */}
                                {myRole === Role.DETECTIVE && nightState.investigationResult && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`mt-4 p-4 rounded-xl border ${nightState.investigationResult === Role.MAFIA || nightState.investigationResult === Role.MANIAC
                                            ? 'bg-red-950/30 border-red-500/30'
                                            : 'bg-green-950/30 border-green-500/30'
                                            }`}
                                    >
                                        <p className="text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                                            <Search className="w-4 h-4" />
                                            Investigation Result
                                        </p>
                                        <p className={`text-xl font-bold ${nightState.investigationResult === Role.MAFIA ? 'text-red-400'
                                            : nightState.investigationResult === Role.MANIAC ? 'text-purple-400'
                                                : 'text-green-400'
                                            }`}>
                                            {gameState.players.find(p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase())?.name} is {nightState.investigationResult === Role.MAFIA || nightState.investigationResult === Role.MANIAC ? '🔴 EVIL' : '🟢 INNOCENT'}
                                        </p>
                                        <p className="text-white/40 text-xs mt-1">
                                            Role: {nightState.investigationResult}
                                        </p>
                                    </motion.div>
                                )}

                                <p className="text-white/40 text-sm mt-4">
                                    Night will end automatically when all reveal
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};
