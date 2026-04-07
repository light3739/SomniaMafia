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
                    className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                >
                    {/* Solid opaque background — unified pattern */}
                    <div className="absolute inset-0 bg-[#050505]" />

                    {/* Subtle deep red pulsing glow in center — creates pressure but let's make it lighter, as requested */}
                    <motion.div
                        className="absolute inset-0 pointer-events-none flex items-center justify-center"
                        animate={{
                            opacity: [0.14, 0.24, 0.14],
                            scale: [0.95, 1.05, 0.95],
                        }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    >
                        <div className="w-[100vw] h-[100vw] max-w-[820px] max-h-[820px] rounded-full bg-[#8B0000] blur-[100px]" />
                    </motion.div>

                    {/* Very subtle dark-red ambient glow at edges */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <motion.div
                            className="absolute -top-[20%] -left-[20%] w-[50%] h-[50%] rounded-full blur-[120px] bg-[#8B0000]"
                            animate={{ opacity: [0.05, 0.12, 0.05], x: [-10, 10, -10] }}
                            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.div
                            className="absolute -bottom-[20%] -right-[20%] w-[50%] h-[50%] rounded-full blur-[120px] bg-[#8B0000]"
                            animate={{ opacity: [0.04, 0.1, 0.04], x: [10, -10, 10] }}
                            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                        />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative z-10 flex flex-col items-center"
                    >
                        <h1
                            className="text-5xl md:text-7xl font-['Cinzel'] font-light tracking-[0.3em] text-white/95 uppercase mix-blend-plus-lighter"
                            style={{ textShadow: '0 0 28px rgba(139,0,0,0.55), 0 0 60px rgba(139,0,0,0.25)' }}
                        >
                            Judgment
                        </h1>
                        
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "200px", opacity: 1 }}
                            transition={{ delay: 0.8, duration: 1.5, ease: "easeInOut" }}
                            className="h-[1px] bg-gradient-to-r from-transparent via-[#8B0000] to-transparent mt-8"
                        />
                        
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.5, duration: 1 }}
                            className="mt-8 text-white/50 font-sans tracking-[0.6em] uppercase text-[10px] md:text-xs text-center ml-[0.6em]"
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
