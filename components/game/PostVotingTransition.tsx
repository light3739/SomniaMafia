
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const PostVotingTransition: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState(10);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    return (
        <motion.div
            className="fixed inset-0 z-[105] flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
        >
            {/* Semi-transparent dark overlay */}
            <div className="absolute inset-0 bg-[#050505]/80" />

            <div className="flex flex-col items-center relative z-10">
                {/* Timer */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    className="flex flex-col items-center"
                >
                    <span className="text-white/90 font-mono text-5xl md:text-6xl font-light tabular-nums tracking-wider">
                        00:{timeLeft.toString().padStart(2, '0')}
                    </span>
                </motion.div>

                {/* Divider */}
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "120px", opacity: 1 }}
                    transition={{ delay: 0.8, duration: 1.5, ease: "easeInOut" }}
                    className="h-[1px] bg-gradient-to-r from-transparent via-[#8B0000] to-transparent mt-6"
                />

                {/* Label */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2, duration: 1 }}
                    className="mt-6 text-[#916A47] font-['Cinzel'] tracking-[0.4em] uppercase text-[10px] md:text-xs text-center"
                >
                    Night Starting
                </motion.p>
            </div>
        </motion.div>
    );
};
