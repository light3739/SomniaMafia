import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MorningAnnouncementProps {
    show: boolean;
    onComplete: () => void;
}

export const MorningAnnouncement = React.memo(({ show, onComplete }: MorningAnnouncementProps) => {
    useEffect(() => {
        if (show) {
            // Держим заставку 4 секунды для максимально плавного эффекта
            const timer = setTimeout(() => onComplete(), 4000);
            return () => clearTimeout(timer);
        }
    }, [show, onComplete]);

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none"
                    // Начинаем с глухого черного (подхватывая ночной экран) и ОЧЕНЬ медленно убираем фон
                    initial={{ backgroundColor: '#050505' }}
                    animate={{ backgroundColor: 'rgba(5, 5, 5, 0)' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 3, ease: "easeInOut" }} // 3 секунды на рассеивание тьмы
                >
                    <motion.div
                        // Текст медленно выплывает из блюра и темноты
                        initial={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
                        animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                        className="flex flex-col items-center"
                    >
                        <h1 className="text-5xl md:text-7xl font-['Cinzel'] font-light tracking-[0.4em] text-white/90 uppercase">
                            Daybreak
                        </h1>
                        
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "100px", opacity: 1 }}
                            transition={{ delay: 1.5, duration: 1.5, ease: "easeInOut" }}
                            className="h-[1px] bg-white/30 mt-6"
                        />
                        
                        <motion.p 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 2, duration: 1 }}
                            className="mt-6 text-white/30 font-mono tracking-[0.5em] uppercase text-xs"
                        >
                            The town awakens
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
});

MorningAnnouncement.displayName = 'MorningAnnouncement';
