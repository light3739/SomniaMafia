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
            className="relative w-full h-screen overflow-hidden bg-black cursor-pointer flex items-center justify-center"
            onClick={onStart}
        >
            {/* Background Image - Full Contain */}
            <div className="absolute inset-0 flex items-center justify-center">
                <img
                    src={mafiaBg}
                    alt="Background"
                    className="max-w-full max-h-full object-contain opacity-80"
                />
            </div>

            <div className="absolute inset-0 bg-black/20" /> {/* Slight overlay */}

            {/* Content Container */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">

                {/* Main Title: Mafia Online */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="text-center"
                >
                    <div className="w-[80vw] max-w-[800px]">
                        <svg width="100%" height="150" viewBox="0 0 600 150" className="overflow-visible">
                            <text
                                x="50%"
                                y="40%"
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

                            <text
                                x="50%"
                                y="85%" // Positioned below
                                dominantBaseline="middle"
                                textAnchor="middle"
                                fill="#ffb01d"
                                strokeWidth="0"
                                style={{
                                    fontFamily: '"Montserrat", sans-serif',
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '7.2px'
                                }}
                            >
                                On Somnia Network
                            </text>
                        </svg>

                        {/* Somnia Logo */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            className="flex justify-center mt-4"
                        >
                            <img src={somniaLogo} alt="Somnia" className="h-16 w-auto object-contain drop-shadow-lg" />
                        </motion.div>
                    </div>
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