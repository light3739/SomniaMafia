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
                return { icon: <Moon className="w-5 h-5" />, label: "Night Phase", color: "text-[#8B0000] border-[#8B0000]/40" }; // Кровавый
            case GamePhase.DAY:
                return { icon: <Sun className="w-5 h-5" />, label: "Day Phase", color: "text-[#916A47] border-[#916A47]/40" }; // Бронза
            case GamePhase.VOTING:
                return { icon: <Vote className="w-5 h-5" />, label: "Voting Session", color: "text-[#916A47] border-[#916A47]/40" };
            case GamePhase.ENDED:
                return { icon: <Skull className="w-5 h-5" />, label: "Game Over", color: "text-white/30 border-white/10" }; // Пепел
            case GamePhase.SHUFFLING:
                return { icon: <div className="w-5 h-5 rounded-full border-2 border-current border-dashed animate-spin" />, label: "Shuffling Deck", color: "text-white/40 border-white/10" };
            case GamePhase.REVEAL:
                return { icon: <div className="w-5 h-5 rounded-full border-2 border-current" />, label: "Revealing Roles", color: "text-[#B45309] border-[#B45309]/40" }; // Ржавый янтарь
            default:
                return { icon: <div className="w-5 h-5 rounded-full border-2 border-current border-dashed animate-spin" />, label: "Syncing...", color: "text-white/30 border-white/10" };
        }
    };

    const config = getConfig();

    return (
        <div className="flex items-center gap-3">
            {/* Иконка (отдельный жесткий квадрат) */}
            <div className={`
                p-2 rounded-md bg-[#0A0A0A] border shadow-2xl transition-colors duration-500 ease-in-out
                ${config.color}
            `}>
                <motion.div
                    key={phase} // Animate icon switch
                    initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {React.cloneElement(config.icon as React.ReactElement<any>, { className: "w-6 h-6" })}
                </motion.div>
            </div>

            {/* Текстовая панель (строгая форма) */}
            <div className={`
                px-6 py-2 rounded-md bg-[#0A0A0A] border shadow-2xl transition-colors duration-500 ease-in-out
                ${config.color}
                ${phase === GamePhase.NIGHT ? 'border-b-[#8B0000]/60' : phase === GamePhase.ENDED ? 'border-b-white/20' : 'border-b-[#916A47]/60'}
                border-t-black
            `}>
                <span className="text-lg font-bold font-['Cinzel'] uppercase tracking-widest">
                    {phase === GamePhase.DAY ? `Day ${dayCount}` :
                        phase === GamePhase.NIGHT ? `Day ${dayCount}` :
                            phase === GamePhase.VOTING ? `Day ${dayCount}` :
                                config.label}
                </span>
            </div>
        </div>
    );
});