// components/game/NightPhase.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient, useAccount } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { hexToString } from '../../services/cryptoUtils';
import { Role, Player, GamePhase } from '../../types';
import { Button } from '../ui/Button';
import { MafiaChat } from './MafiaChat';
import { useSoundEffects } from '../ui/SoundEffects';
import { Moon, Skull, Shield, Search, Eye, Check, Clock, User, Lock, AlertCircle, Users } from 'lucide-react';

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
    teammates: `0x${string}`[]; // Fellow mafia members (addresses)
    committedTarget: `0x${string}` | null; // Store the committed target
    // V4: Mafia consensus state
    mafiaCommitted: number;
    mafiaRevealed: number;
    mafiaConsensusTarget: `0x${string}` | null;
}

const RoleActions: Record<Role, { action: NightActionType; label: string; icon: React.ReactNode; color: string }> = {
    [Role.MAFIA]: {
        action: NightActionType.KILL,
        label: 'Kill',
        icon: <Skull className="w-5 h-5" />,
        color: 'text-red-500'
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

export const NightPhase: React.FC = React.memo(() => {
    const {
        gameState,
        myPlayer,
        commitNightActionOnChain,
        revealNightActionOnChain,
        commitMafiaTargetOnChain,
        revealMafiaTargetOnChain,
        getInvestigationResultOnChain,
        forcePhaseTimeoutOnChain,
        addLog,
        isTxPending,
        selectedTarget,
        setSelectedTarget,
        currentRoomId,
        sendMafiaMessageOnChain
    } = useGameContext();
    const { playKillSound, playProtectSound, playInvestigateSound } = useSoundEffects();

    const [nightState, setNightState] = useState<NightState>({
        hasCommitted: false,
        hasRevealed: false,
        commitHash: null,
        salt: null,
        investigationResult: null,
        teammates: [],
        committedTarget: null,
        // V4: Mafia consensus
        mafiaCommitted: 0,
        mafiaRevealed: 0,
        mafiaConsensusTarget: null
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const publicClient = usePublicClient();
    const { address } = useAccount();

    // Protection against concurrent calls
    const commitStartedRef = useRef(false);
    const revealStartedRef = useRef(false);

    // Sync with contract flags (hasCommitted, hasRevealed) + mafia consensus
    const syncWithContract = useCallback(async () => {
        if (!publicClient || !currentRoomId || !address) return;

        // Skip if active transaction is local. But for mock mode, we might want to skip less.
        if (isProcessing || isTxPending) return;

        try {
            const [isActive, hasConfirmedRole, hasVoted, hasCommitted, hasRevealed, hasSharedKeys, hasClaimedMafia] = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getPlayerFlags',
                args: [currentRoomId, address as `0x${string}`],
            }) as [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

            const [mafiaCommitted, mafiaRevealed, consensusTarget] = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getMafiaConsensus',
                args: [currentRoomId],
            }) as [number, number, string];

            setNightState(prev => ({
                ...prev,
                hasCommitted: prev.hasCommitted || hasCommitted,
                hasRevealed: prev.hasRevealed || hasRevealed,
                mafiaCommitted: Math.max(prev.mafiaCommitted, Number(mafiaCommitted)),
                mafiaRevealed: Math.max(prev.mafiaRevealed, Number(mafiaRevealed)),
                mafiaConsensusTarget: consensusTarget === '0x0000000000000000000000000000000000000000' ? null : consensusTarget as `0x${string}`
            }));
        } catch (e) {
            console.error("Failed to sync night state:", e);
        }
    }, [publicClient, currentRoomId, address, isProcessing, isTxPending]);

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
    const selectedPlayer = gameState.players.find(p => p.address.toLowerCase() === selectedTarget?.toLowerCase());

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
                account: address as `0x${string}`,
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
                setNightState(prev => ({ ...prev, teammates: teammates as `0x${string}`[] }));
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

    // Восстановление состояния из блокчейна после рефреша (используя флаги из GameContext)
    useEffect(() => {
        // Если контракт говорит "Ты уже сделал Commit", но локально мы не знаем
        if (myPlayer?.hasNightCommitted && !nightState.hasCommitted) {
            console.log("Recovering Night State: Commit detected on-chain");

            // Пытаемся достать соль и цель из localStorage
            const saved = localStorage.getItem(NIGHT_COMMIT_KEY);

            if (saved) {
                try {
                    const { salt, commitHash, committedTarget } = JSON.parse(saved);
                    setNightState(prev => ({
                        ...prev,
                        hasCommitted: true,
                        salt,
                        commitHash,
                        committedTarget
                    }));
                } catch (e) {
                    console.error("Failed to restore night data", e);
                    // LocalStorage пуст/битый, но коммит есть в блокчейне
                    // Показываем что ход сделан, но Reveal невозможен
                    setNightState(prev => ({ ...prev, hasCommitted: true }));
                    addLog("Warning: Action committed on-chain but local data lost. Reveal may fail.", "warning");
                }
            } else {
                // Если в localStorage пусто - проблема, reveal не получится
                setNightState(prev => ({ ...prev, hasCommitted: true }));
                addLog("Warning: Action committed on-chain but local data lost.", "warning");
            }
        }

        // Если уже и Reveal сделал
        if (myPlayer?.hasNightRevealed && !nightState.hasRevealed) {
            console.log("Recovering Night State: Reveal detected on-chain");
            setNightState(prev => ({ ...prev, hasCommitted: true, hasRevealed: true }));
        }
    }, [myPlayer?.hasNightCommitted, myPlayer?.hasNightRevealed, nightState.hasCommitted, nightState.hasRevealed, NIGHT_COMMIT_KEY, addLog]);

    const handleCommit = useCallback(async () => {
        if (!selectedTarget || nightState.hasCommitted || commitStartedRef.current) return;
        commitStartedRef.current = true;

        // Play specific sound based on role
        if (myRole === Role.MAFIA) playKillSound();
        else if (myRole === Role.DOCTOR) playProtectSound();
        else if (myRole === Role.DETECTIVE) playInvestigateSound();

        // Check if we're actually in NIGHT phase
        if (gameState.phase !== GamePhase.NIGHT) {
            addLog(`Cannot commit: not in NIGHT phase`, "danger");
            console.error('[Night] Wrong phase for commit:', gameState.phase);
            return;
        }

        // Сохраняем для rollback
        const committedTarget = selectedTarget;

        // Генерируем соль заранее
        const salt = ShuffleService.generateSalt();
        let hash: string;

        try {
            if (myRole === Role.MAFIA) {
                hash = ShuffleService.createMafiaTargetHash(committedTarget, salt);
            } else {
                hash = ShuffleService.createCommitHash(roleConfig.action, committedTarget, salt);
            }
        } catch (e: any) {
            addLog("Failed to create commit hash", "danger");
            return;
        }

        // Optimistic: обновляем UI сразу
        setNightState(prev => ({
            ...prev,
            commitHash: hash,
            salt: salt,
            hasCommitted: true,
            committedTarget: committedTarget
        }));
        setIsProcessing(true);

        try {
            console.log(`[${myRole === Role.MAFIA ? 'Mafia' : 'Night'} Commit]`, {
                target: committedTarget,
                salt: salt,
                hash: hash
            });

            if (myRole === Role.MAFIA) {
                await commitMafiaTargetOnChain(hash);
            } else {
                await commitNightActionOnChain(hash);
            }

            // Сохраняем в localStorage только после успеха
            localStorage.setItem(NIGHT_COMMIT_KEY, JSON.stringify({
                salt,
                commitHash: hash,
                committedTarget: committedTarget,
                action: roleConfig.action,
                hasCommitted: true,
                hasRevealed: false
            }));

            addLog("Night action committed!", "success");
        } catch (e: any) {
            // Rollback при ошибке
            setNightState(prev => ({
                ...prev,
                commitHash: null,
                salt: null,
                hasCommitted: false,
                committedTarget: null
            }));
            console.error("Commit failed:", e);
            addLog(e.shortMessage || e.message || "Commit failed", "danger");
        } finally {
            setIsProcessing(false);
            commitStartedRef.current = false;
        }
    }, [selectedTarget, nightState.hasCommitted, myRole, gameState.phase, roleConfig.action, commitMafiaTargetOnChain, commitNightActionOnChain, NIGHT_COMMIT_KEY, addLog, playKillSound, playProtectSound, playInvestigateSound]);

    const handleReveal = useCallback(async () => {
        if (!nightState.committedTarget || !nightState.salt || nightState.hasRevealed || revealStartedRef.current) return;
        revealStartedRef.current = true;

        const previousHasRevealed = nightState.hasRevealed;

        setNightState(prev => ({
            ...prev,
            hasRevealed: true
        }));
        setIsProcessing(true);

        try {
            if (myRole === Role.MAFIA) {
                console.log('[Mafia Reveal]', {
                    target: nightState.committedTarget,
                    salt: nightState.salt,
                    expectedHash: nightState.commitHash
                });

                await revealMafiaTargetOnChain(
                    nightState.committedTarget as `0x${string}`,
                    nightState.salt
                );
            } else {
                console.log('[Night Reveal]', {
                    action: roleConfig.action,
                    target: nightState.committedTarget,
                    salt: nightState.salt,
                    expectedHash: nightState.commitHash
                });

                await revealNightActionOnChain(
                    roleConfig.action,
                    nightState.committedTarget as `0x${string}`,
                    nightState.salt
                );
            }

            localStorage.removeItem(NIGHT_COMMIT_KEY);

            let investigationResult: Role | null = null;
            if (myRole === Role.DETECTIVE && roleConfig.action === NightActionType.CHECK) {
                addLog("Fetching investigation result from server...", "info");

                // Retry loop to handle block propagation latency
                const MAX_RETRIES = 5;
                for (let i = 0; i < MAX_RETRIES; i++) {
                    // Wait before check (2s delay each time giving time for indexer)
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    if (i > 0) addLog(`Verifying action on-chain (Attempt ${i + 1}/${MAX_RETRIES})...`, "info");

                    const result = await getInvestigationResultOnChain(address || '', nightState.committedTarget || '');

                    if (result && result.role !== Role.UNKNOWN) {
                        investigationResult = result.role;
                        const targetName = gameState.players.find(
                            p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase()
                        )?.name || 'Unknown';
                        addLog(`Investigation complete: ${targetName} is ${result.isMafia ? 'EVIL' : 'INNOCENT'}!`, "success");
                        break; // Success!
                    }
                }

                if (!investigationResult) {
                    addLog("Could not verify investigation result after multiple attempts.", "warning");
                }
            }

            setNightState(prev => ({
                ...prev,
                hasRevealed: true,
                investigationResult
            }));
            setSelectedTarget(null);
            addLog("Night action revealed!", "success");
        } catch (e: any) {
            setNightState(prev => ({
                ...prev,
                hasRevealed: previousHasRevealed
            }));
            console.error("Reveal failed:", e);
            addLog(e.shortMessage || e.message || "Reveal failed", "danger");
        } finally {
            setIsProcessing(false);
            revealStartedRef.current = false;
        }
    }, [nightState.committedTarget, nightState.salt, nightState.hasRevealed, nightState.commitHash, myRole, roleConfig.action, revealMafiaTargetOnChain, revealNightActionOnChain, NIGHT_COMMIT_KEY, getInvestigationResultOnChain, address, gameState.players, addLog, setSelectedTarget]);

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

                    {/* TIMER for civilians too */}
                    <NightPhaseTimer isProcessing={false} isTxPending={isTxPending} />
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

                {/* V4: Mafia Consensus Status */}
                {myRole === Role.MAFIA && (nightState.mafiaCommitted > 0 || nightState.mafiaRevealed > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-4 bg-red-950/20 border border-red-500/20 rounded-2xl"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-red-400" />
                            <span className="text-red-300 text-sm font-medium">Mafia Consensus</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-red-200/60">Committed: {nightState.mafiaCommitted}</span>
                            <span className="text-red-200/60">Revealed: {nightState.mafiaRevealed}</span>
                        </div>
                        {nightState.mafiaConsensusTarget && (
                            <div className="mt-2 p-2 bg-red-900/30 rounded-lg">
                                <span className="text-xs text-red-300">Consensus Target: </span>
                                <span className="text-red-200 font-medium">
                                    {gameState.players.find(p => p.address.toLowerCase() === nightState.mafiaConsensusTarget?.toLowerCase())?.name || nightState.mafiaConsensusTarget?.slice(0, 8)}
                                </span>
                            </div>
                        )}
                        {nightState.mafiaRevealed === nightState.mafiaCommitted && nightState.mafiaRevealed > 0 && !nightState.mafiaConsensusTarget && (
                            <div className="mt-2 p-2 bg-yellow-900/30 rounded-lg">
                                <span className="text-xs text-yellow-300">⚠️ No consensus - targets don't match!</span>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Mafia Chat - for coordination */}
                {myRole === Role.MAFIA && (
                    <MafiaChat
                        myName={myPlayer?.name || 'You'}
                        teammates={nightState.teammates}
                        players={gameState.players}
                        selectedTarget={selectedTarget}
                        onSuggestTarget={(addr) => setSelectedTarget(addr)}
                        messages={gameState.mafiaMessages || []}
                        onSendMessage={sendMafiaMessageOnChain}
                    />
                )}

                {/* Selected Target Display */}
                {selectedTarget && selectedPlayer && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`p-4 rounded-xl border-2 mb-6 ${myRole === Role.MAFIA ? 'bg-red-900/20 border-red-500/50' :
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
                )}

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
                                    data-custom-sound
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
                                    {isProcessing ? 'Revealing...' : 'Reveal Action'}
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
                                        className={`mt-4 p-4 rounded-xl border ${nightState.investigationResult === Role.MAFIA
                                            ? 'bg-red-950/30 border-red-500/30'
                                            : 'bg-green-950/30 border-green-500/30'
                                            }`}
                                    >
                                        <p className="text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                                            <Search className="w-4 h-4" />
                                            Investigation Result
                                        </p>
                                        <p className={`text-xl font-bold ${nightState.investigationResult === Role.MAFIA ? 'text-red-400' : 'text-green-400'}`}>
                                            {gameState.players.find(p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase())?.name} is {nightState.investigationResult === Role.MAFIA ? '🔴 EVIL' : '🟢 INNOCENT'}
                                        </p>
                                        <p className="text-white/40 text-xs mt-1">
                                            Role: {nightState.investigationResult}
                                        </p>
                                    </motion.div>
                                )}

                                <p className="text-white/40 text-sm mt-4">
                                    Dawn is approaching... Wait for the night to end.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* AUTOMATION: Night Reveal Hands-Free */}
                <NightRevealAuto
                    nightState={nightState}
                    isProcessing={isProcessing}
                    isTxPending={isTxPending}
                    handleReveal={handleReveal}
                />

                {/* AUTOMATION: Night End Hands-Free (Triggered by Timeout) */}
                <NightPhaseTimer
                    isProcessing={isProcessing}
                    isTxPending={isTxPending}
                />
            </motion.div>
        </div>
    );
});

/**
 * Automator #1: Handles self-reveal when commit is detected in state
 */
const NightRevealAuto: React.FC<{
    nightState: NightState,
    isProcessing: boolean,
    isTxPending: boolean,
    handleReveal: () => Promise<void>
}> = ({ nightState, isProcessing, isTxPending, handleReveal }) => {
    useEffect(() => {
        if (nightState.hasCommitted && !nightState.hasRevealed && !isProcessing && !isTxPending && nightState.salt) {
            console.log("[Night Auto] Detected commit locally. Triggering reveal...");
            handleReveal();
        }
    }, [nightState.hasCommitted, nightState.hasRevealed, nightState.salt, isProcessing, isTxPending, handleReveal]);

    return null;
};

/**
 * Automator #2: Monitors phaseDeadline and triggers forcePhaseTimeout when time expires.
 * Displays a countdown timer to the user.
 */
const NightPhaseTimer: React.FC<{
    isProcessing: boolean,
    isTxPending: boolean
}> = ({ isProcessing, isTxPending }) => {
    const { gameState, forcePhaseTimeoutOnChain, currentRoomId, myPlayer } = useGameContext();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const timeoutStartedRef = useRef(false);
    // Используем локальный stable deadline для плавного отсчёта
    const stableDeadlineRef = useRef<number>(0);

    useEffect(() => {
        if (!currentRoomId || gameState.phase !== GamePhase.NIGHT || gameState.phaseDeadline === 0) {
            setTimeLeft(0);
            timeoutStartedRef.current = false;
            stableDeadlineRef.current = 0;
            return;
        }

        // Обновляем stableDeadline только если контракт изменил deadline значительно (>5 секунд разницы)
        // Это предотвращает прыжки при обычных polling обновлениях
        const contractDeadline = gameState.phaseDeadline;
        if (stableDeadlineRef.current === 0 || Math.abs(contractDeadline - stableDeadlineRef.current) > 5) {
            stableDeadlineRef.current = contractDeadline;
            console.log(`[Timer] Updated stable deadline to ${contractDeadline}`);
        }

        const tick = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = Math.max(0, stableDeadlineRef.current - now);
            setTimeLeft(remaining);

            // Auto-trigger fallback: if time expired and no one has ended the night yet
            if (remaining === 0 && !isProcessing && !isTxPending && !timeoutStartedRef.current) {
                // Anyone can trigger timeout, but we let the Host be primary to reduce noise
                const isHost = gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase();

                if (isHost) {
                    console.log(`[NightPhaseTimer] Time expired. Triggering forcePhaseTimeout...`);
                    timeoutStartedRef.current = true;
                    forcePhaseTimeoutOnChain().catch(e => {
                        console.error("Auto timeout failed:", e);
                        timeoutStartedRef.current = false;
                    });
                }
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [gameState.phaseDeadline, gameState.phase, currentRoomId, isProcessing, isTxPending, myPlayer, gameState.players, forcePhaseTimeoutOnChain]);

    if (timeLeft === 0 && gameState.phase !== GamePhase.NIGHT) return null;

    return (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/60 backdrop-blur-md border border-red-500/30 px-6 py-2 rounded-full flex items-center gap-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
            >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 text-xs font-bold tracking-widest uppercase">
                    Night Ends In: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
            </motion.div>
        </div>
    );
};
