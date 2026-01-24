import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon } from 'lucide-react';

interface NightAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const NightAnnouncement = React.memo(({ show, onComplete }: NightAnnouncementProps) => {
    // Стабилизируем случайные значения для звезд, чтобы они не дергались при перерендере
    const stars = React.useMemo(() => {
        return [...Array(10)].map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            duration: 1.5 + Math.random(),
            delay: Math.random() * 2
        }));
    }, []);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                onComplete();
            }, 3000); // Show for 3 seconds
            return () => clearTimeout(timer);
        }
    }, [show, onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Blurred Background with explicit animation */}
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-0 bg-indigo-950/70"
                    />

                    {/* Animated Content */}
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.5, opacity: 0, filter: 'blur(10px)' }}
                        transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 20,
                            duration: 0.8
                        }}
                        className="relative z-10 flex flex-col items-center"
                    >
                        {/* Moon Icon */}
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
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="h-1 bg-indigo-500/50 mt-4 rounded-full"
                        />
                        <p className="mt-4 text-indigo-200/80 font-['Montserrat'] tracking-[0.5em] uppercase text-sm md:text-base">
                            is coming
                        </p>

                        {/* Stars effect */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {stars.map((star) => (
                                <motion.div
                                    key={star.id}
                                    className="absolute w-1 h-1 bg-white rounded-full"
                                    style={{
                                        left: star.left,
                                        top: star.top,
                                    }}
                                    animate={{
                                        opacity: [0, 1, 0],
                                        scale: [0.5, 1, 0.5]
                                    }}
                                    transition={{
                                        duration: star.duration,
                                        repeat: Infinity,
                                        delay: star.delay
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});
