import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NightAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const NightAnnouncement: React.FC<NightAnnouncementProps> = ({ show, onComplete }) => {
    useEffect(() => {
        if (show) {
            // Держим заставку 3 секунды
            const timer = setTimeout(() => onComplete(), 3000); 
            return () => clearTimeout(timer);
        }
    }, [show, onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none"
                    // Входим в абсолютно глухой черный цвет
                    initial={{ opacity: 0, backgroundColor: 'rgba(5, 5, 5, 0)' }}
                    animate={{ opacity: 1, backgroundColor: 'rgba(5, 5, 5, 1)' }}
                    exit={{ opacity: 0 }} // Плавно исчезает, открывая ночной стол (или заставку мирного)
                    transition={{ duration: 1, ease: "easeInOut" }}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.05, opacity: 0, filter: 'blur(10px)' }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="flex flex-col items-center"
                    >
                        <h1 className="text-5xl md:text-7xl font-['Cinzel'] font-light tracking-[0.4em] text-white/90 uppercase">
                            Night Falls
                        </h1>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100px" }}
                            transition={{ delay: 0.5, duration: 1 }}
                            className="h-[1px] bg-red-800 mt-6"
                        />
                        <p className="mt-6 text-white/30 font-mono tracking-[0.5em] uppercase text-xs">
                            City goes silent
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
