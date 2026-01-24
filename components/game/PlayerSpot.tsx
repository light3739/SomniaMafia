// components/game/PlayerSpot.tsx
import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Player, Role } from '../../types';
import { Skull, HelpCircle, User, X } from 'lucide-react';
import { useSoundEffects } from '../ui/SoundEffects';
import { useGameContext } from '../../contexts/GameContext';

interface PlayerSpotProps {
    player: Player;
    onAction?: (address: `0x${string}`) => void;
    isMe: boolean;
    canAct: boolean;
    isSelected?: boolean;
    isNight?: boolean;
    myRole?: Role; // Role of the current player (for night selection colors)
}

export const PlayerSpot = memo<PlayerSpotProps>(({ player, onAction, isMe, canAct, isSelected, isNight = false, myRole }) => {
    const { playClickSound, playMarkSound } = useSoundEffects();
    const { playerMarks, setPlayerMark } = useGameContext();
    const [isHoveringMarks, setIsHoveringMarks] = useState(false);

    const currentMark = playerMarks[player.address.toLowerCase()] || null;

    // Determine selection color based on role during night
    const getSelectionClasses = () => {
        if (!isSelected) {
            // Default styling
            let base = 'bg-[#916A47]/20 border border-[#916A47]/80';

            // Highlight "Me" card generally
            if (isMe) {
                base = 'bg-[#916A47]/40 border border-[#916A47] shadow-[0_0_15px_rgba(145,106,71,0.3)]';
            }

            return base;
        }

        // Night phase - use role-specific colors
        if (isNight && myRole) {
            switch (myRole) {
                case Role.MAFIA:
                    return 'bg-rose-400/30 border border-rose-400 ring-2 ring-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.5)]';
                case Role.DOCTOR:
                    return 'bg-teal-400/30 border border-teal-400 ring-2 ring-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.5)]';
                case Role.DETECTIVE:
                    return 'bg-sky-400/30 border border-sky-400 ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.5)]';
                default:
                    return 'bg-[#916A47]/50 border border-[#916A47] ring-2 ring-[#916A47] shadow-[0_0_20px_rgba(145,106,71,0.5)]';
            }
        }

        // Day/Voting phase - brown color
        return 'bg-[#916A47]/50 border border-[#916A47] ring-2 ring-[#916A47] shadow-[0_0_20px_rgba(145,106,71,0.5)]';
    };

    const isMafiaVisible = isNight && myRole === Role.MAFIA && player.role === Role.MAFIA;

    const renderMarkIcon = (mark: string | null, size: number = 3) => {
        const className = `w-${size} h-${size}`;
        switch (mark) {
            case 'mafia': return <Skull className={`${className} text-rose-400`} />;
            case 'civilian': return <User className={`${className} text-teal-400`} />;
            case 'question': return <HelpCircle className={`${className} text-amber-500`} />;
            default: return null;
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: player.isAlive ? 1 : 0.5, scale: 1 }}
            whileHover={player.isAlive && canAct ? { scale: 1.02, y: -2 } : {}}
            onClick={() => {
                if (player.isAlive && canAct && onAction && !isHoveringMarks) {
                    playClickSound();
                    onAction(player.address as `0x${string}`);
                }
            }}
            className={`
                relative flex flex-row items-center gap-4 p-4 rounded-xl transition-all duration-300
                w-[250px] h-[130px]
                ${canAct && player.isAlive ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                ${getSelectionClasses()}
                ${isMe && !isSelected ? 'ring-1 ring-[#916A47]/50' : ''}
            `}
        >
            {/* Suspicion Marks (Only for others and ONLY for Town roles: Civilian, Doctor, Detective) */}
            {!isMe && player.isAlive && myRole !== Role.MAFIA && myRole !== Role.UNKNOWN && (
                <div
                    className="absolute top-0 right-0 p-3 z-30"
                    onMouseEnter={() => setIsHoveringMarks(true)}
                    onMouseLeave={() => setIsHoveringMarks(false)}
                >
                    <div className="relative w-8 h-8 flex items-center justify-center">
                        {/* The Trigger Circle */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setPlayerMark(player.address, null);
                            }}
                            className="w-7 h-7 rounded-full border border-white/20 bg-black/60 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-white/40 z-30 shadow-lg"
                        >
                            <AnimatePresence mode="wait">
                                {isHoveringMarks ? (
                                    <motion.div
                                        key="clear"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        transition={{ duration: 0.1 }}
                                    >
                                        <X className="w-4 h-4 text-white/80" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="mark"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0 }}
                                        transition={{ duration: 0.1 }}
                                        className="flex items-center justify-center"
                                    >
                                        {currentMark ? renderMarkIcon(currentMark, 4) : <div className="w-1 h-1 rounded-full bg-white/40" />}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </button>

                        {/* Fly-out symbols (No background) - Uniform & Linear */}
                        <AnimatePresence>
                            {isHoveringMarks && (
                                <>
                                    {/* Civilian - Up */}
                                    <motion.button
                                        key="mark-civ"
                                        initial={{ opacity: 0, x: 0, y: 0 }}
                                        animate={{ opacity: 1, x: 0, y: -45 }}
                                        exit={{ opacity: 0, x: 0, y: 0 }}
                                        transition={{ duration: 0.15, ease: "linear" }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            playMarkSound();
                                            setPlayerMark(player.address, 'civilian');
                                            setIsHoveringMarks(false);
                                        }}
                                        data-custom-sound="true"
                                        className="absolute p-2 hover:scale-110 transition-transform z-20"
                                    >
                                        <User className="w-6 h-6 text-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                                    </motion.button>

                                    {/* Question - Diagonal Right Up */}
                                    <motion.button
                                        key="mark-ques"
                                        initial={{ opacity: 0, x: 0, y: 0 }}
                                        animate={{ opacity: 1, x: 40, y: -40 }}
                                        exit={{ opacity: 0, x: 0, y: 0 }}
                                        transition={{ duration: 0.15, ease: "linear" }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            playMarkSound();
                                            setPlayerMark(player.address, 'question');
                                            setIsHoveringMarks(false);
                                        }}
                                        data-custom-sound="true"
                                        className="absolute p-2 hover:scale-110 transition-transform z-20"
                                    >
                                        <HelpCircle className="w-6 h-6 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                                    </motion.button>

                                    {/* Mafia - Right */}
                                    <motion.button
                                        key="mark-maf"
                                        initial={{ opacity: 0, x: 0, y: 0 }}
                                        animate={{ opacity: 1, x: 50, y: 0 }}
                                        exit={{ opacity: 0, x: 0, y: 0 }}
                                        transition={{ duration: 0.15, ease: "linear" }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            playMarkSound();
                                            setPlayerMark(player.address, 'mafia');
                                            setIsHoveringMarks(false);
                                        }}
                                        data-custom-sound="true"
                                        className="absolute p-2 hover:scale-110 transition-transform z-20"
                                    >
                                        <Skull className="w-6 h-6 text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.6)]" />
                                    </motion.button>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* YOU Badge */}
            {isMe && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#916A47] text-black text-[8px] font-bold uppercase tracking-wider rounded-full z-10">
                    YOU
                </div>
            )}

            {/* Avatar Container */}
            <div className="relative shrink-0">
                <div className={`
                    w-16 h-16 rounded-full overflow-hidden border-2 
                    ${isMe ? 'border-[#916A47] shadow-[0_0_15px_rgba(145,106,71,0.3)]' : 'border-[#916A47]'}
                    ${!player.isAlive ? 'grayscale opacity-50' : ''}
                    bg-[#D9D9D9] relative
                `}>
                    {player.avatarUrl ? (
                        <img src={player.avatarUrl} alt={player.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-[#19130D]" />
                    )}

                    {/* Dead Overlay in Avatar */}
                    {!player.isAlive && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <Skull className="w-8 h-8 text-white/80" />
                        </div>
                    )}
                </div>

                {/* Online/Offline Status Dot */}
                {player.isAlive && (
                    <div className={`
                        absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#19130D]
                        ${player.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}
                    `}></div>
                )}
            </div>

            {/* Text Info */}
            <div className="flex flex-col items-start min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 w-full">
                    <span className={`text-sm md:text-base font-bold truncate block max-w-full ${isMafiaVisible ? 'text-rose-400' : 'text-[#916A47]'}`}>
                        {player.name}
                    </span>
                </div>
                <div className="text-[10px] text-white/30 font-mono">
                    {player.address ? `${player.address.slice(0, 4)}...${player.address.slice(-4)}` : '0x...'}
                </div>
            </div>

        </motion.div>
    );
});

PlayerSpot.displayName = 'PlayerSpot';
