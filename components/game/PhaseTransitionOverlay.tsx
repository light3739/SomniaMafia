import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhaseTransitionOverlayProps {
    type: 'night' | 'morning' | 'voting';
    show: boolean;
    onComplete: () => void;
    dayCount?: number;
}

const phaseConfig = {
    night: {
        title: 'NIGHT FALLS',
        duration: 1500,
        textColor: '#8B0000',
        textShadow: '0 0 40px rgba(139,0,0,0.8), 0 0 80px rgba(139,0,0,0.4)',
    },
    morning: {
        title: 'DAWN BREAKS',
        duration: 1500,
        textColor: '#916A47',
        textShadow: '0 0 40px rgba(217,169,89,0.6), 0 0 80px rgba(217,169,89,0.3)',
    },
    voting: {
        title: 'THE TOWN VOTES',
        duration: 1200,
        textColor: '#916A47',
        textShadow: '0 0 30px rgba(145,106,71,0.5)',
    },
};

export const PhaseTransitionOverlay: React.FC<PhaseTransitionOverlayProps> = ({
    type,
    show,
    onComplete,
    dayCount,
}) => {
    const config = phaseConfig[type];

    // Stable ref for onComplete to avoid effect re-runs on parent re-render
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => onCompleteRef.current(), config.duration);
            return () => clearTimeout(timer);
        }
    }, [show, config.duration]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                    {/* Base background */}
                    <div className="absolute inset-0 bg-[#050505]" />

                    {/* === NIGHT: Iris-close vignette === */}
                    {type === 'night' && (
                        <motion.div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background:
                                    'radial-gradient(circle at center, transparent 0%, transparent 20%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 70%, #000 100%)',
                            }}
                            initial={{ scale: 2.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        />
                    )}

                    {/* Extra vignette ring for night — closing harder */}
                    {type === 'night' && (
                        <motion.div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                boxShadow: 'inset 0 0 200px 100px rgba(0,0,0,0.9)',
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, ease: 'easeIn' }}
                        />
                    )}

                    {/* === MORNING: Warm light bloom from center === */}
                    {type === 'morning' && (
                        <motion.div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                            <motion.div
                                className="rounded-full blur-[120px] bg-amber-700"
                                initial={{ width: 0, height: 0, opacity: 0 }}
                                animate={{
                                    width: '600px',
                                    height: '600px',
                                    opacity: [0, 0.35, 0.25],
                                }}
                                transition={{
                                    duration: 1.2,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                            />
                        </motion.div>
                    )}

                    {/* Secondary warm radiance for morning */}
                    {type === 'morning' && (
                        <motion.div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background:
                                    'radial-gradient(circle at center, rgba(217,169,89,0.15) 0%, transparent 60%)',
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                        />
                    )}

                    {/* === VOTING: Bronze pulse === */}
                    {type === 'voting' && (
                        <motion.div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                            <motion.div
                                className="w-[500px] h-[500px] rounded-full blur-[100px] bg-[#916A47]"
                                animate={{
                                    scale: [0.8, 1.15, 0.95, 1.1],
                                    opacity: [0.1, 0.3, 0.15, 0.25],
                                }}
                                transition={{
                                    duration: 1.2,
                                    ease: 'easeInOut',
                                }}
                            />
                        </motion.div>
                    )}

                    {/* === TEXT CONTENT === */}
                    <div className="relative z-10 flex flex-col items-center">
                        {/* Main title — slams in from below for night, fades for others */}
                        <motion.h1
                            className="text-5xl md:text-7xl font-['Cinzel'] font-light uppercase"
                            style={{
                                color: config.textColor,
                                textShadow: config.textShadow,
                                letterSpacing: '0.3em',
                            }}
                            initial={
                                type === 'night'
                                    ? { y: 120, opacity: 0, scale: 1.3 }
                                    : { y: 30, opacity: 0 }
                            }
                            animate={
                                type === 'night'
                                    ? { y: 0, opacity: 1, scale: 1 }
                                    : { y: 0, opacity: 1 }
                            }
                            transition={
                                type === 'night'
                                    ? {
                                          type: 'spring',
                                          stiffness: 200,
                                          damping: 18,
                                          mass: 1.2,
                                          delay: 0.15,
                                      }
                                    : {
                                          duration: 0.6,
                                          ease: [0.22, 1, 0.36, 1],
                                          delay: 0.1,
                                      }
                            }
                        >
                            {config.title}
                        </motion.h1>

                        {/* Decorative line */}
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '160px', opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
                            className="h-[1px] mt-6"
                            style={{
                                background: `linear-gradient(90deg, transparent, ${config.textColor}, transparent)`,
                            }}
                        />

                        {/* Morning subtitle: DAY {dayCount} */}
                        {type === 'morning' && dayCount != null && (
                            <motion.p
                                className="mt-5 font-['Cinzel'] text-sm md:text-base tracking-[0.5em] uppercase"
                                style={{
                                    color: 'rgba(217,169,89,0.7)',
                                }}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
                            >
                                DAY {dayCount}
                            </motion.p>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
