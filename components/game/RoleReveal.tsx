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

interface RevealState {
    myRole: Role | null;
    isRevealed: boolean;
    hasConfirmed: boolean;
    hasSharedKeys: boolean;
    eciesRegistered: boolean;
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
        commitAndConfirmRoleOnChain,
        addLog,
        isTxPending,
        setGameState
    } = useGameContext();

    const { address } = useAccount();
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

    // Handle ECIES Registration
    const handleRegisterEcies = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || registerInFlightRef.current) return;
        
        const { isNew } = await loadOrCreateKeypair(currentRoomId.toString(), address);
        // Register if not already registered OR if it's a freshly generated key
        if (revealState.eciesRegistered && !isNew) return;

        registerInFlightRef.current = true;
        try {
            await registerEciesPubkey(currentRoomId.toString(), address, walletClient);
            setRevealState(prev => ({ 
                ...prev, 
                eciesRegistered: true,
                // If it's a new key, reset the flow to re-share keys with the new pubkey
                ...(isNew && { hasSharedKeys: false, isRevealed: false, myRole: null })
            }));
            console.log("[RoleReveal] ECIES registered successfully");
        } catch (e) {
            console.error("[RoleReveal] ECIES registration failed:", e);
        } finally {
            registerInFlightRef.current = false;
        }
    }, [currentRoomId, address, walletClient, revealState.eciesRegistered]);

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
                walletClient
            });

            setRevealState(prev => ({ ...prev, hasSharedKeys: true }));
            console.log("[RoleReveal] SRA key submitted to GM");
        } catch (e: any) {
            console.error("[RoleReveal] SRA submission failed:", e);
            addLog(e.message || "Failed to submit SRA key", "danger");
            
            // Retry after 3 seconds by allowing the effect to trigger this again
            setTimeout(() => {
                submitInFlightRef.current = false;
            }, 3000);
            return; // Don't reset flag immediately in finally
        } finally {
            setIsProcessing(false);
            // Only reset if it didn't fail (in success case) or if we don't want retry
            // But here we want the timeout to handle the reset on failure
            if (revealState.hasSharedKeys) {
                submitInFlightRef.current = false;
            }
        }
    }, [currentRoomId, address, walletClient, revealState.hasSharedKeys, addLog]);

    // Handle Role Fetching
    const handleFetchRole = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || revealState.isRevealed || revealState.hasConfirmed || !revealState.hasSharedKeys || fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        try {
            const role = await fetchMyRoleFromGm({
                roomId: currentRoomId.toString(),
                address,
                walletClient
            });

            if (role) {
                // Save to localStorage
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
    }, [currentRoomId, address, walletClient, revealState.isRevealed, revealState.hasConfirmed, revealState.hasSharedKeys, addLog, setGameState]);

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

            // Save salt for future reference if needed
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

        // Sequence: Register ECIES -> Submit SRA -> Fetch Role -> Auto-Confirm
        if (!revealState.eciesRegistered) {
            handleRegisterEcies();
        } else if (!revealState.hasSharedKeys) {
            handleShareKey();
        } else if (!revealState.isRevealed && !revealState.hasConfirmed) {
            const interval = setInterval(handleFetchRole, 2000); // Poll every 2s
            return () => clearInterval(interval);
        } else if (!revealState.hasConfirmed && !isProcessing && !isTxPending) {
            // Auto-confirm role after a 4 second delay so the user can read it
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

    // UI
    const roleConfig = revealState.myRole ? RoleConfig[revealState.myRole] : RoleConfig[Role.UNKNOWN];
    const keysCollected = gameState.players.filter(p => p.hasConfirmedRole).length;
    const keysNeeded = gameState.players.length;

    return (
        <div className="w-full h-[100dvh] flex flex-col items-center overflow-y-auto overflow-x-hidden p-8 custom-scrollbar">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg w-full my-auto"
            >
                <AnimatePresence mode="wait">
                    {!revealState.isRevealed ? (
                        <motion.div
                            key="exchange"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl"
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
                            transition={{ type: "spring", duration: 0.8 }}
                            className={`bg-gradient-to-br ${roleConfig.bgColor} backdrop-blur-xl rounded-3xl border border-white/20 p-12 shadow-2xl w-[400px] h-[400px] flex flex-col justify-between mx-auto`}
                        >
                            <div className="text-center flex-1 flex flex-col justify-center">
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className={`text-4xl font-['Cinzel'] mb-6 ${roleConfig.color}`}
                                >
                                    {revealState.myRole}
                                </motion.h2>
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
                                    <div className="flex items-center justify-center gap-2 text-[#916A47] py-4">
                                        <Check className="w-5 h-5" />
                                        <span>Role Confirmed!</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
});

RoleReveal.displayName = 'RoleReveal';
