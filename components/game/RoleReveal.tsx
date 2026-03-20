// components/game/RoleReveal.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { useAccount, useWalletClient } from 'wagmi';
import { Role, GamePhase } from '../../types';
import { Button } from '../ui/Button';
import { Check, Users, Skull, Shield, Search, Loader2, EyeOff } from 'lucide-react';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { registerEciesPubkey, submitSraKeyToGm, fetchMyRoleFromGm } from '../../services/gmService';
import { loadOrCreateKeypair } from '../../services/eciesService';
import { useSoundEffects } from '../ui/SoundEffects';
import { CinematicOverlay } from './CinematicOverlay';

interface RevealState {
    myRole: Role | null;
    isRevealed: boolean;
    hasConfirmed: boolean;
    hasSharedKeys: boolean;
    eciesRegistered: boolean;
}

const RoleConfig: Record<Role, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string; description: string; accentColor: string }> = {
    [Role.MAFIA]: {
        icon: <Skull className="w-16 h-16" />,
        color: 'text-[#8B0000]',
        bgColor: 'from-[#8B0000]/40 to-[#8B0000]/20',
        borderColor: 'border-[#8B0000]/30',
        accentColor: '#8B0000',
        description: 'Eliminate all civilians to win. Vote by day, kill by night.'
    },
    [Role.DOCTOR]: {
        icon: <Shield className="w-16 h-16" />,
        color: 'text-[#0D9488]',
        bgColor: 'from-[#0D9488]/40 to-[#0D9488]/20',
        borderColor: 'border-[#0D9488]/30',
        accentColor: '#0D9488',
        description: 'Save one player each night from the mafia attack.'
    },
    [Role.DETECTIVE]: {
        icon: <Search className="w-16 h-16" />,
        color: 'text-[#B45309]',
        bgColor: 'from-[#B45309]/40 to-[#B45309]/20',
        borderColor: 'border-[#B45309]/30',
        accentColor: '#B45309',
        description: 'Investigate one player each night to reveal their alignment.'
    },
    [Role.CIVILIAN]: {
        icon: <Users className="w-16 h-16" />,
        color: 'text-[#6B5A4A]',
        bgColor: 'from-[#6B5A4A]/40 to-[#6B5A4A]/20',
        borderColor: 'border-[#6B5A4A]/30',
        accentColor: '#6B5A4A',
        description: 'Find and vote out the mafia during the day to survive.'
    },
    [Role.UNKNOWN]: {
        icon: <EyeOff className="w-16 h-16" />,
        color: 'text-gray-500',
        bgColor: 'from-gray-950/50 to-gray-900/30',
        borderColor: 'border-gray-500/20',
        accentColor: '#333333',
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
        setGameState
    } = useGameContext();

    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { playApproveSound } = useSoundEffects();

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

    // Handle ECIES Registration
    const handleRegisterEcies = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || registerInFlightRef.current) return;
        
        const { isNew } = await loadOrCreateKeypair(currentRoomId.toString(), address);
        // Register if not already registered OR if it's a freshly generated key
        if (revealState.eciesRegistered && !isNew) return;

        registerInFlightRef.current = true;
        try {
            await registerEciesPubkey(currentRoomId.toString(), address, walletClient, chainId);
            setRevealState(prev => ({ 
                ...prev, 
                eciesRegistered: true,
                ...(isNew && { hasSharedKeys: false, isRevealed: false, myRole: null })
            }));
        } catch (e) {
            console.error("[RoleReveal] ECIES registration failed:", e);
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

            await submitSraKeyToGm({
                roomId: currentRoomId.toString(),
                address,
                sraKey,
                walletClient,
                chainId
            });

            setRevealState(prev => ({ ...prev, hasSharedKeys: true }));
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

                playApproveSound();

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
            }, 10000); // Give user enough time to see the beautiful cinematic card
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
        handleConfirmRole
    ]);

    // UI
    const roleConfig = revealState.myRole ? RoleConfig[revealState.myRole] : RoleConfig[Role.UNKNOWN];

    const backgroundElements = (
        <React.Fragment>
            {revealState.isRevealed && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
                >
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.1, 0.2, 0.1]
                        }}
                        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                        className="w-[120vw] h-[120vw] rounded-full blur-[150px]"
                        style={{ backgroundColor: roleConfig.accentColor }}
                    />
                </motion.div>
            )}
            <div className="absolute inset-0 opacity-20">
                {/* Dust particles */}
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                            y: [0, -100, 0],
                            x: [0, Math.random() * 50 - 25, 0],
                            opacity: [0, 0.5, 0]
                        }}
                        transition={{
                            duration: 5 + Math.random() * 10,
                            repeat: Infinity,
                            delay: Math.random() * 5
                        }}
                    />
                ))}
            </div>
        </React.Fragment>
    );

    return (
        <CinematicOverlay 
            show={true} // Always show while in REVEAL phase
            backgroundElements={backgroundElements}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg w-full flex flex-col items-center"
            >
                <AnimatePresence mode="wait">
                    {!revealState.isRevealed ? (
                        <motion.div
                            key="exchange"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-black/60 backdrop-blur-xl rounded-xl border border-[#916A47]/30 p-8 shadow-2xl w-full"
                        >
                            <div className="text-center mb-6">
                                <div className="w-10 h-10 mx-auto mb-3 relative">
                                    <motion.div
                                        animate={{ x: [-3, 3, -3], rotate: [-5, 5, -5] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-[#916A47]">
                                            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                                            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </motion.div>
                                </div>
                                <h2 className="text-2xl font-['Cinzel'] text-white mb-1">Role Reveal</h2>
                                <p className="text-white/40 text-[13px]">
                                    {!revealState.eciesRegistered ? 'Registering ECIES...' :
                                        !revealState.hasSharedKeys ? 'Submitting SRA key...' :
                                            'Waiting for GM response...'}
                                </p>
                            </div>

                            <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-4">
                                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#916A47]/10">
                                    <Loader2 className="w-4 h-4 text-[#916A47] animate-spin" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] mb-1.5">
                                        <span className="text-white/40 uppercase">EXCHANGING DATA OFF-CHAIN...</span>
                                    </div>
                                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-[#916A47] to-[#c9a227]"
                                            animate={{ width: revealState.hasSharedKeys ? '100%' : '50%' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="revealed"
                            initial={{ opacity: 0, rotateY: 90 }}
                            animate={{ opacity: 1, rotateY: 0 }}
                            transition={{ type: "spring", stiffness: 100, damping: 20, duration: 0.8 }}
                            className={`bg-gradient-to-br ${roleConfig.bgColor} backdrop-blur-xl rounded-2xl border ${roleConfig.borderColor} p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-[400px] aspect-[4/5] flex flex-col justify-between mx-auto relative overflow-hidden`}
                        >
                            {/* Role icon — watermark in top-right */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 0.12, scale: 1 }}
                                transition={{ delay: 0.5, duration: 1.5 }}
                                className={`absolute top-8 right-8 ${roleConfig.color}`}
                            >
                                {roleConfig.icon}
                            </motion.div>

                            {/* Pulsing border glow */}
                            <motion.div
                                className={`absolute inset-0 rounded-2xl border ${roleConfig.borderColor}`}
                                animate={{ opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            />

                            <div className="text-center flex-1 flex flex-col justify-center">
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                    className={`text-5xl font-['Cinzel'] mb-8 ${roleConfig.color} tracking-widest uppercase mix-blend-plus-lighter`}
                                >
                                    {revealState.myRole}
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                    className="text-white/70 text-sm font-sans tracking-wide leading-relaxed max-w-xs mx-auto"
                                >
                                    {roleConfig.description}
                                </motion.p>
                            </div>

                            <div className="space-y-3 mt-8">
                                {!revealState.hasConfirmed ? (
                                    <Button
                                        onClick={handleConfirmRole}
                                        isLoading={isProcessing || isTxPending}
                                        disabled={isProcessing || isTxPending}
                                        className="w-full font-['Cinzel'] tracking-widest uppercase"
                                        style={{ 
                                            backgroundColor: `${roleConfig.accentColor}44`, 
                                            borderColor: `${roleConfig.accentColor}88`,
                                            color: 'white'
                                        }}
                                    >
                                        I Understand My Role
                                    </Button>
                                ) : (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center justify-center gap-3 py-4 text-white/90"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                                            <Check className="w-5 h-5" />
                                        </div>
                                        <span className="font-['Cinzel'] tracking-widest uppercase text-sm">Role Confirmed</span>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </CinematicOverlay>
    );
});

RoleReveal.displayName = 'RoleReveal';
