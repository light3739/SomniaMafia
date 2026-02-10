
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

                <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-black/40 border border-[#916A47]/30 backdrop-blur-sm min-w-[200px]">
                    <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#916A47] mb-1">
                        Night Starting
                    </div>
                    <div className="text-3xl sm:text-4xl font-black tabular-nums leading-none tracking-tight text-white font-mono flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#916A47] animate-pulse" />
                        00:{timeLeft.toString().padStart(2, '0')}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
