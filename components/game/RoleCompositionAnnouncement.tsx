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

export const RoleCompositionAnnouncement = React.memo(({ show, onComplete, playerCount }: RoleCompositionAnnouncementProps) => {

    const roles: RoleEntry[] = useMemo(() => {
        const mafiaCount = Math.max(1, Math.floor(playerCount / 4));
        const hasDoctor = playerCount >= 4;
        const hasDetective = playerCount >= 5;
        const specialRoles = mafiaCount + (hasDoctor ? 1 : 0) + (hasDetective ? 1 : 0);
        const civilianCount = playerCount - specialRoles;

        const result: RoleEntry[] = [];
        // ИСПОЛЬЗУЕМ НАШИ НОВЫЕ СУРОВЫЕ ЦВЕТА И ТОНКИЕ ИКОНКИ
        result.push({
            name: 'Mafia', count: mafiaCount,
            icon: <Skull strokeWidth={1} className="w-8 h-8" />,
            color: 'text-[#8B0000]', glowColor: 'border-[#8B0000]'
        });
        if (hasDoctor) {
            result.push({
                name: 'Doctor', count: 1,
                icon: <Shield strokeWidth={1} className="w-8 h-8" />,
                color: 'text-[#0D9488]', glowColor: 'border-[#0D9488]'
            });
        }
        if (hasDetective) {
            result.push({
                name: 'Detective', count: 1,
                icon: <Search strokeWidth={1} className="w-8 h-8" />,
                color: 'text-[#B45309]', glowColor: 'border-[#B45309]'
            });
        }
        result.push({
            name: 'Civilian', count: civilianCount,
            icon: <Users strokeWidth={1} className="w-8 h-8" />,
            color: 'text-[#6B5A4A]', glowColor: 'border-[#6B5A4A]' // Пепельный/Бронзовый
        });
        return result;
    }, [playerCount]);

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
                    className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none bg-[#050505]"
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
                        <h2 className="text-3xl md:text-4xl font-['Cinzel'] font-light tracking-[0.3em] text-white/90 uppercase mb-2">
                            The Town
                        </h2>
                        <p className="text-white/30 font-mono tracking-[0.3em] uppercase text-xs mb-8">
                            {playerCount} Players Confirmed
                        </p>

                        {/* Строгий список ролей (Minimalist List) */}
                        <div className="w-full flex flex-col">
                            {roles.map((role, index) => (
                                <motion.div
                                    key={role.name}
                                    initial={{ opacity: 0, borderBottomWidth: 0 }}
                                    animate={{ opacity: 1, borderBottomWidth: 1 }}
                                    transition={{ delay: 0.5 + index * 0.2, duration: 0.8 }}
                                    // Абсолютно плоские ряды с тонкими линиями
                                    className="flex items-center gap-6 py-4 border-b border-white/5"
                                >
                                    <div className={`${role.color} opacity-80`}>
                                        {role.icon}
                                    </div>
                                    <span className={`${role.color} font-['Cinzel'] font-light tracking-[0.2em] text-lg uppercase flex-1`}>
                                        {role.name}
                                    </span>
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.8 + index * 0.2 }}
                                        className="text-white/50 font-mono text-xl"
                                    >
                                        x{role.count}
                                    </motion.span>
                                </motion.div>
                            ))}
                        </div>

                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 2, duration: 1 }}
                            className="w-12 h-[1px] bg-red-800 mt-12 mb-6"
                        />
                        
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2.5 }}
                            className="text-[#8B0000] text-[10px] font-mono tracking-widest uppercase"
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
