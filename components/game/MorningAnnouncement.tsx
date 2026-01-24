import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun } from 'lucide-react';

interface MorningAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const MorningAnnouncement = React.memo(({ show, onComplete }: MorningAnnouncementProps) => {
    // Стабилизируем случайные значения для частиц, чтобы они не дергались при перерендере
    const rays = React.useMemo(() => {
        return [...Array(8)].map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 3
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
                    {/* Warm Blurred Background */}
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-0 bg-yellow-950/40"
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
                        {/* Sun Icon */}
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                rotate: [0, 90, 180, 270, 360],
                                opacity: [0.8, 1, 0.8]
                            }}
                            transition={{
                                scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                                rotate: { duration: 10, repeat: Infinity, ease: "linear" }
                            }}
                        >
                            <Sun className="w-24 h-24 text-yellow-500 mb-6 drop-shadow-[0_0_40px_rgba(234,179,8,0.6)]" />
                        </motion.div>

                        <h1 className="text-6xl md:text-8xl font-['Playfair_Display'] font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-orange-400 to-amber-700 drop-shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                            DAY BREAKS
                        </h1>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="h-1 bg-yellow-500/50 mt-4 rounded-full"
                        />
                        <p className="mt-4 text-yellow-100/80 font-['Montserrat'] tracking-[0.5em] uppercase text-sm md:text-base">
                            The sun has risen
                        </p>

                        {/* Rays/Glitter effect */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {rays.map((ray) => (
                                <motion.div
                                    key={ray.id}
                                    className="absolute w-2 h-2 bg-yellow-400 blur-[1px] rounded-full"
                                    style={{
                                        left: ray.left,
                                        top: ray.top,
                                    }}
                                    animate={{
                                        opacity: [0, 0.6, 0],
                                        scale: [0, 1.5, 0],
                                        y: [0, -40, -80]
                                    }}
                                    transition={{
                                        duration: ray.duration,
                                        repeat: Infinity,
                                        delay: ray.delay
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
