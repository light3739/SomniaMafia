import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NightAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const NightAnnouncement: React.FC<NightAnnouncementProps> = ({ show, onComplete }) => {
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => onComplete(), 4000);
            return () => clearTimeout(timer);
        }
    }, [show, onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                >
                    {/* Solid opaque background */}
                    <div className="absolute inset-0 bg-[#050505]" />

                    {/* Falling dust particles — like dust caught in a beam of light */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {/* Slow-falling dust motes */}
                        {[
                            { left: '15%', size: 3, duration: 7, delay: 0, sway: 12 },
                            { left: '30%', size: 5, duration: 9, delay: 1.5, sway: -8 },
                            { left: '50%', size: 2.5, duration: 6, delay: 0.5, sway: 15 },
                            { left: '65%', size: 4, duration: 8, delay: 2, sway: -10 },
                            { left: '80%', size: 3.5, duration: 10, delay: 3, sway: 8 },
                            { left: '25%', size: 2, duration: 11, delay: 4, sway: -6 },
                            { left: '72%', size: 4.5, duration: 7.5, delay: 1, sway: 14 },
                            { left: '42%', size: 3, duration: 9.5, delay: 2.5, sway: -12 },
                            { left: '8%', size: 3.5, duration: 8.5, delay: 1.2, sway: 10 },
                            { left: '88%', size: 2.5, duration: 12, delay: 2.2, sway: -15 },
                        ].map((p, i) => (
                            <motion.div
                                key={i}
                                className="absolute rounded-full bg-white"
                                style={{
                                    left: p.left,
                                    top: '-5%',
                                    width: `${p.size}px`,
                                    height: `${p.size}px`,
                                    boxShadow: '0 0 6px 1px rgba(255, 255, 255, 0.4)',
                                }}
                                animate={{
                                    y: ['-5vh', '105vh'],
                                    x: [0, p.sway, 0, -p.sway * 0.5, 0],
                                    opacity: [0, 0.3, 0.6, 0.3, 0],
                                }}
                                transition={{
                                    y: { duration: p.duration, repeat: Infinity, ease: 'linear', delay: p.delay },
                                    x: { duration: p.duration * 0.8, repeat: Infinity, ease: 'easeInOut', delay: p.delay },
                                    opacity: { duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay },
                                }}
                            />
                        ))}
                        {/* Ambient drifters — larger, slower, glowing */}
                        <motion.div
                            className="absolute rounded-full bg-white"
                            style={{ top: '30%', left: '20%', width: 5, height: 5, boxShadow: '0 0 10px 2px rgba(255,255,255,0.4)' }}
                            animate={{ y: [-20, 30, -20], x: [-10, 15, -10], opacity: [0.1, 0.5, 0.1] }}
                            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.div
                            className="absolute rounded-full bg-white"
                            style={{ top: '60%', left: '70%', width: 4, height: 4, boxShadow: '0 0 8px 2px rgba(255,255,255,0.3)' }}
                            animate={{ y: [15, -25, 15], x: [5, -12, 5], opacity: [0.1, 0.4, 0.1] }}
                            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                        />
                        <motion.div
                            className="absolute rounded-full bg-white"
                            style={{ top: '45%', left: '45%', width: 6, height: 6, boxShadow: '0 0 12px 2px rgba(255,255,255,0.4)' }}
                            animate={{ y: [10, -30, 10], x: [-15, 8, -15], opacity: [0.1, 0.45, 0.1] }}
                            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        />
                    </div>

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.05, opacity: 0, filter: 'blur(10px)' }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="flex flex-col items-center relative z-10"
                    >
                        <h1 className="text-5xl md:text-7xl font-['Cinzel'] font-light tracking-[0.3em] text-white/95 uppercase mix-blend-plus-lighter">
                            Night Falls
                        </h1>
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "200px", opacity: 1 }}
                            transition={{ delay: 0.5, duration: 1.5, ease: "easeInOut" }}
                            className="h-[1px] bg-gradient-to-r from-transparent via-[#8B0000] to-transparent mt-8"
                        />
                        <p className="mt-8 text-white/50 font-sans tracking-[0.6em] uppercase text-[10px] md:text-xs text-center ml-[0.6em]">
                            City goes silent
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
