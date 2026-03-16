import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VotingAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const VotingAnnouncement = React.memo(({ show, onComplete }: VotingAnnouncementProps) => {
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => onComplete(), 3000); 
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
                    transition={{ duration: 0.5 }} // Плавный вход темноты
                >
                    {/* Глухое черное затемнение */}
                    <div className="absolute inset-0 bg-black/90" />

                    <motion.div
                        // Убрал резкий scale. Теперь слово просто тяжело и медленно проявляется
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative z-10 flex flex-col items-center"
                    >
                        <h1 className="text-5xl md:text-7xl font-['Cinzel'] font-light tracking-[0.3em] text-white uppercase">
                            Judgment
                        </h1>
                        
                        {/* ФИКС ЛИНИИ: Теперь она рисуется медленно (1.5 секунды) и плавно (easeInOut) */}
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "100%", opacity: 1 }}
                            transition={{ delay: 0.8, duration: 1.5, ease: "easeInOut" }}
                            className="h-[1px] bg-[#8B0000] mt-6 shadow-[0_0_15px_rgba(139,0,0,0.8)]"
                        />
                        
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.5, duration: 1 }}
                            className="mt-6 text-white/40 font-mono tracking-[0.5em] uppercase text-xs"
                        >
                            Cast Your Vote
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});

VotingAnnouncement.displayName = 'VotingAnnouncement';
