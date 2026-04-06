import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EliminationCeremonyProps {
    show: boolean;
    playerName: string;
    playerRole: string; // 'MAFIA' | 'CIVILIAN' | 'DOCTOR' | 'DETECTIVE'
    onComplete: () => void;
}

const ROLE_COLORS: Record<string, string> = {
    MAFIA: '#8B0000',
    CIVILIAN: '#916A47',
    DOCTOR: '#0D9488',
    DETECTIVE: '#A85832',
};

const TOTAL_DURATION = 4000;

export const EliminationCeremony: React.FC<EliminationCeremonyProps> = ({
    show,
    playerName,
    playerRole,
    onComplete,
}) => {
    const roleColor = ROLE_COLORS[playerRole] ?? '#916A47';

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => onComplete(), TOTAL_DURATION);
            return () => clearTimeout(timer);
        }
    }, [show, onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[250] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                    {/* ===== PHASE 1 (0-0.3s): Dark overlay dims in ===== */}
                    <motion.div
                        className="absolute inset-0 bg-black/85"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, ease: 'easeIn' }}
                    />

                    {/* Role-specific color flood that appears with the role reveal */}
                    <motion.div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.8, ease: 'easeOut' }}
                    >
                        <motion.div
                            className="rounded-full blur-[120px]"
                            style={{ backgroundColor: roleColor }}
                            initial={{ width: 0, height: 0, opacity: 0 }}
                            animate={{
                                width: '500px',
                                height: '500px',
                                opacity: [0, 0.25, 0.15],
                            }}
                            transition={{
                                delay: 1,
                                duration: 1.2,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                        />
                    </motion.div>

                    {/* Central content container — staggered children */}
                    <motion.div
                        className="relative z-10 flex flex-col items-center"
                        initial="hidden"
                        animate="visible"
                        variants={{
                            hidden: {},
                            visible: {
                                transition: {
                                    staggerChildren: 0,
                                },
                            },
                        }}
                    >
                        {/* ===== PHASE 2 (0.3-1s): Player name with spotlight ===== */}
                        <motion.div
                            className="flex flex-col items-center"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                                delay: 0.3,
                                duration: 0.7,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                        >
                            {/* Spotlight glow behind the name */}
                            <motion.div
                                className="absolute -top-16 w-40 h-40 rounded-full pointer-events-none"
                                style={{
                                    background:
                                        'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
                                    boxShadow: '0 0 80px 40px rgba(255,255,255,0.06)',
                                }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3, duration: 0.5 }}
                            />

                            <motion.p
                                className="text-white text-2xl md:text-3xl font-['Cinzel'] tracking-[0.2em] uppercase"
                                style={{
                                    textShadow:
                                        '0 0 30px rgba(255,255,255,0.3), 0 4px 20px rgba(0,0,0,0.5)',
                                }}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    delay: 0.4,
                                    duration: 0.6,
                                    ease: 'easeOut',
                                }}
                            >
                                {playerName}
                            </motion.p>
                        </motion.div>

                        {/* Thin separator line */}
                        <motion.div
                            className="h-[1px] my-5"
                            style={{
                                background: `linear-gradient(90deg, transparent, ${roleColor}, transparent)`,
                            }}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '120px', opacity: 1 }}
                            transition={{ delay: 0.9, duration: 0.5, ease: 'easeOut' }}
                        />

                        {/* ===== PHASE 3 (1-2.5s): Role flip with color flood ===== */}
                        <motion.div
                            className="perspective-[800px]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1, duration: 0.1 }}
                        >
                            <motion.p
                                className="text-4xl md:text-5xl font-['Cinzel'] font-bold tracking-[0.3em] uppercase"
                                style={{
                                    color: roleColor,
                                    textShadow: `0 0 30px ${roleColor}80`,
                                }}
                                initial={{ rotateY: 90, opacity: 0 }}
                                animate={{ rotateY: 0, opacity: 1 }}
                                transition={{
                                    delay: 1.1,
                                    duration: 0.7,
                                    type: 'spring',
                                    stiffness: 150,
                                    damping: 15,
                                }}
                            >
                                {playerRole}
                            </motion.p>
                        </motion.div>

                        {/* ===== PHASE 4 (2.5-3.5s): ELIMINATED slams in from below ===== */}
                        <motion.div className="mt-8">
                            <motion.h1
                                className="text-5xl md:text-6xl font-['Cinzel'] font-light uppercase"
                                style={{
                                    color: '#8B0000',
                                    textShadow:
                                        '0 0 40px rgba(139,0,0,0.8), 0 0 80px rgba(139,0,0,0.4)',
                                    letterSpacing: '0.3em',
                                }}
                                initial={{ y: 100, opacity: 0, scale: 1.2 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                transition={{
                                    delay: 2.5,
                                    type: 'spring',
                                    stiffness: 220,
                                    damping: 18,
                                    mass: 1,
                                }}
                            >
                                ELIMINATED
                            </motion.h1>
                        </motion.div>
                    </motion.div>

                    {/* ===== PHASE 5 (3.5-4s): Fade out handled by AnimatePresence exit ===== */}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
