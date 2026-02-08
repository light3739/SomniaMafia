// components/game/PlayerSpot.tsx
import React, { memo, useState, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Player, Role } from '../../types';
import { Skull, HelpCircle, User, X, Settings2, Volume2, VolumeX } from 'lucide-react';
import { useSoundEffects } from '../ui/SoundEffects';


interface PlayerSpotProps {
    player: Player;
    onAction?: (address: `0x${string}`) => void;
    isMe: boolean;
    canAct: boolean;
    isSelected?: boolean;
    isNight?: boolean;
    myRole?: Role; // Role of the current player (for night selection colors)
    mark: 'mafia' | 'civilian' | 'question' | null;
    onSetMark: (address: string, mark: 'mafia' | 'civilian' | 'question' | null) => void;
    isSpeaking?: boolean; // Whether this player is currently speaking
    speechTimeRemaining?: number; // Seconds remaining in their speech
    voters?: Player[]; // Players who voted for this player
}

export const PlayerSpot = memo<PlayerSpotProps>(({ player, onAction, isMe, canAct, isSelected, isNight = false, myRole, mark: currentMark, onSetMark: setPlayerMark, isSpeaking = false, speechTimeRemaining = 0, voters = [] }) => {
    const { playClickSound, playMarkSound } = useSoundEffects();
    const [isHoveringMarks, setIsHoveringMarks] = useState(false);
    const [isVolumeOpen, setIsVolumeOpen] = useState(false);
    const [volume, setVolume] = useState(1.0);
    const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        // Try to find LiveKit audio element for this player
        // MicButton creates elements with id="audio-{identity}" where identity matches userName
        const audioEl = document.getElementById(`audio-${player.name}`) as HTMLAudioElement;
        if (audioEl) {
            audioEl.volume = newVolume;
        } else {
            // Fallback: try finding by address if identity strategy changes
            const audioElByAddr = document.getElementById(`audio-${player.address}`) as HTMLAudioElement;
            if (audioElByAddr) {
                audioElByAddr.volume = newVolume;
            }
        }
    };

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
                    return 'bg-rose-500/30 border border-rose-500 ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]';
                case Role.DOCTOR:
                    return 'bg-teal-500/30 border border-teal-500 ring-2 ring-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.5)]';
                case Role.DETECTIVE:
                    return 'bg-sky-500/30 border border-sky-500 ring-2 ring-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.5)]';
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
            case 'mafia': return <Skull className={`${className} text-rose-500`} />;
            case 'civilian': return <User className={`${className} text-teal-500`} />;
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
            {/* Speech Time Indicator - Shows when player is speaking */}
            {/* Glow effect - shows entire speech time */}
            {isSpeaking && speechTimeRemaining > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{
                        // Soft glow effect
                        boxShadow: `
                            inset 0 0 8px rgba(255, 250, 235, 0.4),
                            0 0 8px rgba(255, 250, 235, 0.6),
                            0 0 16px rgba(255, 250, 235, 0.5),
                            0 0 28px rgba(255, 250, 235, 0.4),
                            0 0 45px rgba(255, 250, 235, 0.25)
                        `,
                    }}
                />
            )}

            {/* Centered Timer Overlay - only shows at ≤10 seconds */}
            {isSpeaking && speechTimeRemaining <= 10 && speechTimeRemaining > 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                >
                    <div
                        className="flex items-center justify-center rounded-lg"
                        style={{
                            width: 56,
                            height: 40,
                            backgroundColor: 'rgba(0, 0, 0, 0.3)'
                        }}
                    >
                        <span className="text-2xl font-bold text-white font-['Montserrat'] tabular-nums">
                            {speechTimeRemaining}
                        </span>
                    </div>
                </motion.div>
            )}

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
                            className="w-7 h-7 rounded-full border border-white/20 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-white/40 z-30 shadow-lg"
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
                                        <User className="w-6 h-6 text-teal-500 drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
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
                                        <Skull className="w-6 h-6 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
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
                        <Image
                            src={player.avatarUrl}
                            alt={player.name}
                            fill
                            sizes="64px"
                            className="object-cover"
                        />
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
                {/* Online/Offline Status Dot - Green for Alive/Connected, Red for Dead/Kicked */}
                <div className={`
                    absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#19130D]
                    ${player.status === 'connected' && player.isAlive ? 'bg-green-500' : 'bg-red-500'}
                `}></div>
            </div>

            {/* Text Info */}
            <div className="flex flex-col items-start min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 w-full">
                    <span className={`text-sm md:text-base font-bold truncate block max-w-[120px] ${isMafiaVisible ? 'text-rose-500' : 'text-[#916A47]'}`}>
                        {player.name}
                    </span>

                    {/* Volume Mixer Control (Only if not me and alive) */}
                    {!isMe && player.isAlive && (
                        <div
                            className="relative"
                            onMouseLeave={() => {
                                // Auto-close when mouse leaves the controls area
                                closeTimerRef.current = setTimeout(() => setIsVolumeOpen(false), 50);
                            }}
                            onMouseEnter={() => {
                                // Cancel close timer if mouse returns
                                if (closeTimerRef.current) {
                                    clearTimeout(closeTimerRef.current);
                                    closeTimerRef.current = null;
                                }
                            }}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsVolumeOpen(!isVolumeOpen);
                                }}
                                className={`
                                    p-1 rounded-md transition-all duration-200 mt-0.5
                                    ${isVolumeOpen ? 'text-[#916A47] bg-[#916A47]/10' : 'text-[#916A47] hover:bg-[#916A47]/10'}
                                `}
                                title="Voice Volume"
                            >
                                <Volume2 className="w-4 h-4" />
                            </button>

                            {/* Volume Slider Flyout */}
                            <AnimatePresence>
                                {isVolumeOpen && (
                                    <>
                                        {/* Click Outside Overlay removed to allow onMouseLeave to work properly */}

                                        <motion.div
                                            initial={{ opacity: 0, scale: 0, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0, y: 10 }}
                                            transition={{ duration: 0.15, ease: "easeOut" }}
                                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 origin-bottom"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="bg-black/70 backdrop-blur-md rounded-xl p-2 flex items-center gap-2 w-[120px]">
                                                <button
                                                    onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)}
                                                    className="text-[#916A47]/70 hover:text-[#916A47] transition-colors"
                                                >
                                                    {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                                </button>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={volume}
                                                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                                    className="w-full h-1 bg-[#916A47]/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#916A47] [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(145,106,71,0.5)] hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                                                />
                                            </div>
                                            {/* Triangle pointer */}
                                            <div
                                                className="absolute left-1/2 -translate-x-1/2 -bottom-2"
                                                style={{
                                                    width: 0,
                                                    height: 0,
                                                    borderLeft: '8px solid transparent',
                                                    borderRight: '8px solid transparent',
                                                    borderTop: '8px solid rgba(0, 0, 0, 0.7)',
                                                }}
                                            />


                                            {/* Invisible bridge to prevent closing when moving over the gap */}
                                            <div className="absolute top-full left-0 w-full h-4 bg-transparent" />
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
                <div className="text-[10px] text-white/30 font-mono">
                    {player.address ? `${player.address.slice(0, 4)}...${player.address.slice(-4)}` : '0x...'}
                </div>

                {/* Voter Avatars - shows who voted for this player */}
                <AnimatePresence>
                    {voters.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="flex -space-x-2 mt-2"
                        >
                            {voters.slice(0, 5).map((voter, index) => (
                                <motion.div
                                    key={voter.address}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0 }}
                                    transition={{ delay: index * 0.1, type: "spring", stiffness: 500, damping: 25 }}
                                    className="relative w-6 h-6 rounded-full border-2 border-[#916A47] overflow-hidden bg-[#19130D] shadow-lg"
                                    title={voter.name}
                                    style={{ zIndex: voters.length - index }}
                                >
                                    {voter.avatarUrl ? (
                                        <Image
                                            src={voter.avatarUrl}
                                            alt={voter.name}
                                            fill
                                            sizes="24px"
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[#916A47]/30">
                                            <User className="w-3 h-3 text-[#916A47]" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            {voters.length > 5 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="w-6 h-6 rounded-full border-2 border-[#916A47] bg-[#19130D] flex items-center justify-center text-[10px] text-[#916A47] font-bold"
                                >
                                    +{voters.length - 5}
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

        </motion.div >
    );
});

PlayerSpot.displayName = 'PlayerSpot';
