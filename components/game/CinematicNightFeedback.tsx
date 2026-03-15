// components/game/CinematicNightFeedback.tsx
// Cinematic full-screen overlay for night phase feedback.
// Replaces the old NightActionFeedback with immersive, role-specific visuals.

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Role } from '../../types';
import { Skull, Shield, Search, Moon } from 'lucide-react';
import { useSoundEffects } from '../ui/SoundEffects';

interface CinematicFeedbackProps {
    role: Role;
    targetName?: string;
    investigationResult?: Role | null;
    timeLeft?: number | null;
    isWaitingConsensus?: boolean;
    consensusCount?: number;
    totalMafia?: number;
}

// ── Role config builder ──────────────────────────────────────────────────────

const getRoleConfig = (
    role: Role,
    targetName: string,
    isWaitingConsensus: boolean,
    consensusCount: number,
    totalMafia: number,
    investigationResult?: Role | null,
) => {
    const configs: Record<string, {
        icon: React.ReactNode;
        bgGlow: string;
        border: string;
        bg: string;
        title: string;
        desc: string | undefined;
        accent: string;
        titleColor: string;
    }> = {
        [Role.MAFIA]: {
            icon: <Skull className="w-16 h-16 md:w-20 md:h-20 text-red-700 drop-shadow-[0_0_25px_rgba(185,28,28,0.8)]" />,
            bgGlow: 'shadow-[0_0_60px_rgba(153,27,27,0.15)]',
            border: 'border-red-900/40',
            bg: 'bg-gradient-to-b from-[#3A0A0A]/80 to-black/95',
            title: isWaitingConsensus ? 'AWAITING THE FAMILY' : 'CONTRACT SEALED',
            desc: isWaitingConsensus
                ? `Waiting for consensus on ${targetName}... (${consensusCount}/${totalMafia} agreed)`
                : `The hit is out on ${targetName}. No one can save them now.`,
            accent: 'bg-red-700',
            titleColor: 'text-red-600',
        },
        [Role.DOCTOR]: {
            icon: <Shield className="w-16 h-16 md:w-20 md:h-20 text-teal-500 drop-shadow-[0_0_25px_rgba(20,184,166,0.8)]" />,
            bgGlow: 'shadow-[0_0_60px_rgba(20,184,166,0.15)]',
            border: 'border-teal-900/40',
            bg: 'bg-gradient-to-b from-[#0A2A27]/80 to-black/95',
            title: 'STANDING WATCH',
            desc: `Your medical bag is packed. You are guarding ${targetName}'s door tonight.`,
            accent: 'bg-teal-500',
            titleColor: 'text-teal-400',
        },
        [Role.DETECTIVE]: {
            icon: <Search className="w-16 h-16 md:w-20 md:h-20 text-amber-600 drop-shadow-[0_0_25px_rgba(217,119,6,0.8)]" />,
            bgGlow: 'shadow-[0_0_60px_rgba(217,119,6,0.15)]',
            border: 'border-amber-900/40',
            bg: 'bg-gradient-to-b from-[#3A220A]/80 to-black/95',
            title: investigationResult != null ? 'CASE CLOSED' : 'GATHERING INTEL',
            desc: investigationResult != null
                ? undefined
                : `Following the trail... The dossier on ${targetName} will be ready by dawn.`,
            accent: 'bg-amber-600',
            titleColor: 'text-amber-500',
        },
        [Role.CIVILIAN]: {
            icon: <Moon className="w-16 h-16 md:w-20 md:h-20 text-[#916A47]/60 drop-shadow-[0_0_15px_rgba(145,106,71,0.4)]" />,
            bgGlow: 'shadow-[0_0_40px_rgba(0,0,0,0.8)]',
            border: 'border-[#1A1510]/80',
            bg: 'bg-[#050403]/95',
            title: 'THE TOWN SLEEPS',
            desc: 'You are asleep in your bed. Every sound in the dark makes your heart race. Pray for sunrise.',
            accent: 'bg-[#916A47]',
            titleColor: 'text-[#916A47]',
        },
    };

    return configs[role] || {
        icon: <Moon className="w-16 h-16 md:w-20 md:h-20 text-gray-500" />,
        bgGlow: 'shadow-none',
        border: 'border-gray-800',
        bg: 'bg-black/95',
        title: 'WAITING',
        desc: 'The night continues...',
        accent: 'bg-gray-600',
        titleColor: 'text-gray-400',
    };
};

// ── Component ────────────────────────────────────────────────────────────────

export const CinematicNightFeedback: React.FC<CinematicFeedbackProps> = ({
    role,
    targetName = 'someone',
    investigationResult,
    timeLeft,
    isWaitingConsensus = false,
    consensusCount = 1,
    totalMafia = 1,
}) => {
    const { playMafiaShot, playProtectSound, playInvestigateSound } = useSoundEffects();

    // Play role-specific sealed sound once on mount
    useEffect(() => {
        if (isWaitingConsensus) return;
        if (role === Role.CIVILIAN || role === Role.UNKNOWN) return;

        switch (role) {
            case Role.MAFIA: playMafiaShot(); break;
            case Role.DOCTOR: playProtectSound(); break;
            case Role.DETECTIVE: playInvestigateSound(); break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, isWaitingConsensus]);

    const config = getRoleConfig(role, targetName, isWaitingConsensus, consensusCount, totalMafia, investigationResult);
    const isCivilian = role === Role.CIVILIAN;
    const isSunRising = timeLeft !== null && timeLeft !== undefined && timeLeft <= 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-lg mx-auto flex flex-col items-center"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{
                    scale: isCivilian ? [1, 1.015, 1] : 1,
                    y: 0,
                }}
                transition={{
                    type: isCivilian ? 'tween' : 'spring',
                    damping: 25,
                    stiffness: 300,
                    duration: isCivilian ? 5 : undefined,
                    repeat: isCivilian ? Infinity : 0,
                    repeatType: 'mirror',
                }}
                className={`w-full p-8 md:p-10 rounded-[32px] border ${config.border} ${config.bg} ${config.bgGlow} flex flex-col items-center text-center relative overflow-hidden`}
            >
                {/* Inner vignette */}
                <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.85)] pointer-events-none rounded-[32px]" />

                {/* Role icon */}
                <motion.div
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="mb-5 relative z-10"
                >
                    {config.icon}
                </motion.div>

                {/* Title */}
                <h3 className={`text-2xl md:text-3xl font-['Cinzel'] font-bold tracking-[0.15em] mb-3 drop-shadow-2xl relative z-10 ${config.titleColor}`}>
                    {config.title}
                </h3>

                {/* Description / Investigation result */}
                <AnimatePresence mode="wait">
                    {role === Role.DETECTIVE && investigationResult != null ? (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', delay: 0.1 }}
                            className="relative z-10 p-4 rounded-xl bg-amber-900/30 border border-amber-700/30 w-full max-w-[300px]"
                        >
                            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-500/60 mb-2">Investigation Result</p>
                            <p className="text-xl font-bold text-white">
                                {targetName} is{' '}
                                <span className={investigationResult === Role.MAFIA ? 'text-red-500' : 'text-emerald-400'}>
                                    {investigationResult === Role.MAFIA ? 'GUILTY' : 'CLEAN'}
                                </span>
                            </p>
                        </motion.div>
                    ) : (
                        <motion.p
                            key="desc"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-white/50 text-sm font-medium leading-relaxed max-w-[300px] relative z-10"
                        >
                            {config.desc}
                        </motion.p>
                    )}
                </AnimatePresence>

                {/* Scanning progress bar */}
                <div className="mt-8 w-full max-w-[240px] h-0.5 bg-white/5 rounded-full overflow-hidden relative z-10">
                    <motion.div
                        className={`absolute top-0 bottom-0 w-1/3 ${config.accent} rounded-full blur-[1px]`}
                        animate={{ left: ['-33%', '100%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </div>

                {/* Footer text */}
                <p className={`text-[9px] uppercase tracking-[0.3em] font-bold mt-4 relative z-10 ${isSunRising ? 'text-amber-400/60 animate-pulse' : 'text-white/25'}`}>
                    {isSunRising ? 'The sun is rising...' : 'Awaiting Sunrise'}
                </p>
            </motion.div>
        </motion.div>
    );
};
