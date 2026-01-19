import React from 'react';
import { motion } from 'framer-motion';
import { GamePhase } from '../../types';
import { Sun, Moon, Vote, Skull } from 'lucide-react';

interface PhaseIndicatorProps {
    phase: GamePhase;
    dayCount: number;
}

export const PhaseIndicator = React.memo(({ phase, dayCount }: PhaseIndicatorProps) => {
    const isNight = phase === GamePhase.NIGHT;

    const getConfig = () => {
        switch (phase) {
            case GamePhase.NIGHT:
                return { icon: <Moon className="w-5 h-5" />, label: "Night Phase", color: "bg-indigo-950/50 text-indigo-300 border-indigo-500/30" };
            case GamePhase.DAY:
                return { icon: <Sun className="w-5 h-5" />, label: "Day Phase", color: "bg-amber-950/50 text-amber-300 border-amber-500/30" };
            case GamePhase.VOTING:
                return { icon: <Sun className="w-5 h-5" />, label: "Voting Session", color: "bg-amber-950/50 text-amber-300 border-amber-500/30" };
            case GamePhase.ENDED:
                return { icon: <Skull className="w-5 h-5" />, label: "Game Over", color: "bg-gray-900 text-gray-300 border-gray-700" };
            case GamePhase.SHUFFLING:
                return { icon: <div className="w-5 h-5 rounded-full border-2 border-current border-dashed animate-spin" />, label: "Shuffling Deck", color: "bg-purple-950/50 text-purple-300 border-purple-500/30" };
            case GamePhase.REVEAL:
                return { icon: <div className="w-5 h-5 rounded-full border-2 border-current" />, label: "Revealing Roles", color: "bg-teal-950/50 text-teal-300 border-teal-500/30" };
            default:
                return { icon: <div className="w-5 h-5 rounded-full border-2 border-current border-dashed animate-spin" />, label: "Syncing...", color: "bg-gray-900 text-gray-400 border-gray-800" };
        }
    };

    const config = getConfig();

    return (
        <div className="flex items-center gap-3">
            {/* Icon separate and outside */}
            <div className={`
                p-2 rounded-full backdrop-blur-sm transition-all duration-500 ease-in-out
                ${config.color.split(' ')[1]}
            `}>
                <motion.div
                    key={phase} // Animate icon switch
                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {React.cloneElement(config.icon as React.ReactElement<any>, { className: "w-8 h-8 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" })}
                </motion.div>
            </div>

            {/* Text badge with border */}
            <div className={`
                px-6 py-2 rounded-full border backdrop-blur-md shadow-lg transition-all duration-500 ease-in-out
                ${config.color}
            `}>
                <span className="text-lg font-bold font-['Montserrat'] uppercase tracking-widest">
                    {phase === GamePhase.DAY ? `Day ${dayCount}` :
                        phase === GamePhase.NIGHT ? `Day ${dayCount}` :
                            phase === GamePhase.VOTING ? `Day ${dayCount}` :
                                config.label}
                </span>
            </div>
        </div>
    );
});