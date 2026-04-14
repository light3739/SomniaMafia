
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

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

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
        <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
        >
            <div className="w-full py-2 text-center bg-[#0A0A0A] rounded-md border border-[#916A47]/30 shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
                <div className="flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4 text-[#916A47]" />
                    <span className="text-2xl font-bold text-white tabular-nums">
                        {minutes}:{String(seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[#916A47] text-[10px] uppercase font-bold tracking-widest ml-2">
                        Voting Results
                    </span>
                </div>
            </div>
        </motion.div>
    );
};
