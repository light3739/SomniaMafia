import React from 'react';
import { motion } from 'framer-motion';
import somniaLogo from '../assets/somniayeal.png';
import mafiaBg from '../assets/mafia1.jpg';

interface MainPageProps {
    onStart: () => void;
}

export const MainPage: React.FC<MainPageProps> = ({ onStart }) => {
    return (
        <div
            className="relative w-full h-screen overflow-hidden bg-black cursor-pointer flex items-center justify-center font-sans"
            onClick={onStart}
        >
            {/* Background Image - Reverted to Cover as requested */}
            <div className="absolute inset-0">
                <img
                    src={mafiaBg}
                    alt="Background"
                    className="w-full h-full object-cover opacity-80"
                />
            </div>

            <div className="absolute inset-0 bg-black/30" />

            {/* Content Container */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center p-4">

                {/* Main Title: Mafia Online (SVG for exact styling) */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="w-full max-w-[90vw] md:max-w-[800px]"
                >
                    <svg viewBox="0 0 600 120" className="w-full h-auto overflow-visible">
                        <text
                            x="50%"
                            y="60%"
                            dominantBaseline="middle"
                            textAnchor="middle"
                            fill="#ffffff"
                            stroke="#000000"
                            strokeWidth="0"
                            strokeOpacity="0"
                            strokeLinecap="square"
                            strokeLinejoin="bevel"
                            textRendering="auto"
                            letterSpacing="1.44"
                            style={{
                                fontFamily: '"Playfair Display", serif',
                                fontSize: '72px',
                                fontStyle: 'italic',
                                fontWeight: 900,
                                filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))'
                            }}
                        >
                            Mafia Online
                        </text>
                    </svg>
                </motion.div>

                {/* Subtitle Row: Text + Logo to the right */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="flex flex-row items-center justify-center gap-4 mt-[-10px] md:mt-[-20px]"
                >
                    <p
                        style={{
                            fontFamily: '"Montserrat", sans-serif',
                            color: '#ffb01d',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2em', // Adjusted for visual balance with adaptive sizing
                            fontWeight: 600,
                            textShadow: '0px 2px 4px rgba(0,0,0,0.6)'
                        }}
                        className="text-[10px] md:text-[14px] lg:text-[18px] whitespace-nowrap"
                    >
                        On Somnia Network
                    </p>

                    <img
                        src={somniaLogo}
                        alt="Somnia"
                        className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-md"
                    />
                </motion.div>

                {/* Start Prompt */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                    className="absolute bottom-12 text-white/50 font-mono text-xs md:text-sm tracking-[0.3em]"
                >
                    CLICK ANYWHERE TO START
                </motion.div>

            </div>
        </div>
    );
};