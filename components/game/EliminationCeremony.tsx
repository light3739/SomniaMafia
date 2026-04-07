import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EliminationCeremonyProps {
    show: boolean;
    playerName: string;
    playerRole: string; // role is intentionally unused — revealed only at game end
    onComplete: () => void;
}

const TOTAL_DURATION = 3200;

export const EliminationCeremony: React.FC<EliminationCeremonyProps> = ({
    show,
    playerName,
    onComplete,
}) => {
    // Stable ref for onComplete to avoid effect re-runs on parent re-render
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => onCompleteRef.current(), TOTAL_DURATION);
            return () => clearTimeout(timer);
        }
    }, [show]);

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
                    {/* Dark overlay */}
                    <motion.div
                        className="absolute inset-0 bg-black/85"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, ease: 'easeIn' }}
                    />

                    {/* Crimson radial bloom — verdict atmosphere */}
                    <motion.div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                    >
                        <motion.div
                            className="rounded-full blur-[120px] bg-[#8B0000]"
                            initial={{ width: 0, height: 0, opacity: 0 }}
                            animate={{
                                width: '500px',
                                height: '500px',
                                opacity: [0, 0.22, 0.14],
                            }}
                            transition={{
                                delay: 0.6,
                                duration: 1.2,
                                ease: [0.22, 1, 0.36, 1],
                            }}
                        />
                    </motion.div>

                    {/* Central content */}
                    <div className="relative z-10 flex flex-col items-center">
                        {/* Player name */}
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

                        {/* Thin separator line */}
                        <motion.div
                            className="h-[1px] my-5"
                            style={{
                                background:
                                    'linear-gradient(90deg, transparent, rgba(139,0,0,0.85), transparent)',
                            }}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '160px', opacity: 1 }}
                            transition={{ delay: 0.9, duration: 0.5, ease: 'easeOut' }}
                        />

                        {/* ELIMINATED verdict */}
                        <motion.h1
                            className="mt-6 text-5xl md:text-6xl font-['Cinzel'] font-light uppercase"
                            style={{
                                color: '#8B0000',
                                textShadow:
                                    '0 0 40px rgba(139,0,0,0.8), 0 0 80px rgba(139,0,0,0.4)',
                                letterSpacing: '0.3em',
                            }}
                            initial={{ y: 60, opacity: 0, scale: 1.15 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{
                                delay: 1.4,
                                type: 'spring',
                                stiffness: 220,
                                damping: 18,
                                mass: 1,
                            }}
                        >
                            ELIMINATED
                        </motion.h1>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
