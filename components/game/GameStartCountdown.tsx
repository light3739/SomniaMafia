import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GameStartCountdownProps {
    show: boolean;
    onComplete: () => void;
}

const COUNTDOWN_VALUES = [3, 2, 1, 0] as const;
const STEP_DURATION = 1000; // ms per number
const FINAL_HOLD = 1000;   // ms to hold "THE GAME BEGINS"

export const GameStartCountdown = React.memo(({ show, onComplete }: GameStartCountdownProps) => {
    const [step, setStep] = useState<number | null>(null);

    const reset = useCallback(() => {
        setStep(null);
    }, []);

    useEffect(() => {
        if (!show) {
            reset();
            return;
        }

        setStep(0);

        const timers: ReturnType<typeof setTimeout>[] = [];

        // Schedule each step transition: 0->1 at 1s, 1->2 at 2s, 2->3 at 3s
        for (let i = 1; i < COUNTDOWN_VALUES.length; i++) {
            timers.push(setTimeout(() => setStep(i), i * STEP_DURATION));
        }

        // After the last step ("THE GAME BEGINS") holds for FINAL_HOLD, call onComplete
        const totalDuration = COUNTDOWN_VALUES.length * STEP_DURATION + FINAL_HOLD;
        timers.push(setTimeout(() => {
            onComplete();
        }, totalDuration));

        return () => {
            timers.forEach(clearTimeout);
        };
    }, [show, onComplete, reset]);

    if (!show || step === null) return null;

    const currentValue = COUNTDOWN_VALUES[step];
    const isFinalText = currentValue === 0;

    return (
        <AnimatePresence mode="wait">
            {show && (
                <motion.div
                    className="fixed inset-0 z-[300] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 50%, #000000 100%)',
                    }}
                >
                    {/* Noir vignette overlay */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.95) 100%)',
                        }}
                    />

                    {/* Subtle warm ambient glow behind the text */}
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            width: '400px',
                            height: '400px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(145,106,71,0.12) 0%, transparent 70%)',
                            filter: 'blur(60px)',
                        }}
                    />

                    {/* Countdown content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentValue}
                            className="relative flex items-center justify-center select-none"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.3, opacity: 0 }}
                            transition={{
                                scale: {
                                    type: 'spring',
                                    stiffness: 200,
                                    damping: 15,
                                    mass: 0.8,
                                },
                                opacity: {
                                    duration: 0.3,
                                    ease: 'easeOut',
                                },
                            }}
                        >
                            {isFinalText ? (
                                <span
                                    className="text-[#916A47] uppercase text-center"
                                    style={{
                                        fontFamily: "'Cinzel', serif",
                                        fontSize: 'clamp(20px, 5vw, 36px)',
                                        letterSpacing: '0.3em',
                                        textShadow:
                                            '0 0 20px rgba(145,106,71,0.6), 0 0 40px rgba(145,106,71,0.3), 0 0 80px rgba(145,106,71,0.15)',
                                    }}
                                >
                                    The Game Begins
                                </span>
                            ) : (
                                <span
                                    className="text-[#916A47]"
                                    style={{
                                        fontFamily: "'Cinzel', serif",
                                        fontSize: 'clamp(72px, 15vw, 120px)',
                                        lineHeight: 1,
                                        fontWeight: 700,
                                        textShadow:
                                            '0 0 30px rgba(145,106,71,0.7), 0 0 60px rgba(145,106,71,0.4), 0 0 120px rgba(145,106,71,0.2)',
                                    }}
                                >
                                    {currentValue}
                                </span>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
});

GameStartCountdown.displayName = 'GameStartCountdown';
