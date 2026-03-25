// components/game/RoleReveal.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { useAccount, useWalletClient } from 'wagmi';
import { Role, GamePhase } from '../../types';

import { Check, Users, Skull, Shield, Search, Loader2, EyeOff } from 'lucide-react';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { registerEciesPubkey, submitSraKeyToGm, fetchMyRoleFromGm } from '../../services/gmService';
import { loadOrCreateKeypair } from '../../services/eciesService';

interface RevealState {
    myRole: Role | null;
    isRevealed: boolean;
    hasConfirmed: boolean;
    hasSharedKeys: boolean;
    eciesRegistered: boolean;
}

interface AsciiSpinnerProps {
    className?: string;
}

const AsciiSpinner: React.FC<AsciiSpinnerProps> = ({ className = '' }) => {
    const [frame, setFrame] = useState(0);
    const frames = ['|', '/', '-', '\\'];
    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(prev => (prev + 1) % frames.length);
        }, 120);
        return () => clearInterval(interval);
    }, []);
    return <span className={`font-mono font-bold inline-block ${className}`}>{frames[frame]}</span>;
};

const RoleConfig: Record<Role, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string; ringColor: string; description: string; label: string }> = {
    [Role.MAFIA]: {
        icon: <Skull className="w-16 h-16" />,
        color: 'text-[#8B0000]',
        bgColor: 'from-[#8B0000]/25 to-[#0A0705]/80',
        borderColor: 'border-[#8B0000]/30',
        ringColor: 'ring-[#8B0000]/10',
        label: 'MAFIA',
        description: 'Eliminate all civilians to win. Vote by day, kill by night.'
    },
    [Role.DOCTOR]: {
        icon: <Shield className="w-16 h-16" />,
        color: 'text-[#2D6A4F]',
        bgColor: 'from-[#1B4332]/30 to-[#0A0705]/80',
        borderColor: 'border-[#2D6A4F]/25',
        ringColor: 'ring-[#2D6A4F]/8',
        label: 'DOCTOR',
        description: 'Save one player each night from the mafia attack.'
    },
    [Role.DETECTIVE]: {
        icon: <Search className="w-16 h-16" />,
        color: 'text-[#94A3B8]',
        bgColor: 'from-[#1E293B]/30 to-[#0A0705]/80',
        borderColor: 'border-[#94A3B8]/20',
        ringColor: 'ring-[#94A3B8]/8',
        label: 'DETECTIVE',
        description: 'Investigate one player each night to reveal their alignment.'
    },
    [Role.CIVILIAN]: {
        icon: <Users className="w-16 h-16" />,
        color: 'text-[#78716C]',
        bgColor: 'from-[#292524]/40 to-[#0A0705]/80',
        borderColor: 'border-[#78716C]/20',
        ringColor: 'ring-[#78716C]/8',
        label: 'CIVILIAN',
        description: 'Find and vote out the mafia during the day to survive.'
    },
    [Role.UNKNOWN]: {
        icon: <EyeOff className="w-16 h-16" />,
        color: 'text-stone-600',
        bgColor: 'from-stone-950/50 to-[#0A0705]/80',
        borderColor: 'border-stone-700/20',
        ringColor: 'ring-stone-700/8',
        label: 'UNKNOWN',
        description: 'Role unknown'
    }
};

export const RoleReveal: React.FC = React.memo(() => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        commitAndConfirmRoleOnChain,
        addLog,
        isTxPending,
        setGameState,
        isTestMode
    } = useGameContext();

    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();

    const [revealState, setRevealState] = useState<RevealState>({
        myRole: null,
        isRevealed: false,
        hasConfirmed: false,
        hasSharedKeys: false,
        eciesRegistered: false
    });
    const [isProcessing, setIsProcessing] = useState(false);

    // Guard refs
    const registerInFlightRef = useRef(false);
    const submitInFlightRef = useRef(false);
    const fetchInFlightRef = useRef(false);

    // Sync hasConfirmed with contract
    useEffect(() => {
        if (myPlayer?.hasConfirmedRole && !revealState.hasConfirmed) {
            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
        }
    }, [myPlayer?.hasConfirmedRole, revealState.hasConfirmed]);

    // Test mode simulation
    useEffect(() => {
        if (isTestMode && myPlayer) {
            const hasStartedRevealing = gameState.revealedCount >= gameState.players.length;
            
            if (myPlayer.hasConfirmedRole) {
                 setRevealState({
                    myRole: myPlayer.role,
                    isRevealed: true,
                    hasSharedKeys: true,
                    eciesRegistered: true,
                    hasConfirmed: true
                 });
            } else if (hasStartedRevealing) {
                 setRevealState({
                    myRole: myPlayer.role,
                    isRevealed: true,
                    hasSharedKeys: true,
                    eciesRegistered: true,
                    hasConfirmed: false
                 });
            } else {
                 setRevealState({
                    myRole: null,
                    isRevealed: false,
                    hasSharedKeys: true,
                    eciesRegistered: true,
                    hasConfirmed: false
                 });
            }
        }
    }, [isTestMode, myPlayer, gameState.revealedCount, gameState.players.length]);

    // Handle ECIES Registration
    const handleRegisterEcies = useCallback(async (retryWithWallet = false) => {
        if (!currentRoomId || !address || !walletClient || registerInFlightRef.current) return;

        const { isNew } = await loadOrCreateKeypair(currentRoomId.toString(), address);
        if (revealState.eciesRegistered && !isNew && !retryWithWallet) return;

        registerInFlightRef.current = true;
        try {
            let registered = false;
            let lastError: any = null;
            
            for (let i = 0; i < 6; i++) {
                try {
                    const forceWallet = retryWithWallet || i >= 3;
                    console.log(`[RoleReveal] ECIES registration attempt ${i+1}/6 (forceWallet=${forceWallet})`);
                    await registerEciesPubkey(currentRoomId.toString(), address, walletClient, chainId, forceWallet);
                    registered = true;
                    break;
                } catch (err) {
                    lastError = err;
                    console.warn(`[RoleReveal] ECIES registration attempt ${i+1} failed:`, err);
                    if (i < 5) await new Promise(r => setTimeout(r, 2000));
                }
            }
            
            if (!registered) throw lastError;

            setRevealState(prev => ({
                ...prev,
                eciesRegistered: true,
                ...(isNew && { hasSharedKeys: false, isRevealed: false, myRole: null })
            }));
            console.log("[RoleReveal] ECIES registered successfully");
        } catch (e: any) {
            console.error("[RoleReveal] ECIES registration completely failed after retries:", e);
            addLog(e.message || "ECIES registration failed", "danger");
        } finally {
            registerInFlightRef.current = false;
        }
    }, [currentRoomId, address, walletClient, chainId, revealState.eciesRegistered]);

    // Handle SRA Key submission
    const handleShareKey = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || revealState.hasSharedKeys || submitInFlightRef.current) return;
        submitInFlightRef.current = true;
        setIsProcessing(true);
        try {
            const shuffleService = getShuffleService();
            if (!shuffleService.hasKeys()) {
                const loaded = shuffleService.loadKeys(currentRoomId.toString(), address);
                if (!loaded) {
                    addLog('Session keys lost — please rejoin the room', 'danger');
                    return;
                }
            }
            const sraKey = shuffleService.getDecryptionKey();
            
            let submitted = false;
            let lastError: any = null;

            for (let i = 0; i < 6; i++) {
                try {
                    console.log(`[RoleReveal] SRA key submission attempt ${i+1}/6`);
                    await submitSraKeyToGm({
                        roomId: currentRoomId.toString(),
                        address,
                        sraKey,
                        walletClient,
                        chainId
                    });
                    submitted = true;
                    break;
                } catch (err: any) {
                    lastError = err;
                    console.warn(`[RoleReveal] SRA submission attempt ${i+1} failed:`, err.message);
                    if (i < 5) await new Promise(r => setTimeout(r, 2000));
                }
            }

            if (!submitted) throw lastError;

            setRevealState(prev => ({ ...prev, hasSharedKeys: true }));
            console.log("[RoleReveal] SRA key submitted to GM ✅");
        } catch (e: any) {
            console.error("[RoleReveal] SRA submission failed:", e);
            addLog(e.message || "Failed to submit SRA key", "danger");

            setTimeout(() => {
                submitInFlightRef.current = false;
            }, 3000);
            return;
        } finally {
            setIsProcessing(false);
            if (revealState.hasSharedKeys) {
                submitInFlightRef.current = false;
            }
        }
    }, [currentRoomId, address, walletClient, chainId, revealState.hasSharedKeys, addLog]);

    // Handle Role Fetching
    const handleFetchRole = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || revealState.isRevealed || revealState.hasConfirmed || !revealState.hasSharedKeys || fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        try {
            const role = await fetchMyRoleFromGm({
                roomId: currentRoomId.toString(),
                address,
                walletClient,
                chainId
            });

            if (role) {
                localStorage.setItem(`my_role_${currentRoomId}_${address.toLowerCase()}`, role);

                setRevealState(prev => ({
                    ...prev,
                    myRole: role,
                    isRevealed: true
                }));

                setGameState(prev => ({
                    ...prev,
                    players: prev.players.map(p =>
                        p.address.toLowerCase() === address.toLowerCase()
                            ? { ...p, role }
                            : p
                    ),
                }));

                addLog(`Your role: ${role}`, "success");
            }
        } catch (e: any) {
            console.error("[RoleReveal] Role fetch failed:", e);
        } finally {
            fetchInFlightRef.current = false;
        }
    }, [currentRoomId, address, walletClient, chainId, revealState.isRevealed, revealState.hasConfirmed, revealState.hasSharedKeys, addLog, setGameState]);

    // Handle Confirmation
    const handleConfirmRole = useCallback(async () => {
        if (revealState.myRole === null || revealState.hasConfirmed || isProcessing || isTxPending) return;
        setIsProcessing(true);

        const roleMap: Record<Role, number> = {
            [Role.MAFIA]: 1,
            [Role.DOCTOR]: 2,
            [Role.DETECTIVE]: 3,
            [Role.CIVILIAN]: 4,
            [Role.UNKNOWN]: 0
        };

        const roleNum = roleMap[revealState.myRole] || 4;

        try {
            const existingSalt = (currentRoomId && address)
                ? localStorage.getItem(`role_salt_${currentRoomId}_${address.toLowerCase()}`)
                : null;
            const salt = existingSalt || ShuffleService.generateSalt();

            await commitAndConfirmRoleOnChain(roleNum, salt);

            if (currentRoomId && address) {
                localStorage.setItem(`role_salt_${currentRoomId}_${address.toLowerCase()}`, salt);
            }

            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
        } catch (e: any) {
            console.error("[RoleReveal] Confirmation failed:", e);
            const errMsg = (e.message || '').toLowerCase();
            if (errMsg.includes('alreadyconfirmed') || errMsg.includes('alreadyrevealed')) {
                setRevealState(prev => ({ ...prev, hasConfirmed: true }));
            } else {
                addLog(e.message || "Failed to confirm role", "danger");
            }
        } finally {
            setIsProcessing(false);
        }
    }, [revealState.myRole, revealState.hasConfirmed, isProcessing, isTxPending, commitAndConfirmRoleOnChain, currentRoomId, address, addLog]);

    // Automatic flow trigger
    useEffect(() => {
        if (gameState.phase !== GamePhase.REVEAL) return;

        if (!revealState.eciesRegistered) {
            handleRegisterEcies();
        } else if (!revealState.hasSharedKeys) {
            handleShareKey();
        } else if (!revealState.isRevealed && !revealState.hasConfirmed) {
            const interval = setInterval(handleFetchRole, 2000);
            return () => clearInterval(interval);
        } else if (!revealState.hasConfirmed && !isProcessing && !isTxPending) {
            const timeout = setTimeout(() => {
                handleConfirmRole();
            }, 4000);
            return () => clearTimeout(timeout);
        }
    }, [
        gameState.phase,
        revealState.eciesRegistered,
        revealState.hasSharedKeys,
        revealState.isRevealed,
        revealState.hasConfirmed,
        isProcessing,
        isTxPending,
        handleRegisterEcies,
        handleShareKey,
        handleFetchRole,
        handleConfirmRole,
        walletClient
    ]);

    // ─── UI ─────────────────────────────────────────────────────────────────
    const roleConfig = revealState.myRole ? RoleConfig[revealState.myRole] : RoleConfig[Role.UNKNOWN];
    const keysCollected = gameState.players.filter(p => p.hasConfirmedRole).length;
    const keysNeeded = gameState.players.length;

    return (
        <div className="w-full h-[100dvh] flex flex-col items-center justify-center overflow-hidden p-4 pointer-events-auto">
            <div
                className="w-full max-w-[740px] bg-[#060403] rounded-sm border border-[#916A47]/20 shadow-[0_40px_80px_rgba(0,0,0,0.97)] flex flex-col overflow-hidden"
            >
                {/* ── HEADER ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#916A47]/15 bg-black/50">
                    <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[12px] tracking-[0.3em] text-[#916A47] uppercase">CASE FILE</span>
                        <span className="text-[#916A47]/50">//</span>
                        <span className="font-mono text-[12px] tracking-[0.2em] text-white/55 uppercase">
                            ROOM_{currentRoomId?.toString() || '???'}
                        </span>
                    </div>
                    <span className="font-mono text-[11px] tracking-[0.25em] text-white/45 uppercase">ROLE REVEAL</span>
                </div>

                {/* ── BODY ───────────────────────────────────────────── */}
                <div className="flex min-h-[400px]">

                    {/* LEFT — Suspects */}
                    <div className="w-[210px] shrink-0 border-r border-[#916A47]/10 flex flex-col">
                        <div className="px-4 py-3 border-b border-[#916A47]/8 flex items-center justify-between">
                            <span className="font-mono text-[11px] tracking-[0.3em] text-white/55 uppercase">SUSPECTS</span>
                            <span className="font-mono text-[10px] text-[#916A47]/70">{keysCollected}/{keysNeeded}</span>
                        </div>
                        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                            {gameState.players.map((player) => {
                                const isMe = player.address.toLowerCase() === address?.toLowerCase();
                                const hasConfirmed = player.hasConfirmedRole;
                                return (
                                    <div
                                        key={player.address}
                                        className={`flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] transition-all ${isMe ? 'bg-[#916A47]/5' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`text-[11px] shrink-0 ${
                                                hasConfirmed ? 'text-[#916A47]' :
                                                isMe ? 'text-[#916A47]/60 animate-pulse' :
                                                'text-white/35'
                                            }`}>●</span>
                                            <span className={`font-mono text-[13px] truncate ${isMe ? 'text-[#916A47]' : 'text-white/70'}`}>
                                                {player.name}{isMe ? '_YOU' : ''}
                                            </span>
                                        </div>
                                        <span className={`font-mono text-[10px] tracking-wider shrink-0 ml-1 ${hasConfirmed ? 'text-[#916A47]' : 'text-white/35'}`}>
                                            {hasConfirmed ? 'CONF' : 'WAIT_'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT — Role content */}
                    <div className="flex-1 flex flex-col items-center justify-center p-6">
                        <AnimatePresence mode="wait">
                            {!revealState.isRevealed ? (
                                // Loading state
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center gap-5 text-center"
                                >
                                    <div className="h-10 flex items-center justify-center opacity-80 mb-2 mt-4">
                                        <AsciiSpinner className="text-[#916A47] text-3xl" />
                                    </div>
                                    <div>
                                        <p className="font-mono text-[10px] tracking-[0.35em] text-white/50 uppercase mb-2">&gt; STATUS</p>
                                        <p className="font-mono text-[16px] tracking-wide text-white/80 uppercase">
                                            {!revealState.eciesRegistered ? 'SECURING_CHANNEL' :
                                                !revealState.hasSharedKeys ? 'DECRYPTING_DOSSIER' :
                                                    'VERIFYING_IDENTITY'}
                                            <span className="animate-pulse ml-1 text-[#916A47]">▌</span>
                                        </p>
                                    </div>
                                    <div className="w-full max-w-[220px]">
                                        <div className="h-[2px] bg-black/70 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-[#916A47] rounded-full"
                                                animate={{ width: revealState.hasSharedKeys ? '100%' : '50%' }}
                                                transition={{ duration: 0.6 }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                // Role card
                                <motion.div
                                    key="revealed"
                                    initial={{ opacity: 0, rotateY: 90 }}
                                    animate={{ opacity: 1, rotateY: 0 }}
                                    transition={{ type: "spring", duration: 0.8 }}
                                    className={`bg-gradient-to-br ${roleConfig.bgColor} w-[240px] aspect-[3/4] rounded-sm border ${roleConfig.borderColor} ring-1 ${roleConfig.ringColor} p-6 shadow-[0_30px_60px_rgba(0,0,0,0.98)] relative overflow-hidden flex flex-col justify-between`}
                                >
                                    {/* SVG Noise */}
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
                                        <filter id="noise-rr2">
                                            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
                                            <feColorMatrix type="saturate" values="0" />
                                        </filter>
                                        <rect width="100%" height="100%" filter="url(#noise-rr2)" />
                                    </svg>

                                    {/* Watermark icon */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 0.08, scale: 1 }}
                                        transition={{ delay: 0.2, duration: 1 }}
                                        className={`absolute top-4 right-4 ${roleConfig.color}`}
                                    >
                                        {roleConfig.icon}
                                    </motion.div>

                                    {/* CLASSIFIED stamp */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.6 }}
                                        className={`absolute bottom-14 left-3 font-mono text-[7px] tracking-[0.3em] uppercase px-1 py-[2px] border ${roleConfig.borderColor} ${roleConfig.color} opacity-20 rotate-[-7deg] select-none pointer-events-none`}
                                    >
                                        CLASSIFIED
                                    </motion.div>

                                    {/* Pulsing border */}
                                    <motion.div
                                        className={`absolute inset-0 border ${roleConfig.borderColor}`}
                                        animate={{ opacity: [0.2, 0.5, 0.2] }}
                                        transition={{ duration: 4, repeat: Infinity }}
                                    />

                                    {/* Content */}
                                    <div className="text-center flex-1 flex flex-col justify-center relative z-10">
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.15 }}
                                            className="font-mono text-[7px] tracking-[0.3em] text-white/35 uppercase mb-3"
                                        >
                                            CASE FILE // ROLE
                                        </motion.p>
                                        <motion.h2
                                            initial={{ opacity: 0, y: 15 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                            className={`text-2xl font-['Cinzel'] mb-3 ${roleConfig.color}`}
                                        >
                                            {revealState.myRole}
                                        </motion.h2>
                                        <motion.div
                                            initial={{ scaleX: 0 }}
                                            animate={{ scaleX: 1 }}
                                            transition={{ delay: 0.45, duration: 0.5 }}
                                            className="h-px w-10 mx-auto mb-3 opacity-30"
                                            style={{ background: 'currentColor' }}
                                        />
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.55 }}
                                            className="text-white/40 text-[10px] font-mono leading-relaxed tracking-wide max-w-[170px] mx-auto"
                                        >
                                            {roleConfig.description}
                                        </motion.p>
                                    </div>

                                    {/* Confirm button */}
                                    <div className="relative z-10">
                                        {!revealState.hasConfirmed ? (
                                            <motion.button
                                                onClick={handleConfirmRole}
                                                disabled={isProcessing || isTxPending}
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.98 }}
                                                className={`w-full py-2.5 px-4 rounded-sm border font-['Cinzel'] text-[9px] tracking-[0.25em] uppercase transition-all duration-300
                                                    border-[#8B0000]/30 text-white/50
                                                    bg-transparent hover:bg-[#8B0000]/12 hover:border-[#8B0000]/55 hover:text-white/80
                                                    disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                                            >
                                                {(isProcessing || isTxPending)
                                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Confirming...</>
                                                    : 'I Understand My Role'}
                                            </motion.button>
                                        ) : (
                                            <div className={`flex items-center justify-center gap-2 ${roleConfig.color} py-3`}>
                                                <Check className="w-4 h-4" />
                                                <span className="font-['Cinzel'] text-[9px] tracking-[0.2em] uppercase">Confirmed</span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
});

RoleReveal.displayName = 'RoleReveal';
