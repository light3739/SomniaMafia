import React from 'react';
import { motion } from 'framer-motion';
import mafiaBg from '../assets/mafia1.jpg';

interface MainPageProps {
    onStart: () => void;
}

export const MainPage: React.FC<MainPageProps> = ({ onStart }) => {
    return (
        <div
            className="relative w-full h-screen overflow-hidden text-white cursor-pointer"
            onClick={onStart}
        >
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center z-0"
                style={{ backgroundImage: `url(${mafiaBg})` }}
            >
                <div className="absolute inset-0 bg-black/40" /> {/* Overlay for readability */}
            </div>

            {/* Content Container */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">

                {/* Main Title: Mafia Online */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="text-center"
                >
                    <svg width="100%" height="100%" viewBox="0 0 600 120" className="w-[80vw] max-w-[800px] h-auto overflow-visible">
                        <text
                            x="50%"
                            y="50%"
                            dominantBaseline="middle"
                            textAnchor="middle"
                            fill="#ffffff"
                            stroke="none"
                            style={{
                                fontFamily: '"Playfair Display", serif',
                                fontSize: 'clamp(40px, 8vw, 90px)',
                                fontStyle: 'italic',
                                fontWeight: 900,
                                letterSpacing: '0.02em',
                                filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))'
                            }}
                        >
                            Mafia Online
                        </text>
                    </svg>
                </motion.div>

                {/* Subtitle: On Somnia Network */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                    className="mt-6 md:mt-0"
                >
                    <p
                        style={{
                            fontFamily: '"Montserrat", sans-serif',
                            color: '#ffb01d',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3em', // Converted from 7.2 (approx)
                            fontSize: 'clamp(14px, 2vw, 24px)', // Responsive size
                            fontWeight: 600,
                            textShadow: '0px 2px 4px rgba(0,0,0,0.6)'
                        }}
                        className="text-center"
                    >
                        On Somnia Network
                    </p>
                </motion.div>

                {/* Start Prompt (Subtle) */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                    className="absolute bottom-12 text-gray-400 font-mono text-sm tracking-widest"
                >
                    CLICK ANYWHERE TO START
                </motion.div>

            </div>
        </div>
    );
};