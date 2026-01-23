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

interface NightPhaseProps {
    initialNightState?: Partial<NightState>;
}

export const NightPhase: React.FC<NightPhaseProps> = React.memo(({ initialNightState }) => {
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
        sendMafiaMessageOnChain,
        isTestMode,
        setGameState
    } = useGameContext();
    const { address } = useAccount();
    const { playKillSound, playProtectSound, playInvestigateSound, playApproveSound, playVoteSound } = useSoundEffects();

    const [nightState, setNightState] = useState<NightState>({
        hasCommitted: initialNightState?.hasCommitted ?? false,
        hasRevealed: initialNightState?.hasRevealed ?? false,
        commitHash: initialNightState?.commitHash ?? null,
        salt: initialNightState?.salt ?? null,
        investigationResult: initialNightState?.investigationResult ?? null,
        teammates: initialNightState?.teammates ?? [],
        committedTarget: initialNightState?.committedTarget ?? null,
        mafiaCommitted: initialNightState?.mafiaCommitted ?? 0,
        mafiaRevealed: initialNightState?.mafiaRevealed ?? 0,
        mafiaConsensusTarget: initialNightState?.mafiaConsensusTarget ?? null
    });

    // Handle initialNightState updates for testing
    useEffect(() => {
        if (initialNightState) {
            console.log('[NightPhase] Syncing with initialNightState:', initialNightState);
            setNightState(prev => ({
                ...prev,
                ...initialNightState
            }));
        }
    }, [initialNightState, isTestMode]);
    const [isProcessing, setIsProcessing] = useState(false);
    const publicClient = usePublicClient();

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
        if (isTestMode && initialNightState) return;

        syncWithContract();
        const interval = setInterval(syncWithContract, 2000);
        return () => clearInterval(interval);
    }, [syncWithContract, isTestMode, initialNightState]);

    // Моя роль
    const myRole = myPlayer?.role || Role.UNKNOWN;
    const roleConfig = RoleActions[myRole];
    const canAct = roleConfig.action !== NightActionType.NONE;

    if (isTestMode) {
        console.log('[NightPhase Debug]', {
            myRole,
            hasCommitted: nightState.hasCommitted,
            hasRevealed: nightState.hasRevealed,
            investigationResult: nightState.investigationResult,
            playersCount: gameState.players.length,
            isProcessing
        });
    }

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
        if (isTestMode && initialNightState) return;
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

        if (myRole === Role.MAFIA) playKillSound();
        else if (myRole === Role.DOCTOR) playProtectSound();
        else if (myRole === Role.DETECTIVE) playInvestigateSound();

        if (gameState.phase !== GamePhase.NIGHT) {
            addLog(`Cannot commit: not in NIGHT phase`, "danger");
            return;
        }

        const committedTarget = selectedTarget;
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

        setNightState(prev => ({
            ...prev,
            commitHash: hash,
            salt: salt,
            hasCommitted: true,
            committedTarget: committedTarget
        }));
        setIsProcessing(true);

        try {
            if (!isTestMode) {
                if (myRole === Role.MAFIA) {
                    await commitMafiaTargetOnChain(hash);
                } else {
                    await commitNightActionOnChain(hash);
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1500));
                if (myRole === Role.MAFIA) {
                    setNightState(prev => ({ ...prev, mafiaCommitted: 3 }));
                    addLog("[Test] Other Mafia members have committed", "info");
                }

                setGameState(prev => ({
                    ...prev,
                    players: prev.players.map(p =>
                        p.address.toLowerCase() === address?.toLowerCase()
                            ? { ...p, hasNightCommitted: true }
                            : p
                    )
                }));
            }

            localStorage.setItem(NIGHT_COMMIT_KEY, JSON.stringify({
                salt,
                commitHash: hash,
                committedTarget: committedTarget,
                action: roleConfig.action,
                hasCommitted: true,
                hasRevealed: false
            }));

            addLog("Night action committed!", "success");
            setSelectedTarget(null);
        } catch (e: any) {
            setNightState(prev => ({
                ...prev,
                commitHash: null,
                salt: null,
                hasCommitted: false,
                committedTarget: null
            }));
            addLog(e.shortMessage || e.message || "Commit failed", "danger");
        } finally {
            setIsProcessing(false);
            commitStartedRef.current = false;
        }
    }, [selectedTarget, nightState.hasCommitted, myRole, gameState.phase, roleConfig.action, commitMafiaTargetOnChain, commitNightActionOnChain, NIGHT_COMMIT_KEY, addLog, playKillSound, playProtectSound, playInvestigateSound, address, setSelectedTarget, setGameState, isTestMode]);

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
            if (!isTestMode) {
                if (myRole === Role.MAFIA) {
                    await revealMafiaTargetOnChain(
                        nightState.committedTarget as `0x${string}`,
                        nightState.salt
                    );
                } else {
                    await revealNightActionOnChain(
                        roleConfig.action,
                        nightState.committedTarget as `0x${string}`,
                        nightState.salt
                    );
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1500));

                if (myRole === Role.MAFIA) {
                    setNightState(prev => ({ ...prev, mafiaRevealed: 1 }));

                    setTimeout(() => {
                        setNightState(prev => ({ ...prev, mafiaRevealed: 2 }));
                        addLog("[Test] Fellow Mafia member revealed choice", "info");
                        playApproveSound();
                    }, 1500);

                    setTimeout(() => {
                        setNightState(prev => ({
                            ...prev,
                            mafiaRevealed: 3,
                            mafiaConsensusTarget: prev.committedTarget
                        }));
                        addLog("[Test] Consensus reached!", "success");
                        playVoteSound();
                    }, 3000);
                }

                setGameState(prev => ({
                    ...prev,
                    players: prev.players.map(p =>
                        p.address.toLowerCase() === address?.toLowerCase()
                            ? { ...p, hasNightRevealed: true }
                            : p
                    )
                }));
            }

            localStorage.removeItem(NIGHT_COMMIT_KEY);

            let investigationResult: Role | null = nightState.investigationResult;

            if (isTestMode && myRole === Role.DETECTIVE && !investigationResult) {
                investigationResult = Math.random() > 0.5 ? Role.MAFIA : Role.CIVILIAN;
                addLog(`[Test] Player is actually ${investigationResult}`, investigationResult === Role.MAFIA ? "danger" : "success");
            }

            if (!isTestMode && myRole === Role.DETECTIVE && roleConfig.action === NightActionType.CHECK) {
                addLog("Fetching investigation result from server...", "info");

                const MAX_RETRIES = 5;
                for (let i = 0; i < MAX_RETRIES; i++) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    if (i > 0) addLog(`Verifying action on-chain (Attempt ${i + 1}/${MAX_RETRIES})...`, "info");

                    const result = await getInvestigationResultOnChain(address || '', nightState.committedTarget || '');

                    if (result && result.role !== Role.UNKNOWN) {
                        investigationResult = result.role;
                        const targetName = gameState.players.find(
                            p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase()
                        )?.name || 'Unknown';
                        addLog(`Investigation complete: ${targetName} is ${result.isMafia ? 'EVIL' : 'INNOCENT'}!`, "success");
                        break;
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
            addLog(e.shortMessage || e.message || "Reveal failed", "danger");
        } finally {
            setIsProcessing(false);
            revealStartedRef.current = false;
        }
    }, [nightState.committedTarget, nightState.salt, nightState.hasRevealed, nightState.commitHash, myRole, roleConfig.action, revealMafiaTargetOnChain, revealNightActionOnChain, NIGHT_COMMIT_KEY, getInvestigationResultOnChain, address, gameState.players, addLog, setSelectedTarget, isTestMode, playApproveSound, playVoteSound, setGameState, nightState.investigationResult]);

    // Night Reveal Auto Component (Internal for automation)
    const NightRevealAuto: React.FC<{
        nightState: NightState;
        isProcessing: boolean;
        isTxPending: boolean;
        handleReveal: () => Promise<void>;
    }> = ({ nightState, isProcessing, isTxPending, handleReveal }) => {
        useEffect(() => {
            if (nightState.hasCommitted && !nightState.hasRevealed && !isProcessing && !isTxPending) {
                const checkReady = async () => {
                    const saved = localStorage.getItem(NIGHT_COMMIT_KEY);
                    if (saved) {
                        console.log("[NightPhase] Auto-revealing action...");
                        handleReveal();
                    }
                };
                checkReady();
            }
        }, [nightState.hasCommitted, nightState.hasRevealed, isProcessing, isTxPending, handleReveal]);
        return null;
    };

    if (!canAct) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-indigo-950/30 backdrop-blur-xl rounded-3xl border border-indigo-500/20 p-8 text-center"
                >
                    <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="relative mx-auto mb-6 w-fit"
                    >
                        <Moon className="w-16 h-16 text-indigo-400" />
                        <div className="absolute -bottom-1 -right-1 bg-indigo-900/80 rounded-full p-1">
                            <Lock className="w-5 h-5 text-indigo-300" />
                        </div>
                    </motion.div>
                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">Night Phase</h2>
                    <p className="text-white/50 text-sm mb-4">You are a <span className="text-indigo-300 font-medium">{myRole}</span>. You have no night abilities.</p>
                    <div className="bg-indigo-900/30 rounded-xl p-4 border border-indigo-500/20 mb-4">
                        <div className="flex items-center justify-center gap-2 text-indigo-300 mb-2">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm font-medium">Actions locked</span>
                        </div>
                        <p className="text-indigo-200/50 text-xs">Close your eyes and wait for dawn</p>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 no-scrollbar relative">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg w-full flex flex-col items-stretch"
            >
                {/* 1. Header */}
                <AnimatePresence mode="wait">
                    {!nightState.hasCommitted && (
                        <motion.div
                            key="header"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="text-center mb-2"
                        >
                            <h2 className="text-2xl font-['Playfair_Display'] text-white mb-1">
                                {myRole === Role.MAFIA && 'Choose your victim'}
                                {myRole === Role.DOCTOR && 'Choose who to protect'}
                                {myRole === Role.DETECTIVE && 'Choose who to investigate'}
                            </h2>
                            <p className="text-white/40 text-[10px] tracking-wide">
                                {myRole === Role.MAFIA ? 'Target to eliminate' : (myRole === Role.DOCTOR ? 'Player to protect' : 'Player to investigate')}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 2. Status Area - Floating Badge (Absolute container) */}
                <div className="relative w-full h-0 pointer-events-none">
                    <AnimatePresence>
                        {nightState.hasRevealed && (
                            <motion.div
                                initial={{ y: 20, opacity: 0, scale: 0.8 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: 20, opacity: 0, scale: 0.8 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex items-center justify-center gap-2 text-green-400 py-1.5 px-6 rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)] backdrop-blur-sm whitespace-nowrap z-50 pointer-events-none"
                            >
                                <Check className="w-4 h-4" />
                                <span className="font-bold tracking-[0.2em] uppercase text-[10px]">Action Completed!</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Mafia Teammates */}
                {myRole === Role.MAFIA && nightState.teammates.length > 0 && !nightState.hasCommitted && (
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
                                    <span key={addr} className={`px-3 py-1 rounded-full text-sm ${teammate?.isAlive ? 'bg-red-900/50 text-red-300 border border-red-500/30' : 'bg-gray-900/50 text-gray-500 border border-gray-500/30 line-through'}`}>
                                        {teammate?.name || addr.slice(0, 8)}
                                    </span>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Main Action Area */}
                <div className="relative w-full flex flex-col items-center">
                    <AnimatePresence mode="wait">
                        {myRole === Role.MAFIA && !nightState.hasCommitted ? (
                            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
                                <div>
                                    <MafiaChat
                                        myName={myPlayer?.name || 'You'}
                                        teammates={nightState.teammates}
                                        players={gameState.players}
                                        selectedTarget={selectedTarget}
                                        onSuggestTarget={(addr) => setSelectedTarget(addr)}
                                        messages={gameState.mafiaMessages || []}
                                        onSendMessage={sendMafiaMessageOnChain}
                                    />
                                </div>
                            </motion.div>
                        ) : nightState.hasCommitted ? (
                            <motion.div key="results" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex flex-col items-center relative">
                                <div className="w-full">
                                    {/* Mafia Consensus */}
                                    {myRole === Role.MAFIA && (
                                        <div className="mb-4 p-4 bg-red-950/20 border border-red-500/20 rounded-2xl w-full">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Users className="w-4 h-4 text-red-400" />
                                                <span className="text-red-300 text-sm font-medium">Mafia Consensus</span>
                                            </div>
                                            <div className="flex justify-between text-sm mb-3">
                                                <span className="text-red-200/60">Committed: {nightState.mafiaCommitted}</span>
                                                <span className="text-red-200/60">Revealed: {nightState.mafiaRevealed}</span>
                                            </div>
                                            {nightState.mafiaRevealed < nightState.mafiaCommitted && (
                                                <div className="p-3 bg-red-900/20 rounded-lg border border-red-500/10">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                                        <span className="text-red-300 text-sm">Waiting for other Mafia...</span>
                                                    </div>
                                                </div>
                                            )}
                                            {nightState.mafiaRevealed > 0 && nightState.mafiaRevealed === nightState.mafiaCommitted && nightState.mafiaConsensusTarget && (
                                                <div className="p-4 bg-red-900/40 rounded-xl border border-red-500/30">
                                                    <p className="text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-2 text-red-400"><Skull className="w-4 h-4" />Kill Confirmed</p>
                                                    <p className="text-xl font-bold text-red-400 text-center">
                                                        {gameState.players.find(p => p.address.toLowerCase() === nightState.mafiaConsensusTarget?.toLowerCase())?.name || 'Target'} will be eliminated 💀
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Role Specific Results */}
                                    {nightState.hasRevealed && (
                                        <div className="w-full space-y-4">
                                            {myRole === Role.DOCTOR && nightState.committedTarget && (
                                                <div className="p-4 rounded-xl border bg-green-950/30 border-green-500/30 text-center">
                                                    <p className="text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-2 text-green-400"><Shield className="w-4 h-4" />Protection Active</p>
                                                    <p className="text-xl font-bold text-green-400">
                                                        {gameState.players.find(p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase())?.name} is protected 🛡️
                                                    </p>
                                                </div>
                                            )}
                                            {myRole === Role.DETECTIVE && nightState.investigationResult !== null && (
                                                <div className={`p-4 rounded-xl border ${nightState.investigationResult === Role.MAFIA ? 'bg-red-950/30 border-red-500/30' : 'bg-green-950/30 border-green-500/30'} text-center`}>
                                                    <p className="text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-2 text-white/70"><Search className="w-4 h-4" />Investigation Result</p>
                                                    <p className={`text-xl font-bold ${nightState.investigationResult === Role.MAFIA ? 'text-red-400' : 'text-green-400'}`}>
                                                        {gameState.players.find(p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase())?.name} is {nightState.investigationResult === Role.MAFIA ? '🔴 EVIL' : '🟢 INNOCENT'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Waiting Message - Absolute at the bottom of the content area */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 whitespace-nowrap">
                                        <p className="text-white/20 text-[8px] tracking-[0.4em] uppercase animate-pulse">Waiting for dawn</p>
                                    </div>
                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>

                {/* Selection & Action (Only before commit) */}
                {!nightState.hasCommitted && (
                    <div className="mt-2 flex flex-col items-center w-full">
                        {selectedPlayer && (
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={`p-3 rounded-xl border-2 mb-4 w-full ${myRole === Role.MAFIA ? 'bg-red-900/15 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.15)]' :
                                    myRole === Role.DOCTOR ? 'bg-green-900/15 border-green-500/60 shadow-[0_0_20px_rgba(34,197,94,0.15)]' :
                                        'bg-blue-900/15 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${myRole === Role.MAFIA ? 'bg-red-500/25' :
                                            myRole === Role.DOCTOR ? 'bg-green-500/25' :
                                                'bg-blue-500/25'
                                            }`}>
                                            {roleConfig.icon}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-base leading-tight">{selectedPlayer.name}</p>
                                            <p className="text-white/40 text-[10px] font-mono">{selectedPlayer.address.slice(0, 6)}...{selectedPlayer.address.slice(-4)}</p>
                                        </div>
                                    </div>
                                    <span className={`${roleConfig.color} font-bold uppercase tracking-wider text-[10px]`}>{roleConfig.label}</span>
                                </div>
                            </motion.div>
                        )}
                        <Button
                            onClick={handleCommit}
                            isLoading={isProcessing || isTxPending}
                            disabled={!selectedTarget || isProcessing || isTxPending}
                            className="w-full h-[46px] text-sm"
                        >
                            <Lock className="w-4 h-4 mr-2" />
                            {selectedTarget ? `${roleConfig.label} ${selectedPlayer?.name}` : 'Select target'}
                        </Button>
                    </div>
                )}

                <NightRevealAuto
                    nightState={nightState}
                    isProcessing={isProcessing}
                    isTxPending={isTxPending}
                    handleReveal={handleReveal}
                />
            </motion.div>
        </div>
    );
});

/**
 * NightPhaseTimer component for the GameLayout header
 */
export const NightPhaseTimer: React.FC<{ isTxPending?: boolean }> = React.memo(({ isTxPending }) => {
    const { gameState } = useGameContext();
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        if (!gameState.phaseDeadline) return;

        const tick = () => {
            const now = Math.floor(Date.now() / 1000);
            const diff = Math.max(0, gameState.phaseDeadline - now);
            setTimeLeft(diff);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [gameState.phaseDeadline]);

    if (timeLeft <= 0 && !isTxPending) return null;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md shadow-lg"
        >
            <Clock className={`w-3.5 h-3.5 ${timeLeft < 20 ? 'text-red-400 animate-pulse' : 'text-white/40'}`} />
            <span className={`font-mono text-xs tracking-wider ${timeLeft < 20 ? 'text-red-400' : 'text-white/70'}`}>
                NIGHT ENDS IN: {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
            {isTxPending && (
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse ml-1" />
            )}
        </motion.div>
    );
});
