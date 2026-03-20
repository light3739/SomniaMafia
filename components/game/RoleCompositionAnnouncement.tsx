import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Skull, Shield, Search, Users } from 'lucide-react';
import { CinematicOverlay } from './CinematicOverlay';
import { useSoundEffects } from '../ui/SoundEffects';

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
    const { playApproveSound } = useSoundEffects();

    const roles: RoleEntry[] = useMemo(() => {
        const mafiaCount = Math.max(1, Math.floor(playerCount / 4));
        const hasDoctor = playerCount >= 4;
        const hasDetective = playerCount >= 5;
        const specialRoles = mafiaCount + (hasDoctor ? 1 : 0) + (hasDetective ? 1 : 0);
        const civilianCount = playerCount - specialRoles;

        const result: RoleEntry[] = [];
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

    useEffect(() => {
        if (show) {
            playApproveSound();
            const timer = setTimeout(() => onComplete(), 5000);
            return () => clearTimeout(timer);
        }
    }, [show, onComplete, playApproveSound]);

    return (
        <CinematicOverlay 
            show={show}
            duration={0.8}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="flex flex-col items-center max-w-md w-full px-8"
            >
                <h2 className="text-3xl md:text-4xl font-['Cinzel'] font-light tracking-[0.3em] text-white/95 uppercase mix-blend-plus-lighter mb-2">
                    The Town
                </h2>
                <p className="text-white/50 font-sans tracking-[0.6em] uppercase text-[10px] md:text-xs text-center ml-[0.6em] mb-8">
                    <span className="font-mono">{playerCount}</span> Players Confirmed
                </p>

                {/* List of Roles */}
                <div className="w-full flex flex-col">
                    {roles.map((role, index) => (
                        <motion.div
                            key={role.name}
                            initial={{ opacity: 0, x: -10, borderBottomWidth: 0 }}
                            animate={{ opacity: 1, x: 0, borderBottomWidth: 1 }}
                            transition={{ delay: 0.5 + index * 0.2, duration: 0.8, ease: "easeOut" }}
                            className="flex items-center gap-6 py-4 border-b border-white/5"
                        >
                            <div className={`${role.color} opacity-100 `}>
                                {role.icon}
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
                    className="h-[1.5px] bg-gradient-to-r from-transparent via-[#8B0000] to-transparent mt-8 mb-6 shadow-[0_0_15px_rgba(139,0,0,0.4)]"
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
        </CinematicOverlay>
    );
});

RoleCompositionAnnouncement.displayName = 'RoleCompositionAnnouncement';
