// components/game/NightPhase.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient, useAccount, useWalletClient } from 'wagmi';
import { signRequest } from '../../services/requestSigning';
import { MAFIA_ABI } from '../../contracts/config';

import { Role, Player, GamePhase } from '../../types';
import { buildMafiaMembersMessage } from '../../services/signingSchema';

import { Button } from '../ui/Button';
import { MafiaChat } from './MafiaChat';
import { SessionStatusBanner } from './SessionStatusBanner';
import { useSoundEffects } from '../ui/SoundEffects';
import { Moon, Skull, Shield, Search, Eye, Check, Clock, User, Lock, AlertCircle, Users, RefreshCw } from 'lucide-react';
import { CinematicNightFeedback } from './CinematicNightFeedback';
import { emitGameSignal } from '../../services/signalBus';

// Night action types matching contract enum
enum NightActionType {
    NONE = 0,
    KILL = 1,
    HEAL = 2,
    CHECK = 3
}

export interface NightState {
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
        color: 'text-[#8B0000]',
    },
    [Role.DOCTOR]: {
        action: NightActionType.HEAL,
        label: 'Protect',
        icon: <Shield className="w-5 h-5" />,
        color: 'text-[#0D9488]',
    },
    [Role.DETECTIVE]: {
        action: NightActionType.CHECK,
        label: 'Investigate',
        icon: <Search className="w-5 h-5" />,
        color: 'text-[#A85832]',
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
        submitNightActionToGM,
        skipNightActionToGM,
        fetchInvestigationProofFromGM,
        getInvestigationResultOnChain,
        forcePhaseTimeoutOnChain,
        addLog,
        isTxPending,
        selectedTarget,
        setSelectedTarget,
        currentRoomId,
        sendMafiaMessageOnChain,
        isTestMode,
        setGameState,
        runtimeContractAddress
    } = useGameContext();
    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { playKillSound, playProtectSound, playInvestigateSound, playApproveSound, playVoteSound, playRejectSound } = useSoundEffects();

    // Моя роль (defined early for use in callbacks)
    const myRole = myPlayer?.role || Role.UNKNOWN;
    const roleConfig = RoleActions[myRole];

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

    // Can act only if role has action AND player is alive.
    // Once committed, keep showing the role cinematic even if killed mid-night —
    // the player learns about their death from the morning announcement on DAY.
    const canAct = roleConfig.action !== NightActionType.NONE && (myPlayer?.isAlive || nightState.hasCommitted);

    // Timer state for UX
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        if (!gameState.phaseDeadline || gameState.phaseDeadline === 0) {
            setTimeLeft(null);
            return;
        }

        const tick = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = Math.max(0, gameState.phaseDeadline - now);
            setTimeLeft(remaining);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [gameState.phaseDeadline]);

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

    // Clear cinematic flag when night phase unmounts
    useEffect(() => {
        return () => {
            sessionStorage.removeItem('mafia_cinematic_shown');
        };
    }, []);
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
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'getPlayerFlags',
                args: [currentRoomId, address as `0x${string}`],
            }) as [boolean, boolean, boolean, boolean, boolean, boolean, boolean];

            // Mafia consensus removed from contract — night flow is fully GM-resolved off-chain.
            setNightState(prev => {
                // FORCE RECOVERY CHECK: If contract says committed but we don't have it locally
                const needsRecovery = hasCommitted && !prev.hasCommitted;
                if (needsRecovery) {
                    console.log("[NightPhase] Detected state mismatch: Contract committed, Local missing. Triggering recovery...");
                }

                return {
                    ...prev,
                    hasCommitted: prev.hasCommitted || hasCommitted,
                    hasRevealed: prev.hasRevealed || hasRevealed,
                };
            });
        } catch (e) {
            console.error("Failed to sync night state:", e);
        }
    }, [publicClient, currentRoomId, address, isProcessing, isTxPending]);
    // Removed on-chain forceSync (V4: using GM off-chain, chain logs not reliable for ephemeral salts)

//    // Optimize Polling: 2s usually, slower if hidden (adaptive)
//    useEffect(() => {
//        if (isTestMode && initialNightState) return;
//
//        let intervalId: NodeJS.Timeout;
//        const tick = () => syncWithContract();
//
//        const startPolling = () => {
//            const delay = typeof document !== 'undefined' && document.hidden ? 5000 : 2000;
//            intervalId = setInterval(tick, delay);
//        };
//
//        tick(); // Initial
//        startPolling();
//
//        const handleVisibilityCode = () => {
//            clearInterval(intervalId);
//            startPolling();
//        };
//
//        document.addEventListener('visibilitychange', handleVisibilityCode);
//        return () => {
//            clearInterval(intervalId);
//            document.removeEventListener('visibilitychange', handleVisibilityCode);
//        };
//    }, [syncWithContract, isTestMode, initialNightState]);
//
    // === AUTO-SKIP FOR CIVILIANS (and UNKNOWN role — safety net) ===
    // Citizens have no night action. Notify GM immediately so it doesn't wait
    // for the full 3-minute timeout before resolving night.
    const autoSkippedRef = useRef(false);
    useEffect(() => {
        if (isTestMode) return;
        if (!myPlayer?.isAlive) return;
        if (autoSkippedRef.current) return;
        if (nightState.hasCommitted) return;

        // Only auto-skip if this player has no night action (CIVILIAN or UNKNOWN role)
        const needsAutoSkip = false; // Disabled: causes metamask popup for civilians
        if (!needsAutoSkip) return;

        autoSkippedRef.current = true;
        console.log(`[NightPhase] Auto-skipping night action for ${myRole} player...`);
        skipNightActionToGM()
            .then(() => {
                setNightState(prev => ({
                    ...prev,
                    hasCommitted: true,
                    hasRevealed: true,
                    committedTarget: '0x0000000000000000000000000000000000000000' as `0x${string}`
                }));
                console.log('[NightPhase] Auto-skip sent to GM ✅');
            })
            .catch(err => {
                console.warn('[NightPhase] Auto-skip failed (non-blocking):', err.message);
                autoSkippedRef.current = false; // allow retry on next render
            });
    }, [myRole, myPlayer?.isAlive, nightState.hasCommitted, isTestMode, skipNightActionToGM]);


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

    // Name of the committed target (persists after commit for cinematic feedback)
    const committedTargetName = React.useMemo(() => {
        if (!nightState.committedTarget) return 'someone';
        return gameState.players.find(p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase())?.name || 'Unknown';
    }, [gameState.players, nightState.committedTarget]);

    // Storage key for night commit data (unique per room and day to avoid stale data)
    const NIGHT_COMMIT_KEY = `mafia_night_commit_${currentRoomId}_${address ? address.toLowerCase() : ''}_day${gameState.dayCount}`;

    // Restore state from localStorage on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const saved = localStorage.getItem(NIGHT_COMMIT_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                console.log('[NightPhase] Restoring state from localStorage:', data);
                setNightState(prev => ({
                    ...prev,
                    hasCommitted: data.hasCommitted ?? prev.hasCommitted,
                    hasRevealed: data.hasRevealed ?? prev.hasRevealed,
                    committedTarget: data.committedTarget ?? prev.committedTarget,
                    investigationResult: data.investigationResult ?? prev.investigationResult
                }));
            } catch (e) {
                console.error('[NightPhase] Failed to restore from localStorage:', e);
            }
        }
    }, [NIGHT_COMMIT_KEY]);

    // Load mafia teammates via the dedicated /mafia-members endpoint.
    // Historical note: this used to hit /room-roles, which is the post-game
    // public reveal and is hard-gated on phase === ENDED. During NIGHT it
    // always returned { pending: true } and the teammate widget never
    // rendered. The correct endpoint is /mafia-members — gated on NIGHT or
    // ENDED, verifies the caller is actually Mafia, returns only the team.
    const loadMafiaTeammates = useCallback(async () => {
        if (!currentRoomId || !myPlayer || myRole !== Role.MAFIA) return;
        if (nightState.teammates.length > 0) return; // Already loaded

        try {
            const signed = await signRequest({
                address: address as string,
                roomId: Number(currentRoomId),
                walletClient: null,
                buildMessage: ({ nonce, timestamp }) => buildMafiaMembersMessage({
                    roomId: currentRoomId.toString(),
                    nonce,
                    timestamp,
                    chainId,
                }),
            });

            const query = new URLSearchParams({
                roomId: currentRoomId.toString(),
                playerAddress: address as string,
                signerAddress: signed.signerAddress,
                signature: signed.signature,
                nonce: signed.nonce,
                timestamp: signed.timestamp.toString(),
                chainId: chainId?.toString() || '',
            }).toString();

            const res = await fetch(`/api/game/mafia-members?${query}`);
            if (!res.ok) {
                // 403 before NIGHT, 202 pending if roles not resolved yet — retry next cycle
                return;
            }
            const data = await res.json();
            const members = (data?.members as string[] | undefined) ?? [];
            if (members.length === 0) return;

            const myAddrLower = myPlayer.address.toLowerCase();
            const teammates: string[] = [];
            for (const addr of members) {
                if (addr.toLowerCase() === myAddrLower) continue;
                const player = gameState.players.find(p => p.address.toLowerCase() === addr.toLowerCase());
                if (player && player.isAlive) {
                    teammates.push(player.address);
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
    }, [currentRoomId, myPlayer, myRole, gameState.players, nightState.teammates.length, addLog, address, chainId]);

    // Load teammates when mafia enters night phase
    useEffect(() => {
        if (myRole === Role.MAFIA) {
            loadMafiaTeammates();
        }
    }, [myRole, loadMafiaTeammates]);

    // Detective Recovery: Fetch investigation result if already committed but not in local state
    useEffect(() => {
        if (myRole !== Role.DETECTIVE || !nightState.hasCommitted || !nightState.committedTarget || nightState.investigationResult) return;
        if (isProcessing || isTxPending) return;

        const recoverResult = async () => {
            console.log("[Detective] Recovering investigation result for target:", nightState.committedTarget);
            try {
                // 1. Try GM Proof FIRST
                const proof = await fetchInvestigationProofFromGM(nightState.committedTarget as string);
                if (proof && proof.role !== Role.UNKNOWN) {
                    setNightState(prev => ({ ...prev, investigationResult: proof.role }));
                    return;
                }

                // 2. Fallback: On-chain check
                const result = await getInvestigationResultOnChain(address || '', nightState.committedTarget as string);
                if (result && result.role !== Role.UNKNOWN) {
                    setNightState(prev => ({ ...prev, investigationResult: result.role }));
                }
            } catch (e) {
                console.error("[Detective] Recovery failed:", e);
            }
        };

        const timer = setTimeout(recoverResult, 1000);
        return () => clearTimeout(timer);
    }, [myRole, nightState.hasCommitted, nightState.committedTarget, nightState.investigationResult, fetchInvestigationProofFromGM, getInvestigationResultOnChain, address, isProcessing, isTxPending]);

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
                    const { salt, commitHash, committedTarget, hasCommitted: lsCommitted } = JSON.parse(saved);
                    // FIX: If localStorage has hasCommitted=false but chain says committed,
                    // it means the page crashed between TX receipt and localStorage update.
                    // Promote to hasCommitted=true since chain is authoritative.
                    if (!lsCommitted) {
                        console.log("[NightPhase] Promoting localStorage hasCommitted to true (chain is authoritative)");
                        localStorage.setItem(NIGHT_COMMIT_KEY, JSON.stringify({
                            salt, commitHash, committedTarget,
                            action: JSON.parse(saved).action,
                            hasCommitted: true,
                            hasRevealed: false
                        }));
                    }
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
        if (myPlayer?.hasNightCommitted && !nightState.hasCommitted) {
            // GM server knows we acted, but local state isn't showing it (maybe same session reload)
            console.log("[NightPhase] Recovery: hasNightCommitted=true in context, updating local UI state.");
            setNightState(prev => ({ ...prev, hasCommitted: true, hasRevealed: true }));
        }
    }, [myPlayer?.hasNightCommitted, myPlayer?.hasNightRevealed, nightState.hasCommitted, nightState.hasRevealed]);

    // ========== AUTO-TIMEOUT: Force day transition when night timer expires ==========
    const timeoutTriggeredRef = useRef(false);
    const TIMEOUT_BUFFER_SECONDS = 5; // Wait 5 seconds after deadline to allow last-second actions

    useEffect(() => {
        // Skip in test mode
        if (isTestMode) return;

        // Check if we have a valid deadline
        const deadline = gameState.phaseDeadline;
        if (!deadline || deadline === 0) return;

        const checkTimeout = async () => {
            if (timeoutTriggeredRef.current) return;

            const now = Math.floor(Date.now() / 1000);
            const secondsPastDeadline = now - deadline;

            // Waterfall Logic: Any alive player can trigger, but staggered by index
            const sortedSurvivors = [...gameState.players]
                .filter(p => p.isAlive)
                .sort((a, b) => a.address.localeCompare(b.address));

            const myIndex = sortedSurvivors.findIndex(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());

            // If I'm not alive/found, I shouldn't trigger
            if (myIndex === -1) return;

            // Base buffer 5s, plus 5s per index position
            const myTriggerTime = TIMEOUT_BUFFER_SECONDS + (myIndex * 5);

            // LOG FOR DEBUGGING
            if (secondsPastDeadline > 0 && secondsPastDeadline % 10 === 0) {
                 console.log(`[Night Waterfall] Check: Past deadline ${secondsPastDeadline}s, Need ${myTriggerTime}s. Index: ${myIndex}, isTxPending: ${isTxPending}, isProcessing: ${isProcessing}`);
            }

            // If we're past the deadline + buffer + index delay, trigger timeout
            if (secondsPastDeadline >= myTriggerTime) {
                // STUCK-BYPASS: If we are past deadline + our trigger by more than 10s, 
                // ignore isTxPending & isProcessing (they might be stuck local state)
                if ((isProcessing || isTxPending) && secondsPastDeadline < (myTriggerTime + 10)) {
                    return;
                }

                // FIX #4: Re-verify phase from contract before triggering
                if (publicClient && currentRoomId) {
                    try {
                        const roomData = await publicClient.readContract({
                            address: runtimeContractAddress,
                            abi: MAFIA_ABI,
                            functionName: 'getRoom',
                            args: [currentRoomId],
                        }) as any;
                        const onChainPhase = Number(Array.isArray(roomData) ? roomData[3] : roomData.phase);
                        // GamePhase.NIGHT = 5 typically, check if still night
                        if (onChainPhase !== gameState.phase) {
                            console.log(`[NightPhase] Phase already changed (${onChainPhase}), skipping timeout trigger.`);
                            return;
                        }
                    } catch (e) {
                        console.warn('[NightPhase] Could not verify phase, proceeding anyway:', e);
                    }
                }

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
                    // Failure loop protection: cooldown before retrying ANY failed attempt
                    setTimeout(() => {
                        timeoutTriggeredRef.current = false;
                    }, 10_000);
                });
            }
        };

        // Check immediately
        checkTimeout();

        // And poll every 2 seconds
        const interval = setInterval(checkTimeout, 2000);
        return () => clearInterval(interval);
    }, [gameState.phaseDeadline, gameState.players, gameState.phase, myPlayer?.address, isTestMode, isProcessing, isTxPending, forcePhaseTimeoutOnChain, addLog, publicClient, currentRoomId, runtimeContractAddress]);

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
        setIsProcessing(true);

        try {
            if (!isTestMode) {
                const actionType = myRole === Role.MAFIA ? 'kill' : myRole === Role.DOCTOR ? 'heal' : 'check';
                await submitNightActionToGM(actionType, committedTarget);
            } else {
                await new Promise(resolve => setTimeout(resolve, 1500));
                if (myRole === Role.MAFIA) {
                    setNightState(prev => ({ ...prev, mafiaCommitted: 3, mafiaRevealed: 3 }));
                    addLog("[Test] Other Mafia members have committed", "info");
                }

                setGameState(prev => ({
                    ...prev,
                    players: prev.players.map(p =>
                        p.address.toLowerCase() === address?.toLowerCase()
                            ? { ...p, hasNightCommitted: true, hasNightRevealed: true }
                            : p
                    )
                }));
            }

            // GM model: submit = done (no separate reveal step)
            setNightState(prev => ({
                ...prev,
                hasCommitted: true,
                hasRevealed: true,
                committedTarget: committedTarget
            }));

            // Record commit time so GameLayout can guarantee minimum cinematic display
            sessionStorage.setItem('mafia_cinematic_commit_ts', String(Date.now()));

            // Fix: Persist committed target so cinematic restoration doesn't show "someone"
            localStorage.setItem(NIGHT_COMMIT_KEY, JSON.stringify({
                hasCommitted: true,
                hasRevealed: true,
                committedTarget: committedTarget,
                investigationResult: nightState.investigationResult
            }));

            addLog("Your decision is sealed.", "success");
            setSelectedTarget(null);

            // ⚡ INSTANT: Broadcast to all players via LiveKit (~50ms)
            // Others see the N/M committed counter update before next poll cycle
            if (address && currentRoomId) {
                emitGameSignal({
                    type: 'OPTIMISTIC_COMMITTED',
                    player: address.toLowerCase(),
                    roomId: currentRoomId.toString(),
                });
            }

            // Detective: fetch investigation result after submit
            if (myRole === Role.DETECTIVE && committedTarget) {
                const fetchResult = async () => {
                    if (isTestMode) {
                        const testResult = Math.random() > 0.5 ? Role.MAFIA : Role.CIVILIAN;
                        setNightState(prev => ({ ...prev, investigationResult: testResult }));
                        // Reset cinematic timer so detective has time to READ the result
                        sessionStorage.setItem('mafia_cinematic_commit_ts', String(Date.now()));
                        return;
                    }

                    const MAX_RETRIES = 5;
                    for (let i = 0; i < MAX_RETRIES; i++) {
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // Primary check: GM Proof
                        try {
                            const proof = await fetchInvestigationProofFromGM(committedTarget);
                            if (proof && proof.role !== Role.UNKNOWN) {
                                console.log(`[Detective] Investigation proof from GM: ${proof.role}`);
                                // Reset cinematic timer so detective has time to READ the result
                                sessionStorage.setItem('mafia_cinematic_commit_ts', String(Date.now()));
                                setNightState(prev => {
                                    const newState = { ...prev, investigationResult: proof.role };
                                    // Update localStorage with the result
                                    localStorage.setItem(NIGHT_COMMIT_KEY, JSON.stringify({
                                        hasCommitted: newState.hasCommitted,
                                        hasRevealed: newState.hasRevealed,
                                        committedTarget: newState.committedTarget,
                                        investigationResult: newState.investigationResult
                                    }));
                                    return newState;
                                });
                                return;
                            }
                        } catch (e) {
                            console.warn('[Detective] GM proof fetch failed, falling back to chain:', e);
                        }

                        // Fallback: On-chain result
                        const result = await getInvestigationResultOnChain(address || '', committedTarget);
                        if (result && result.role !== Role.UNKNOWN) {
                            console.log(`[Detective] Investigation result from chain: ${result.role}`);
                            // Reset cinematic timer so detective has time to READ the result
                            sessionStorage.setItem('mafia_cinematic_commit_ts', String(Date.now()));
                            setNightState(prev => {
                                const newState = { ...prev, investigationResult: result.role };
                                // Update localStorage with the result
                                localStorage.setItem(NIGHT_COMMIT_KEY, JSON.stringify({
                                    hasCommitted: newState.hasCommitted,
                                    hasRevealed: newState.hasRevealed,
                                    committedTarget: newState.committedTarget,
                                    investigationResult: newState.investigationResult
                                }));
                                return newState;
                            });
                            return;
                        }
                    }
                    addLog("Could not verify investigation. It will be revealed at dawn.", "warning");
                };
                // Fire and forget (don't block the commit success path)
                fetchResult().catch(e => console.error('[Detective] Investigation fetch failed:', e));
            }

            // Mafia: set consensus target optimistically
            if (myRole === Role.MAFIA) {
                setNightState(prev => ({
                    ...prev,
                    mafiaConsensusTarget: committedTarget as `0x${string}`
                }));
            }
        } catch (e: any) {
            addLog(e.message || "Submit failed", "danger");
        } finally {
            setIsProcessing(false);
            commitStartedRef.current = false;
        }
    }, [selectedTarget, nightState.hasCommitted, myRole, gameState.phase, roleConfig.action, submitNightActionToGM, fetchInvestigationProofFromGM, getInvestigationResultOnChain, addLog, playKillSound, playProtectSound, playInvestigateSound, address, setSelectedTarget, setGameState, isTestMode, gameState.players]);

    const handleSkip = useCallback(async () => {
        if (nightState.hasCommitted || isProcessing) return;
        setIsProcessing(true);
        try {
            await skipNightActionToGM();
            setNightState(prev => ({
                ...prev,
                hasCommitted: true,
                hasRevealed: true,
                committedTarget: '0x0000000000000000000000000000000000000000' as `0x${string}`
            }));
            
            // Save state so "someone" is not shown on remount
            localStorage.setItem(NIGHT_COMMIT_KEY, JSON.stringify({
                hasCommitted: true,
                hasRevealed: true,
                committedTarget: '0x0000000000000000000000000000000000000000'
            }));
            
            setSelectedTarget(null);
        } catch (e: any) {
            addLog(e.message || "Skip failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    }, [nightState.hasCommitted, isProcessing, skipNightActionToGM, setSelectedTarget, addLog]);



    const handleSuggestTarget = useCallback((addr: string) => {
        setSelectedTarget(addr as `0x${string}`);
    }, [setSelectedTarget]);

    if (!canAct) {
        const isDead = !myPlayer?.isAlive;
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 no-scrollbar relative">
                <CinematicNightFeedback
                    role={myRole}
                    timeLeft={timeLeft}
                    isDead={isDead}
                />
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
                            <>
                                <h2 className="text-2xl font-['Cinzel'] text-white mb-1">
                                    {myRole === Role.MAFIA && 'Choose your victim'}
                                    {myRole === Role.DOCTOR && 'Choose who to protect'}
                                    {myRole === Role.DETECTIVE && 'Choose who to investigate'}
                                </h2>
                                <p className="text-white/40 text-[10px] tracking-wide">
                                    {myRole === Role.MAFIA ? 'Target to eliminate' : (myRole === Role.DOCTOR ? 'Player to protect' : 'Player to investigate')}
                                </p>
                            </>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Status badge removed — CinematicNightFeedback now handles sealed state */}

                {/* Mafia Teammates */}
                {myRole === Role.MAFIA && nightState.teammates.length > 0 && !nightState.hasCommitted && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-4 bg-[#8B0000]/10 rounded-2xl border border-[#8B0000]/20"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[#8B0000]/70 text-sm font-['Cinzel'] tracking-wider uppercase text-xs">Your Fellow Mafia</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {nightState.teammates.map(addr => {
                                const teammate = gameState.players.find(p => p.address.toLowerCase() === addr.toLowerCase());
                                return (
                                    <span key={addr} className={`px-3 py-1 rounded-full text-sm border ${teammate?.isAlive ? 'bg-[#8B0000]/15 text-[#8B0000]/70 border-[#8B0000]/30' : 'bg-white/5 text-white/50 border-white/10 line-through'}`}>
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
                                key="cinematic"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full"
                            >
                                <CinematicNightFeedback
                                    role={myRole}
                                    targetName={committedTargetName}
                                    investigationResult={nightState.investigationResult}
                                    timeLeft={timeLeft}
                                />
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
                            {/* Reserved space for target selection card */}
                            <div className="w-full min-h-[66px] mb-4 relative">
                                <AnimatePresence>
                                    {selectedPlayer ? (
                                        <motion.div
                                            key="selected-target"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className={`p-3 rounded-sm border w-full h-full shadow-[0_5px_15px_rgba(0,0,0,0.8)] z-10 relative ${myRole === Role.MAFIA ? 'bg-[#1A0505] border-[#8B0000]' :
                                                    myRole === Role.DOCTOR ? 'bg-[#031A18] border-[#0D9488]' :
                                                        myRole === Role.DETECTIVE ? 'bg-[#1A0C06] border-[#A85832]' :
                                                            'bg-[#0A0A0A] border-[#916A47]/30'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-[#19130D]">
                                                        {selectedPlayer.avatarUrl ? (
                                                            <Image src={selectedPlayer.avatarUrl} alt={selectedPlayer.name} fill sizes="40px" className="object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-[#19130D]">
                                                                <User className="w-5 h-5 text-white/50" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="font-bold text-white text-base leading-tight truncate">{selectedPlayer.name}</p>
                                                        <p className="text-white/40 text-[10px] font-mono">{selectedPlayer.address.slice(0, 6)}...{selectedPlayer.address.slice(-4)}</p>
                                                    </div>
                                                </div>
                                                <span className={`${roleConfig.color} font-bold uppercase tracking-wider text-[10px] font-['Cinzel'] shrink-0 ml-2`}>{roleConfig.label}</span>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="no-target"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="absolute inset-0 p-3 rounded-sm border border-[#916A47]/50 bg-[#0A0A0A]/50 shadow-[0_5px_15px_rgba(0,0,0,0.8)] flex items-center justify-center gap-2"
                                        >
                                            <span className="text-[#916A47] text-[10px] tracking-[3px] font-mono font-bold">
                                                CLICK PLAYER TO SELECT
                                            </span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="mb-2">
                                <SessionStatusBanner address={myPlayer?.address} roomId={currentRoomId} isTestMode={isTestMode} />
                            </div>
                            <Button
                                onClick={handleCommit}
                                isLoading={isProcessing || isTxPending}
                                disabled={!selectedTarget || isProcessing || isTxPending}
                                variant="outline-gold"
                                className={`w-full h-[50px] font-['Cinzel'] tracking-[0.08em] text-[13px] uppercase transition-all duration-300 disabled:!brightness-100 ${!selectedTarget
                                    ? 'disabled:!opacity-100 disabled:!brightness-[0.9] !bg-[#1A1612] !border-[#916A47]/30 !text-[#916A47]/40'
                                    : (myRole === Role.MAFIA ? '!text-[#8B0000] !border-[#8B0000] hover:!bg-[#5A0000] hover:!border-[#5A0000] hover:!text-white' :
                                        myRole === Role.DOCTOR ? '!text-[#0D9488] !border-[#0D9488] hover:!bg-[#065F56] hover:!border-[#065F56] hover:!text-white' :
                                            myRole === Role.DETECTIVE ? '!text-[#A85832] !border-[#A85832] hover:!bg-[#7D4225] hover:!border-[#7D4225] hover:!text-white' : '')
                                    }`}
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
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0D0B08] border border-[#916A47]/20 shadow-lg"
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
