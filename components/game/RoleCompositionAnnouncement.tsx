import React, { useEffect, useMemo } from 'react';
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
    glowColor: string;
}

export const RoleCompositionAnnouncement = React.memo(({
    show,
    onComplete,
    playerCount
}: RoleCompositionAnnouncementProps) => {

    // Calculate role distribution (matches shuffleService.ts logic)
    const roles: RoleEntry[] = useMemo(() => {
        const mafiaCount = Math.max(1, Math.floor(playerCount / 4));
        const hasDoctor = playerCount >= 4;
        const hasDetective = playerCount >= 5;
        const specialRoles = mafiaCount + (hasDoctor ? 1 : 0) + (hasDetective ? 1 : 0);
        const civilianCount = playerCount - specialRoles;

        const result: RoleEntry[] = [];

        result.push({
            name: 'Mafia',
            count: mafiaCount,
            icon: <Skull className="w-7 h-7" />,
            color: 'text-rose-400',
            glowColor: 'rgba(251,113,133,0.4)'
        });

        if (hasDoctor) {
            result.push({
                name: 'Doctor',
                count: 1,
                icon: <Shield className="w-7 h-7" />,
                color: 'text-teal-400',
                glowColor: 'rgba(45,212,191,0.4)'
            });
        }

        if (hasDetective) {
            result.push({
                name: 'Detective',
                count: 1,
                icon: <Search className="w-7 h-7" />,
                color: 'text-sky-400',
                glowColor: 'rgba(56,189,248,0.4)'
            });
        }

        result.push({
            name: 'Civilian',
            count: civilianCount,
            icon: <Users className="w-7 h-7" />,
            color: 'text-amber-400',
            glowColor: 'rgba(251,191,36,0.4)'
        });

        return result;
    }, [playerCount]);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                onComplete();
            }, 5000); // Show for 5 seconds (longer than other announcements — more info to read)
            return () => clearTimeout(timer);
        }
    }, [show, onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[99] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Blurred Background */}
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(6px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute inset-0 bg-black/70"
                    />

                    {/* Content */}
                    <motion.div
                        initial={{ scale: 0.7, opacity: 0, y: 40 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.1, opacity: 0, filter: 'blur(8px)' }}
                        transition={{
                            type: "spring",
                            stiffness: 180,
                            damping: 22,
                            duration: 0.8
                        }}
                        className="relative z-10 flex flex-col items-center max-w-md w-full px-6"
                    >
                        {/* Title */}
                        <motion.h2
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-3xl md:text-4xl font-['Playfair_Display'] font-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/50 mb-2"
                        >
                            The Town Awakens
                        </motion.h2>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-white/50 font-['Montserrat'] tracking-[0.3em] uppercase text-[10px] md:text-xs mb-6"
                        >
                            {playerCount} Players — Role Distribution
                        </motion.p>

                        {/* Divider */}
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "60%" }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className="h-[1px] bg-gradient-to-r from-transparent via-[#916A47]/60 to-transparent mb-6"
                        />

                        {/* Role Cards */}
                        <div className="w-full space-y-2.5">
                            {roles.map((role, index) => (
                                <motion.div
                                    key={role.name}
                                    initial={{ opacity: 0, x: -30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        delay: 0.5 + index * 0.15,
                                        type: "spring",
                                        stiffness: 200,
                                        damping: 25
                                    }}
                                    className="flex items-center gap-4 px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
                                >
                                    {/* Icon */}
                                    <div className={`${role.color} shrink-0`}>
                                        {role.icon}
                                    </div>

                                    {/* Name */}
                                    <span className={`${role.color} font-['Playfair_Display'] font-semibold text-lg flex-1`}>
                                        {role.name}
                                    </span>

                                    {/* Count */}
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{
                                            delay: 0.7 + index * 0.15,
                                            type: "spring",
                                            stiffness: 300
                                        }}
                                        className={`${role.color} text-2xl font-bold font-mono tabular-nums`}
                                    >
                                        ×{role.count}
                                    </motion.span>
                                </motion.div>
                            ))}
                        </div>

                        {/* Bottom hint */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.2 }}
                            className="mt-6 text-white/30 text-[10px] font-['Montserrat'] tracking-widest uppercase"
                        >
                            Find the Mafia among you
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});

RoleCompositionAnnouncement.displayName = 'RoleCompositionAnnouncement';
