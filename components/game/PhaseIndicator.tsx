import React from 'react';
import { motion } from 'framer-motion';
import { GamePhase } from '../../types';
import { Sun, Moon, Vote, Skull } from 'lucide-react';

interface PhaseIndicatorProps {
    phase: GamePhase;
    dayCount: number;
}

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({ phase, dayCount }) => {
    const isNight = phase === GamePhase.NIGHT;

    const getConfig = () => {
        switch (phase) {
            case GamePhase.NIGHT:
                return { icon: <Moon className="w-5 h-5" />, label: "Night Phase", color: "bg-indigo-950/50 text-indigo-300 border-indigo-500/30" };
            case GamePhase.DAY:
                return { icon: <Sun className="w-5 h-5" />, label: "Day Phase", color: "bg-amber-950/50 text-amber-300 border-amber-500/30" };
            case GamePhase.VOTING:
                return { icon: <Vote className="w-5 h-5" />, label: "Voting Session", color: "bg-red-950/50 text-red-300 border-red-500/30" };
            case GamePhase.GAME_OVER:
                return { icon: <Skull className="w-5 h-5" />, label: "Game Over", color: "bg-gray-900 text-gray-300 border-gray-700" };
            default:
                return { icon: <div className="w-5 h-5 rounded-full border-2 border-current border-dashed animate-spin" />, label: "Syncing...", color: "bg-gray-900 text-gray-400 border-gray-800" };
        }
    };

    const config = getConfig();

    return (
        <motion.div
            key={phase}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`
                flex items-center gap-3 px-6 py-2 rounded-full border backdrop-blur-md shadow-lg
                ${config.color}
            `}
        >
            {config.icon}
            <div className="flex flex-col leading-none">
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">Status</span>
                <span className="text-sm font-bold font-['Montserrat']">{config.label} • Day {dayCount}</span>
            </div>
        </motion.div>
    );
};