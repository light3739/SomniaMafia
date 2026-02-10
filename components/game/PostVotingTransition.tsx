
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GameLog } from './GameLog';
import { Clock } from 'lucide-react';

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
        <div className="absolute inset-0 z-50 flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-[500px] flex flex-col items-center gap-4 p-6"
            >
                <h2 className="text-2xl font-['Playfair_Display'] text-white">
                    Voting Results
                </h2>

                <div className="w-full h-[300px] rounded-xl overflow-hidden relative">
                    <GameLog />
                </div>

                <div className="w-full py-2 flex justify-center">
                    <div className="flex items-center justify-center gap-3 px-6 py-2 bg-black/40 border border-[#916A47]/30 rounded-full text-white/50 select-none">
                        <Clock className="w-4 h-4 text-[#916A47]/70" />
                        <span className="text-lg font-mono font-bold text-white/80 tabular-nums">
                            00:{timeLeft.toString().padStart(2, '0')}
                        </span>
                        <div className="w-[1px] h-4 bg-white/10 mx-1" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#916A47]">
                            Night Starting...
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
