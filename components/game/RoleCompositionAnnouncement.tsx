import React, { useEffect, useMemo } from 'react';
import type { Transition } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Shield, Search, Users } from 'lucide-react';

interface RoleCompositionAnnouncementProps {
    show: boolean;
    onComplete: () => void;
    playerCount: number;
}

interface RoleEntry {
    name: string;
    count: number;
    icon: React.ReactNode;
    color: string;
}

export const RoleCompositionAnnouncement = React.memo(({ show, onComplete, playerCount }: RoleCompositionAnnouncementProps) => {

    const roles: RoleEntry[] = useMemo(() => {
        // Must mirror LibGame.expectedMafiaCount on-chain and shuffleService.ts.
        // Contract enforces this at revealRoles — if client shows wrong number,
        // players feel misled vs. what the game actually deals.
        const mafiaCount = playerCount <= 5 ? 1 : playerCount <= 8 ? 2 : playerCount <= 11 ? 3 : 4;
        const hasDoctor = playerCount >= 4;
        const hasDetective = playerCount >= 5;
        const specialRoles = mafiaCount + (hasDoctor ? 1 : 0) + (hasDetective ? 1 : 0);
        const civilianCount = Math.max(0, playerCount - specialRoles);

        const result: RoleEntry[] = [];
        // ИСПОЛЬЗУЕМ НАШИ НОВЫЕ СУРОВЫЕ ЦВЕТА И ТОНКИЕ ИКОНКИ
        result.push({
            name: 'Mafia', count: mafiaCount,
            icon: <Skull strokeWidth={1} className="w-8 h-8" />,
            color: 'text-[#8B0000]'
        });
        if (hasDoctor) {
            result.push({
                name: 'Doctor', count: 1,
                icon: <Shield strokeWidth={1} className="w-8 h-8" />,
                color: 'text-[#0D9488]'
            });
        }
        if (hasDetective) {
            result.push({
                name: 'Detective', count: 1,
                icon: <Search strokeWidth={1} className="w-8 h-8" />,
                color: 'text-[#B45309]'
            });
        }
        result.push({
            name: 'Civilian', count: civilianCount,
            icon: <Users strokeWidth={1} className="w-8 h-8" />,
            color: 'text-[#6B5A4A]'
        });
        return result;
    }, [playerCount]);

    // Icon animation variants per role position
    const iconAnimations: { animate: Record<string, number[]>; transition: Transition }[] = [
        { animate: { scale: [1, 1.08, 1], opacity: [1, 0.7, 1] }, transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' as const } },
        { animate: { rotate: [-3, 3, -3], scale: [1, 1.05, 1] },  transition: { duration: 3,   repeat: Infinity, ease: 'easeInOut' as const } },
        { animate: { x: [-2, 2, -2], opacity: [1, 0.75, 1] },     transition: { duration: 2,   repeat: Infinity, ease: 'easeInOut' as const } },
        { animate: { scale: [1, 1.04, 1] },                        transition: { duration: 4,   repeat: Infinity, ease: 'easeInOut' as const } },
    ];


    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => onComplete(), 5000);
            return () => clearTimeout(timer);
        }
    }, [show, onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none bg-[#050505]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative z-10 flex flex-col items-center max-w-md w-full px-8"
                    >
                        <h2 className="text-3xl md:text-4xl font-['Cinzel'] font-light tracking-[0.3em] text-white/95 uppercase mix-blend-plus-lighter mb-2">
                            The Town
                        </h2>
                        <p className="text-white/50 font-sans tracking-[0.6em] uppercase text-[10px] md:text-xs text-center ml-[0.6em] mb-8">
                            <span className="font-mono">{playerCount}</span> Players Confirmed
                        </p>

                        {/* Строгий список ролей (Minimalist List) */}
                        <div className="w-full flex flex-col">
                            {roles.map((role, index) => (
                                <motion.div
                                    key={role.name}
                                    initial={{ opacity: 0, x: -10, borderBottomWidth: 0 }}
                                    animate={{ opacity: 1, x: 0, borderBottomWidth: 1 }}
                                    transition={{ delay: 0.5 + index * 0.2, duration: 0.8, ease: "easeOut" }}
                                    // Абсолютно плоские ряды с тонкими линиями
                                    className="flex items-center gap-6 py-4 border-b border-white/5"
                                >
                                    <div className={`${role.color} opacity-100`}>
                                        <motion.div
                                            animate={iconAnimations[index]?.animate}
                                            transition={iconAnimations[index]?.transition}
                                        >
                                            {role.icon}
                                        </motion.div>
                                    </div>
                                    <span className={`${role.color} font-['Montserrat'] font-bold tracking-[0.1em] uppercase text-xl flex-1 mix-blend-plus-lighter`}>
                                        {role.name}
                                    </span>
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.8 + index * 0.2 }}
                                        className={`${role.color} opacity-60 font-mono text-2xl`}
                                    >
                                        x{role.count}
                                    </motion.span>
                                </motion.div>
                            ))}
                        </div>

                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "200px", opacity: 1 }}
                            transition={{ delay: 2, duration: 1.5, ease: "easeInOut" }}
                            className="h-[1px] bg-gradient-to-r from-transparent via-[#8B0000] to-transparent mt-6 mb-4"
                        />

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2.5 }}
                            className="mt-4 text-white/50 font-sans tracking-[0.6em] uppercase text-[10px] md:text-xs text-center ml-[0.6em]"
                        >
                            Trust no one
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});

RoleCompositionAnnouncement.displayName = 'RoleCompositionAnnouncement';
