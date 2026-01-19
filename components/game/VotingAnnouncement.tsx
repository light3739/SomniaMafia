import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VotingAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const VotingAnnouncement = React.memo(({ show, onComplete }: VotingAnnouncementProps) => {
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
                        animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-0 bg-black/60"
                    />

                    {/* Animated Text */}
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
                        <h1 className="text-6xl md:text-8xl font-['Playfair_Display'] font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#916A47] to-[#5e4026] drop-shadow-[0_0_20px_rgba(145,106,71,0.5)]">
                            VOTING
                        </h1>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="h-1 bg-[#916A47]/50 mt-4 rounded-full"
                        />
                        <p className="mt-4 text-white/80 font-['Montserrat'] tracking-[0.5em] uppercase text-sm md:text-base">
                            Cast Your Vote
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});
