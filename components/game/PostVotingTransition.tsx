
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
                className="w-[500px] flex flex-col items-center gap-4 p-6 rounded-3xl bg-black/60 backdrop-blur-xl border border-[#916A47]/30 shadow-2xl"
            >
                <h2 className="text-2xl font-['Playfair_Display'] text-[#916A47] tracking-widest uppercase">
                    Voting Results
                </h2>

                <div className="w-full h-[300px] bg-black/40 rounded-xl border border-[#916A47]/10 overflow-hidden relative">
                    <div className="absolute top-2 right-3 z-10 flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-[#916A47]/40" />
                        <div className="w-1 h-1 rounded-full bg-[#916A47]/20" />
                    </div>
                    <GameLog />
                </div>

                <div className="w-full py-2 text-center rounded-xl border transition-colors duration-500 bg-[#916A47]/10 border-[#916A47]/30">
                    <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 text-[#916A47]" />
                        <span className="text-2xl font-bold tabular-nums text-white">
                            00:{timeLeft.toString().padStart(2, '0')}
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-widest ml-2 text-[#916A47]/50">
                            Night Starting...
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
