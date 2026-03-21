
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface PostVotingTransitionProps {
    initialSeconds?: number;
}

export const PostVotingTransition: React.FC<PostVotingTransitionProps> = ({ initialSeconds = 10 }) => {
    const [timeLeft, setTimeLeft] = useState(initialSeconds);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    return (
        <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[50] pointer-events-none"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
        >
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-[#8B0000]/30 bg-[#050505]/90 backdrop-blur-md">
                {/* Pulsing dot */}
                <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-[#8B0000]"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Label */}
                <span className="font-['Cinzel'] text-[10px] tracking-[0.3em] uppercase text-white/50">
                    Night Starting
                </span>

                {/* Divider */}
                <div className="w-[1px] h-3 bg-[#8B0000]/40" />

                {/* Timer */}
                <span className="font-['Cinzel'] text-[11px] tracking-[0.15em] text-[#8B0000]/80 tabular-nums">
                    00:{timeLeft.toString().padStart(2, '0')}
                </span>
            </div>
        </motion.div>
    );
};
