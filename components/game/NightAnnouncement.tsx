import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon } from 'lucide-react';

interface NightAnnouncementProps {
    show: boolean;
    onComplete: () => void;
    votingResult?: string | null;
}

export const NightAnnouncement = React.memo(({ show, onComplete, votingResult }: NightAnnouncementProps) => {
    const [step, setStep] = useState<'result' | 'night'>('result');

    // Reset step when shown
    useEffect(() => {
        if (show) {
            if (votingResult) {
                setStep('result');
            } else {
                setStep('night');
            }
        }
    }, [show, votingResult]);

    // Timer Logic
    useEffect(() => {
        if (!show) return;

        let timer: NodeJS.Timeout;

        if (step === 'result' && votingResult) {
            // Show result for 15 seconds as requested
            timer = setTimeout(() => {
                setStep('night');
            }, 15000);
        } else {
            // Show Night message for 3 seconds
            timer = setTimeout(() => {
                onComplete();
            }, 3000);
        }

        return () => clearTimeout(timer);
    }, [show, step, votingResult, onComplete]);

    // Stars logic (static)
    const stars = React.useMemo(() => {
        return [...Array(10)].map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            duration: 1.5 + Math.random(),
            delay: Math.random() * 2
        }));
    }, []);

    return (
        <AnimatePresence mode="wait">
            {show && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <motion.div
                        className="absolute inset-0 bg-indigo-950/90 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {step === 'result' && votingResult ? (
                        <motion.div
                            key="result"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.1, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="relative z-10 flex flex-col items-center max-w-2xl px-8 text-center"
                        >
                            <h2 className="text-3xl md:text-5xl font-['Playfair_Display'] text-white mb-6 leading-tight">
                                Voting Results
                            </h2>
                            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-[#916A47] to-transparent mb-8" />

                            <p className="text-xl md:text-3xl font-medium text-white/90 drop-shadow-lg leading-relaxed">
                                {votingResult}
                            </p>

                            <div className="mt-8 text-white/30 text-sm animate-pulse">
                                Night falls in a moment...
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="night"
                            initial={{ scale: 0.5, opacity: 0, y: 50 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 1.5, opacity: 0, filter: 'blur(10px)' }}
                            className="relative z-10 flex flex-col items-center"
                        >
                            <motion.div
                                animate={{
                                    y: [0, -10, 0],
                                    opacity: [0.7, 1, 0.7]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Moon className="w-20 h-20 text-indigo-300 mb-6 drop-shadow-[0_0_30px_rgba(129,140,248,0.5)]" />
                            </motion.div>

                            <h1 className="text-6xl md:text-8xl font-['Playfair_Display'] font-bold text-transparent bg-clip-text bg-gradient-to-b from-indigo-300 to-indigo-600 drop-shadow-[0_0_20px_rgba(129,140,248,0.5)]">
                                NIGHT
                            </h1>
                            <div className="h-1 w-full bg-indigo-500/50 mt-4 rounded-full" />
                            <p className="mt-4 text-indigo-200/80 font-['Montserrat'] tracking-[0.5em] uppercase text-sm md:text-base">
                                is coming
                            </p>
                        </motion.div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
});
