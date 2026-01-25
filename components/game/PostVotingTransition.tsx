
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GameLog } from './GameLog';

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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-[500px] flex flex-col items-center gap-6 p-8 border border-[#916A47] rounded-3xl bg-[#0a0a0a]"
            >
                <h2 className="text-3xl font-['Playfair_Display'] text-[#916A47] tracking-widest uppercase">
                    Voting Results
                </h2>

                <div className="w-full h-[300px] bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                    <GameLog />
                </div>

                <div className="flex flex-col items-center gap-2">
                    <span className="text-white/50 text-sm tracking-widest uppercase">Night Begins In</span>
                    <div className="text-4xl font-bold text-white font-mono">
                        00:{timeLeft.toString().padStart(2, '0')}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
