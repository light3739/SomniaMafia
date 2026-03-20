import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CinematicOverlay } from './CinematicOverlay';

/**
 * PostVotingTransition: Full-screen countdown between Day/Voting and Night.
 * 
 * IMPROVEMENTS:
 * 1. Unified CinematicOverlay (No Flashes)
 * 2. Noir Typography (Cinzel instead of Mono)
 * 3. Dust particles for atmosphere.
 */
export const PostVotingTransition: React.FC = () => {
    const [timeLeft, setTimeLeft] = useState(10);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const particles = (
        <React.Fragment>
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute bg-white rounded-full"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: '-5%',
                        width: '3px',
                        height: '3px',
                        boxShadow: '0 0 4px 1px rgba(255, 255, 255, 0.2)',
                    }}
                    animate={{
                        y: ['-5vh', '105vh'],
                        opacity: [0, 0.4, 0],
                        x: [0, Math.random() * 20 - 10, 0]
                    }}
                    transition={{
                        duration: 8 + Math.random() * 4,
                        repeat: Infinity,
                        ease: 'linear',
                        delay: Math.random() * 5
                    }}
                />
            ))}
        </React.Fragment>
    );

    return (
        <CinematicOverlay 
            show={timeLeft > 0} 
            backgroundElements={particles}
        >
            <div className="flex flex-col items-center">
                {/* Timer */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    className="flex flex-col items-center"
                >
                    <span className="text-white/95 font-['Cinzel'] text-6xl md:text-8xl font-light tabular-nums tracking-[0.2em] mix-blend-plus-lighter">
                        {timeLeft.toString().padStart(2, '0')}
                    </span>
                </motion.div>

                {/* Divider */}
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "240px", opacity: 1 }}
                    transition={{ delay: 0.8, duration: 2, ease: "easeInOut" }}
                    className="h-[1px] bg-gradient-to-r from-transparent via-[#8B0000] to-transparent mt-8"
                />

                {/* Label */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5, duration: 1.5 }}
                    className="mt-8 text-[#916A47] font-['Cinzel'] tracking-[0.6em] uppercase text-xs md:text-sm text-center ml-[0.6em]"
                >
                    Night Starting
                </motion.p>
            </div>
        </CinematicOverlay>
    );
};
