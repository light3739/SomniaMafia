// components/game/VotingAnnouncement.tsx
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gavel } from 'lucide-react';

interface VotingAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const VotingAnnouncement: React.FC<VotingAnnouncementProps> = ({ show, onComplete }) => {
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
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <motion.div
                        className="flex flex-col items-center gap-6"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 20,
                            delay: 0.1 
                        }}
                    >
                        {/* Gavel Icon */}
                        <motion.div
                            className="p-6 rounded-full bg-amber-500/20 border-2 border-amber-500"
                            animate={{ 
                                rotate: [0, -15, 15, -10, 10, 0],
                                scale: [1, 1.1, 1]
                            }}
                            transition={{ 
                                duration: 0.8,
                                delay: 0.3,
                                ease: "easeInOut"
                            }}
                        >
                            <Gavel className="w-16 h-16 text-amber-500" />
                        </motion.div>

                        {/* Text */}
                        <motion.div
                            className="text-center"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <h2 className="text-4xl font-bold text-white mb-2 tracking-wider">
                                VOTING TIME
                            </h2>
                            <p className="text-amber-500 text-lg">
                                Choose who to eliminate
                            </p>
                        </motion.div>

                        {/* Decorative line */}
                        <motion.div
                            className="w-64 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
