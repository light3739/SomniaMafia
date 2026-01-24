import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon } from 'lucide-react';

interface NightAnnouncementProps {
    show: boolean;
    onComplete: () => void;
    votingResult?: string | null;
}

export const NightAnnouncement = React.memo(({ show, onComplete }: NightAnnouncementProps) => {

    // Timer Logic
    useEffect(() => {
        if (!show) return;

        const timer = setTimeout(() => {
            onComplete();
        }, 3000);

        return () => {
            clearTimeout(timer);
        };
    }, [show, onComplete]);

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

                    <motion.div
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
                </motion.div>
            )}
        </AnimatePresence>
    );
});
