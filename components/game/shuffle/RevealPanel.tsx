import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { Role } from '../../../types';
import { TypewriterText } from './TypewriterText';
import { AsciiSpinner } from './AsciiSpinner';
import { RoleConfig } from './roleConfig';

interface RevealPanelProps {
    revealState: {
        myRole: Role | null;
        isRevealed: boolean;
        hasConfirmed: boolean;
        eciesRegistered: boolean;
        hasSharedKeys: boolean;
    };
    isProcessing: boolean;
    isTxPending: boolean;
    onConfirm: () => void;
    allConfirmed: boolean;
    isTestMode: boolean;
}

export const RevealPanel: React.FC<RevealPanelProps> = ({
    revealState, isProcessing, isTxPending, onConfirm, allConfirmed, isTestMode
}) => {
    const roleConfig = revealState.myRole ? RoleConfig[revealState.myRole] : RoleConfig[Role.UNKNOWN];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <AnimatePresence mode="wait">
                {(!revealState.isRevealed && !isTestMode) ? (
                    // Loading state
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-5 text-center"
                    >
                        {/* ASCII Spinner */}
                        <div className="h-14 flex items-center justify-center mb-6">
                            <div className="relative w-14 h-14 flex items-center justify-center border border-white/5 bg-[#0f0e10] rounded-sm">
                                <AsciiSpinner className="text-[#c8a84b] text-2xl" />
                            </div>
                        </div>
                        <div>
                            <p className="font-mono text-[10px] tracking-[0.35em] text-white/50 uppercase mb-2">&gt; STATUS</p>
                            <p className="font-mono text-[16px] tracking-wide text-white/80 uppercase">
                                <TypewriterText 
                                    text={!revealState.eciesRegistered ? 'SECURING_CHANNEL' :
                                        !revealState.hasSharedKeys ? 'DECRYPTING_DOSSIER' :
                                            revealState.myRole ? `REVEALING_${revealState.myRole}` : 'VERIFYING_IDENTITY'} 
                                />
                                <motion.span
                                    className="ml-1 text-[#c8a84b]"
                                    animate={{ opacity: [1, 1, 0, 0, 1] }}
                                    transition={{ 
                                        duration: 1, 
                                        repeat: Infinity, 
                                        times: [0, 0.5, 0.51, 0.99, 1],
                                        ease: "linear"
                                    }}
                                >
                                    ▌
                                </motion.span>
                            </p>
                        </div>
                        <div className="w-full max-w-[220px]">
                            <div className="h-[2px] bg-black/70 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-[#c8a84b] rounded-full"
                                    animate={{ width: revealState.hasSharedKeys ? '100%' : '50%' }}
                                    transition={{ duration: 0.6 }}
                                />
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    // Role card (Original Design)
                    <motion.div
                        key="revealed"
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        transition={{ type: "spring", duration: 0.8 }}
                        className={`bg-gradient-to-br ${roleConfig.bgColor} w-[240px] aspect-[3/4] rounded-sm border ${roleConfig.borderColor} ring-1 ${roleConfig.ringColor} p-6 shadow-[0_30px_60px_rgba(0,0,0,0.98)] relative overflow-hidden flex flex-col justify-between`}
                    >
                        {/* SVG Noise */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
                            <filter id="noise-original">
                                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
                                <feColorMatrix type="saturate" values="0" />
                            </filter>
                            <rect width="100%" height="100%" filter="url(#noise-original)" />
                        </svg>

                        {/* Watermark icon */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 0.08, scale: 1 }}
                            transition={{ delay: 0.2, duration: 1 }}
                            className={`absolute top-4 right-4 ${roleConfig.color}`}
                        >
                            {roleConfig.icon}
                        </motion.div>

                        {/* CLASSIFIED stamp */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className={`absolute top-7 left-4 font-mono text-[10px] tracking-[0.3em] uppercase px-2 py-[3px] border ${roleConfig.borderColor} ${roleConfig.color} opacity-20 rotate-[-12deg] select-none pointer-events-none`}
                        >
                            CLASSIFIED
                        </motion.div>

                        {/* Pulsing border */}
                        <motion.div
                            className={`absolute inset-0 border ${roleConfig.borderColor}`}
                            animate={{ opacity: [0.2, 0.5, 0.2] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />

                        {/* Content */}
                        <div className="text-center flex-1 flex flex-col justify-center relative z-10">
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.15 }}
                                className="font-mono text-[7px] tracking-[0.3em] text-white/35 uppercase mb-3"
                            >
                                CASE FILE // ROLE
                            </motion.p>
                            <motion.h2
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className={`text-[24px] font-[Cinzel] font-semibold tracking-[0.2em] mb-3 ${roleConfig.color}`}
                            >
                                {revealState.myRole}
                            </motion.h2>
                            <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ delay: 0.45, duration: 0.5 }}
                                className="h-px w-10 mx-auto mb-3 opacity-30"
                                style={{ background: 'currentColor' }}
                            />
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.55 }}
                                className="text-white/40 text-[10px] font-mono leading-relaxed tracking-wide max-w-[170px] mx-auto"
                            >
                                {roleConfig.description}
                            </motion.p>
                        </div>

                        {/* Confirm button */}
                        <div className="relative z-10">
                            {!revealState.hasConfirmed ? (
                                <motion.button
                                    onClick={onConfirm}
                                    disabled={isProcessing || isTxPending}
                                    whileTap={{ scale: 0.98 }}
                                    className={`w-full py-2.5 px-4 rounded-sm border font-[Cinzel] text-[9px] tracking-[0.25em] uppercase transition-all duration-300
                                        border-white/10 text-white/50
                                        bg-transparent hover:bg-white/[0.05] hover:border-white/30 hover:text-white/80
                                        disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                                >
                                    {(isProcessing || isTxPending)
                                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Confirming...</>
                                        : 'I Understand My Role'}
                                </motion.button>
                            ) : (
                                <div className={`flex items-center justify-center gap-2 ${roleConfig.color} py-3`}>
                                    {allConfirmed ? <Check className="w-4 h-4" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span className="font-['Montserrat'] text-[9px] tracking-[0.2em] uppercase font-bold opacity-80">
                                        {allConfirmed ? 'Confirmed' : 'Awaiting Others...'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
