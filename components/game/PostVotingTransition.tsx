
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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 md:p-8">
            <div className="max-w-2xl w-full">
                <div className="text-center mb-4">
                    <motion.h2
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl font-['Playfair_Display'] text-white"
                    >
                        Voting Results
                    </motion.h2>
                </div>

                <div className="mb-4 h-[360px] w-full rounded-2xl overflow-hidden border border-[#916A47]/20 bg-black/40 backdrop-blur-sm relative">
                    <GameLog />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full py-2 flex justify-center"
                >
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
                </motion.div>
            </div>
        </div>
    );
};
