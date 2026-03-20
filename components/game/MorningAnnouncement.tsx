import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CinematicOverlay } from './CinematicOverlay';
import { useSoundEffects } from '../ui/SoundEffects';

interface MorningAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const MorningAnnouncement = React.memo(({ show, onComplete }: MorningAnnouncementProps) => {
    const { playMorningTransition } = useSoundEffects();

    useEffect(() => {
        if (show) {
            playMorningTransition();
            const timer = setTimeout(() => onComplete(), 4000);
            return () => clearTimeout(timer);
        }
    }, [show, onComplete, playMorningTransition]);

    const background = (
        <React.Fragment>
            {/* Horizontal light rays — warm dawn light through blinds */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[
                    { top: '18%', width: '70%', maxOpacity: 0.15, duration: 14, delay: 0.5, angle: -1 },
                    { top: '32%', width: '85%', maxOpacity: 0.12, duration: 18, delay: 1.5, angle: 0.5 },
                    { top: '48%', width: '60%', maxOpacity: 0.2, duration: 12, delay: 0, angle: -0.5 },
                    { top: '62%', width: '75%', maxOpacity: 0.1, duration: 16, delay: 2, angle: 1 },
                    { top: '78%', width: '55%', maxOpacity: 0.15, duration: 20, delay: 3, angle: -0.8 },
                ].map((ray, i) => (
                    <motion.div
                        key={i}
                        className="absolute h-[1px]"
                        style={{
                            top: ray.top,
                            left: '-10%',
                            width: ray.width,
                            background: `linear-gradient(90deg, transparent 0%, rgba(217, 169, 89, 0.6) 30%, rgba(217, 169, 89, 0.9) 50%, rgba(217, 169, 89, 0.6) 70%, transparent 100%)`,
                            transform: `rotate(${ray.angle}deg)`,
                            filter: 'blur(2px)',
                        }}
                        initial={{ opacity: 0, x: -40 }}
                        animate={{
                            opacity: [0, ray.maxOpacity, ray.maxOpacity * 1.5, ray.maxOpacity, 0],
                            x: [-40, 60, 120],
                        }}
                        transition={{
                            duration: ray.duration,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: ray.delay,
                        }}
                    />
                ))}
            </div>

            {/* Subtle warm dawn glow — with breathing pulse */}
            <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 3, ease: "easeOut", delay: 1 }}
            >
                <motion.div
                    className="w-[300px] h-[300px] md:w-[450px] md:h-[450px] rounded-full blur-[120px] bg-amber-900"
                    animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.25, 0.15] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
            </motion.div>
        </React.Fragment>
    );

    return (
        <CinematicOverlay 
            show={show} 
            backgroundElements={background}
            duration={1.5}
        >
            <motion.div
                initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
                animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                className="flex flex-col items-center"
            >
                <h1 className="text-5xl md:text-7xl font-['Cinzel'] font-light tracking-[0.3em] text-white/95 uppercase mix-blend-plus-lighter">
                    Day Breaks
                </h1>
                
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "200px", opacity: 1 }}
                    transition={{ delay: 1.5, duration: 1.5, ease: "easeInOut" }}
                    className="h-[1.5px] bg-gradient-to-r from-transparent via-white/50 to-transparent mt-8 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                />
                
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 1 }}
                    className="mt-8 text-white/50 font-sans tracking-[0.6em] uppercase text-[10px] md:text-xs text-center ml-[0.6em]"
                >
                    The town awakens
                </motion.p>
            </motion.div>
        </CinematicOverlay>
    );
});

MorningAnnouncement.displayName = 'MorningAnnouncement';
