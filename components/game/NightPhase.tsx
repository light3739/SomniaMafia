// components/game/NightPhase.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
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
import { Moon, Skull, Shield, Search, Eye, Check, Clock, User, Lock, AlertCircle, Users, RefreshCw } from 'lucide-react';
import { NightActionFeedback } from './NightActionFeedback';

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
        color: 'text-rose-500'
    },
    [Role.DOCTOR]: {
        action: NightActionType.HEAL,
        label: 'Protect',
        icon: <Shield className="w-5 h-5" />,
        color: 'text-teal-500'
    },
    [Role.DETECTIVE]: {
        action: NightActionType.CHECK,
        label: 'Investigate',
        icon: <Search className="w-5 h-5" />,
        color: 'text-sky-500'
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
    const { playKillSound, playProtectSound, playInvestigateSound, playApproveSound, playVoteSound, playRejectSound } = useSoundEffects();

    // Моя роль (defined early for use in callbacks)
    const myRole = myPlayer?.role || Role.UNKNOWN;
    const roleConfig = RoleActions[myRole];
    // Can act only if role has action AND player is alive
    const canAct = roleConfig.action !== NightActionType.NONE && myPlayer?.isAlive;

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

            setNightState(prev => {
                // FORCE RECOVERY CHECK: If contract says committed but we don't have it locally
                const needsRecovery = hasCommitted && !prev.hasCommitted;
                if (needsRecovery) {
                    console.log("[NightPhase] Detected state mismatch: Contract committed, Local missing. Triggering recovery...");
                    // We don't set state here, we rely on the effect below to trigger forceSync
                }

                return {
                    ...prev,
                    hasCommitted: prev.hasCommitted || hasCommitted,
                    hasRevealed: prev.hasRevealed || hasRevealed,
                    mafiaCommitted: Math.max(prev.mafiaCommitted, Number(mafiaCommitted)),
                    mafiaRevealed: Math.max(prev.mafiaRevealed, Number(mafiaRevealed)),
                    mafiaConsensusTarget: consensusTarget === '0x0000000000000000000000000000000000000000' ? null : consensusTarget as `0x${string}`
                };
            });
        } catch (e) {
            console.error("Failed to sync night state:", e);
        }
    }, [publicClient, currentRoomId, address, isProcessing, isTxPending]);

    // Force Sync Function - Recover local state from blockchain logs
    const forceSync = useCallback(async () => {
        if (!publicClient || !currentRoomId || !address) return;

        console.log("[NightPhase] Starting Force Sync Recovery...");
        addLog("Recovering game state from blockchain...", "info");

        try {
            const currentBlock = await publicClient.getBlockNumber();
            const fromBlock = currentBlock > 2000n ? currentBlock - 2000n : 0n; // Search last 2000 blocks

            // 1. Recover Commit (NightActionCommitted or MafiaTargetCommitted)
            if (myRole === Role.MAFIA) {
                // For Mafia, we look for MafiaTargetCommitted events? 
                // Wait, in V4 Mafia uses `commitMafiaTarget`. The event is likely `MafiaTargetCommitted`.
                // Let's check ABI or assume generic recovery isn't fully possible for encrypted salts without cloud backup.
                // BUT for Mafia V4, the target is hashed? getMafiaConsensus returns counts.
                // Re-reading contract logic: `commitMafiaTarget` emits nothing? Or maybe `NightActionCommitted`?
                // Actually, without the SALT, we cannot REVEAL. 
                // If we lost localStorage, we lost the SALT.
                // CRITICAL: We cannot recover the SALT from the blockchain if it was never revealed.
                // However, if we ALREADY REVEALED, we can recover the fact that we revealed.

                // If we are committed but NOT revealed, and we lost the salt... we are stuck.
                // The only way is if we can re-generate the same salt? Impossible.
                // OR if the game allows generic "I forgot my salt" - no, that breaks crypto.

                // WAIT! If we are stuck in "Committed", we can't do anything.
                // BUT if we are "Revealed" on chain, we just need to update UI.
                // The syncWithContract already updates `hasCommitted` / `hasRevealed`.

                console.warn("[NightPhase] Cannot recover lost SALT for unrevealed commit. If you cleared cache mid-turn, you are stuck.");
                // If we are already revealed on chain, we are fine.
                // If we are committed on chain but not revealed, and no local salt... we can't reveal.
                // The "kick" mechanic will eventually handle us.
            }
        } catch (e) {
            console.error("[NightPhase] Force sync failed:", e);
        }
    }, [publicClient, currentRoomId, address, myRole, addLog]);

    // Optimize Polling: 2s usually, slower if hidden (adaptive)
    useEffect(() => {
        if (isTestMode && initialNightState) return;

        let intervalId: NodeJS.Timeout;
        const tick = () => syncWithContract();

        const startPolling = () => {
            const delay = typeof document !== 'undefined' && document.hidden ? 5000 : 2000;
            intervalId = setInterval(tick, delay);
        };

        tick(); // Initial
        startPolling();

        const handleVisibilityCode = () => {
            clearInterval(intervalId);
            startPolling();
        };

        document.addEventListener('visibilitychange', handleVisibilityCode);
        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityCode);
        };
    }, [syncWithContract, isTestMode, initialNightState]);



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
    const NIGHT_COMMIT_KEY = `mafia_night_commit_${currentRoomId}_${address ? address.toLowerCase() : ''}`;

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

        // RECOVERY LOGIC for Missing Local Data
        if (myPlayer?.hasNightCommitted && !nightState.hasCommitted && !localStorage.getItem(NIGHT_COMMIT_KEY)) {
            // If we are here, it means chain says "Committed", but we found nothing in localStorage.
            // This is a dangerous state (Lost Salt). 
            // We can't recover the salt (it's random and local). 
            // We can only acknowledge the state to UI so the user isn't confused.
            console.warn("[NightPhase] Critical: Action committed on-chain but local salt lost. You cannot reveal this turn.");
            setNightState(prev => ({ ...prev, hasCommitted: true }));
            // Don't show "danger" log constantly, just once is enough via the check above
        }
    }, [myPlayer?.hasNightCommitted, myPlayer?.hasNightRevealed, nightState.hasCommitted, nightState.hasRevealed, NIGHT_COMMIT_KEY]);

    // ========== AUTO-TIMEOUT: Force day transition when night timer expires ==========
    const timeoutTriggeredRef = useRef(false);
    const TIMEOUT_BUFFER_SECONDS = 5; // Wait 5 seconds after deadline to allow last-second actions

    useEffect(() => {
        // Skip in test mode
        if (isTestMode) return;

        // Check if we have a valid deadline
        const deadline = gameState.phaseDeadline;
        if (!deadline || deadline === 0) return;

        // Waterfall Logic: Any alive player can trigger, but staggered by index
        const sortedSurvivors = [...gameState.players]
            .filter(p => p.isAlive)
            .sort((a, b) => a.address.localeCompare(b.address));

        const myIndex = sortedSurvivors.findIndex(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());

        // If I'm not alive/found, I shouldn't trigger
        if (myIndex === -1) return;

        // Check if already triggered
        if (timeoutTriggeredRef.current) return;

        // Don't trigger if transaction is pending
        if (isProcessing || isTxPending) return;

        const checkTimeout = () => {
            const now = Math.floor(Date.now() / 1000);
            const secondsPastDeadline = now - deadline;

            // Base buffer 5s, plus 5s per index position
            const myTriggerTime = TIMEOUT_BUFFER_SECONDS + (myIndex * 5);

            // If we're past the deadline + buffer + index delay, trigger timeout
            if (secondsPastDeadline >= myTriggerTime) {
                console.log(`[NightPhase] Timer expired. Waterfall Trigger (Index ${myIndex})...`, {
                    deadline,
                    now,
                    secondsPastDeadline,
                    buffer: myTriggerTime
                });

                timeoutTriggeredRef.current = true;
                addLog("Night time expired. Transitioning to day...", "warning");

                forcePhaseTimeoutOnChain().catch(err => {
                    console.error('[NightPhase] forcePhaseTimeout failed:', err);
                    // Reset flag to allow retry
                    timeoutTriggeredRef.current = false;
                });
            }
        };

        // Check immediately
        checkTimeout();

        // And poll every 2 seconds
        const interval = setInterval(checkTimeout, 2000);
        return () => clearInterval(interval);
    }, [gameState.phaseDeadline, gameState.players, myPlayer?.address, isTestMode, isProcessing, isTxPending, forcePhaseTimeoutOnChain, addLog]);

    // Reset timeout flag when phase changes (new night phase)
    useEffect(() => {
        timeoutTriggeredRef.current = false;
    }, [gameState.dayCount]);


    const handleCommit = useCallback(async () => {
        if (!selectedTarget || nightState.hasCommitted || commitStartedRef.current) return;
        commitStartedRef.current = true;

        if (myRole === Role.MAFIA) {
            playKillSound();
        } else if (myRole === Role.DOCTOR) playProtectSound();
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
                        const consensusReached = Math.random() > 0.3; // 70% success in test mode
                        setNightState(prev => ({
                            ...prev,
                            mafiaRevealed: 3,
                            mafiaConsensusTarget: consensusReached ? prev.committedTarget : null
                        }));
                        if (consensusReached) {
                            addLog("[Test] Consensus reached!", "success");
                            playVoteSound();
                        } else {
                            addLog("[Test] Consensus failed: different targets chosen.", "warning");
                            playRejectSound();
                        }
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
                    // Check logic optimized: verifying action
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

    // Auto-reveal effect (formerly NightRevealAuto)
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
    }, [nightState.hasCommitted, nightState.hasRevealed, isProcessing, isTxPending, handleReveal, NIGHT_COMMIT_KEY]);

    const handleSuggestTarget = useCallback((addr: string) => {
        setSelectedTarget(addr as `0x${string}`);
    }, [setSelectedTarget]);

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
                        {nightState.hasRevealed && (myRole !== Role.DETECTIVE || nightState.investigationResult !== null) && (
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
                        className="mb-4 p-4 bg-rose-950/30 rounded-2xl"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-rose-400 text-sm font-medium">Your Fellow Mafia</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {nightState.teammates.map(addr => {
                                const teammate = gameState.players.find(p => p.address.toLowerCase() === addr.toLowerCase());
                                return (
                                    <span key={addr} className={`px-3 py-1 rounded-full text-sm ${teammate?.isAlive ? 'bg-rose-900/50 text-rose-300' : 'bg-gray-900/50 text-gray-500 line-through'}`}>
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
                                        onSuggestTarget={handleSuggestTarget}
                                        messages={gameState.mafiaMessages || []}
                                        onSendMessage={sendMafiaMessageOnChain}
                                    />
                                </div>
                            </motion.div>
                        ) : nightState.hasCommitted ? (
                            <motion.div
                                key="results"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.3 }}
                                className="w-full flex flex-col items-center relative"
                            >
                                <div className="w-full">
                                    {/* Role Specific Results & Pending Status - Extracted to NightActionFeedback */}
                                    <NightActionFeedback
                                        myRole={myRole}
                                        nightState={nightState}
                                        gameState={gameState}
                                    />

                                    {/* Waiting Message - Absolute at the bottom of the content area */}
                                    {nightState.hasRevealed && (
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 whitespace-nowrap">
                                            <p className="text-white/60 text-[8px] tracking-[0.4em] uppercase animate-pulse">Waiting for dawn</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {!nightState.hasCommitted && (
                        <motion.div
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="mt-2 flex flex-col items-center w-full"
                        >
                            {selectedPlayer && (
                                <motion.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className={`p-3 rounded-xl border mb-4 w-full ${myRole === Role.MAFIA ? 'bg-rose-900/15 border-rose-500/40' :
                                        myRole === Role.DOCTOR ? 'bg-teal-900/15 border-teal-500/40' :
                                            'bg-sky-900/15 border-sky-500/40'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-gray-800">
                                                {selectedPlayer.avatarUrl ? (
                                                    <Image src={selectedPlayer.avatarUrl} alt={selectedPlayer.name} fill sizes="40px" className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-indigo-950/50">
                                                        <User className="w-5 h-5 text-white/20" />
                                                    </div>
                                                )}
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
                                data-custom-sound
                            >
                                {selectedTarget ? `${roleConfig.label} ${selectedPlayer?.name}` : 'Select target'}
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
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

    // Primitive dependency for stability
    const phaseDeadline = gameState.phaseDeadline;

    useEffect(() => {
        if (!phaseDeadline) return;

        const tick = () => {
            const now = Math.floor(Date.now() / 1000);
            const diff = Math.max(0, phaseDeadline - now);
            setTimeLeft(diff);
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [phaseDeadline]);

    if (timeLeft <= 0 && !isTxPending) return null;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm shadow-lg"
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
