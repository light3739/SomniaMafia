// components/game/PlayerSpot.tsx
import React, { memo, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Player, Role } from '../../types';
import { Skull, HelpCircle, User, X, Settings2, Volume2, VolumeX } from 'lucide-react';
import { useSoundEffects } from '../ui/SoundEffects';
import ElasticSlider from '../ui/ElasticSlider';


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
    const volumeWrapperRef = useRef<HTMLDivElement>(null);

    // Click outside to close volume slider
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isVolumeOpen && volumeWrapperRef.current && !volumeWrapperRef.current.contains(event.target as Node)) {
                setIsVolumeOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isVolumeOpen]);

    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        // Try to find LiveKit audio element for this player
        // MicButton creates elements with id="audio-{identity}" where identity matches userName
        let audioEl = document.getElementById(`audio-${player.name}`) as HTMLAudioElement | null;

        // Fallback: try finding by address if identity strategy changes
        if (!audioEl) {
            audioEl = document.getElementById(`audio-${player.address}`) as HTMLAudioElement | null;
        }

        // Fallback: search by data-participant attribute
        if (!audioEl) {
            audioEl = document.querySelector(`audio[data-participant="${player.name}"]`) as HTMLAudioElement | null;
        }

        if (audioEl) {
            audioEl.volume = newVolume;
            console.log(`[PlayerSpot] Volume set to ${newVolume} for ${player.name}`);
        } else {
            console.log(`[PlayerSpot] No audio element found for ${player.name} (address: ${player.address})`);
        }
    };

    // Determine selection color based on role during night
    const getSelectionClasses = () => {
        // Базовый нуарный стиль (плотный черный фон, еле заметная рамка, плотная маленькая тень)
        const baseNoir = 'bg-[#1A1612] border border-[#916A47]/50 shadow-[0_4px_10px_rgba(0,0,0,0.8)]';

        // Dead player — «закрытое дело»: базовый фон, неяркая белая рамка для видимости
        if (!player.isAlive) {
            return 'bg-[#1A1612] border border-white/20 shadow-[0_4px_10px_rgba(0,0,0,0.95)]';
        }

        if (!isSelected) {
            return baseNoir;
        }

        // Night phase - Clean bright borders for selection (no glow, no shift)
        if (isNight && myRole) {
            switch (myRole) {
                case Role.MAFIA:
                    // Глубокий бордовый (вместо почти черного)
                    return 'bg-[#1A0505] border border-[#8B0000] shadow-[0_4px_10px_rgba(0,0,0,0.9)]';

                case Role.DOCTOR:
                    // Темно-хвойный/медицинский бирюзовый
                    return 'bg-[#031A18] border border-[#0D9488] shadow-[0_4px_10px_rgba(0,0,0,0.9)]';

                case Role.DETECTIVE:
                    // Фон: глубокий темный с оранжевым подтоном. Рамка: благородная матовая медь.
                    return 'bg-[#1A0C06] border border-[#A85832] shadow-[0_4px_10px_rgba(0,0,0,0.9)]';

                default:
                    // Классический темный нуар (чуть теплее оригинала)
                    return 'bg-[#1F170D] border border-[#D4A77C] shadow-[0_4px_10px_rgba(0,0,0,0.9)]';
            }
        }

        // Day/Voting phase - Bright Solid Bronze
        return 'bg-[#2C2112] border border-[#FFC894] shadow-[0_4px_10px_rgba(0,0,0,0.9)]';
    };

    const isMafiaVisible = isNight && myRole === Role.MAFIA && player.role === Role.MAFIA;

    const renderMarkIcon = (mark: string | null, size: number = 3) => {
        const className = `w-${size} h-${size}`;
        switch (mark) {
            case 'mafia': return <Skull className={`${className} text-[#8B0000]`} />;
            case 'civilian': return <User className={`${className} text-[#0D9488]`} />;
            case 'question': return <HelpCircle className={`${className} text-[#B45309]`} />;
            default: return null;
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
                opacity: 1, // Always opaque to prevent blending with background
                scale: 1,
                filter: !player.isAlive
                    ? 'grayscale(100%) contrast(110%) brightness(100%)'
                    : (isNight && !isMe && !isSelected && !isMafiaVisible
                        ? 'grayscale(85%) contrast(100%) brightness(60%)'
                        : 'grayscale(0%) contrast(100%) brightness(100%)')
            }}
            whileHover={player.isAlive && isNight && !isMe && !isSelected && !isMafiaVisible ? {
                opacity: 1,
                scale: 1,
                filter: 'grayscale(0%) contrast(100%) brightness(100%)'
            } : {}}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            onClick={() => {
                if (player.isAlive && canAct && onAction && !isHoveringMarks) {
                    playClickSound();
                    onAction(player.address as `0x${string}`);
                }
            }}
            className={`
                group relative rounded-md transition-all duration-300
                w-[250px] h-[130px]
                ${canAct && player.isAlive ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                ${getSelectionClasses()}
                ${!player.isAlive ? 'player-dead' : ''}
            `}
        >
            {/* Blurred Content Overlay for Dead Players */}
            <div
                className="relative w-full h-full flex flex-row items-center gap-4 p-4"
                style={{ filter: !player.isAlive ? 'blur(1.5px)' : 'none' }}
            >
                {/* Soft Glowing Frame Aura (Framer Motion) */}
                <AnimatePresence>
                    {isSpeaking && speechTimeRemaining > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 rounded-md pointer-events-none z-0"
                            animate={{
                                opacity: 1,
                                boxShadow: [
                                    '0 0 20px 0px rgba(145, 106, 71, 0.4), inset 0 0 10px 0px rgba(145, 106, 71, 0.2)',
                                    '0 0 50px 8px rgba(145, 106, 71, 0.95), inset 0 0 25px 0px rgba(145, 106, 71, 0.45)'
                                ]
                            }}
                            transition={{
                                opacity: { duration: 0.5 },
                                boxShadow: {
                                    duration: 1.25,
                                    repeat: Infinity,
                                    repeatType: "reverse",
                                    ease: "easeInOut"
                                }
                            }}
                        />
                    )}
                </AnimatePresence>

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
                                className="w-7 h-7 rounded-full border border-white/10 bg-[#050505] flex items-center justify-center transition-all duration-300 hover:scale-110 hover:border-[#916A47] z-30 shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
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
                                            <User className="w-6 h-6 text-[#0D9488]" />
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
                                            <HelpCircle className="w-6 h-6 text-[#B45309]" />
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
                                            <Skull className="w-6 h-6 text-[#8B0000]" />
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
                    w-16 h-16 rounded-md overflow-hidden border transition-colors duration-300
                    ${player.isAlive ? 'border-white/10' : 'border-[#8B0000]/50'}
                    bg-[#19130D] relative
                `}>
                        {/* Blurred Avatar Wrapper (only image is blurred) */}
                        <div className="w-full h-full relative">
                            {player.avatarUrl ? (
                                <Image
                                    src={player.avatarUrl}
                                    alt={player.name}
                                    fill
                                    sizes="64px"
                                    className={`object-cover transition-all duration-500 ${player.isAlive ? 'grayscale-[0.8] contrast-125 sepia-[0.2] brightness-90 group-hover:grayscale-[0.3]' : 'grayscale contrast-150 brightness-100 sepia-[0.5] hue-rotate-[-30deg]'}`}
                                />
                            ) : (
                                <div className="w-full h-full bg-[#19130D]" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Text Info */}
                <div className="flex flex-col items-start min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 w-full">
                        <span className={`text-[17px] md:text-base font-bold truncate block max-w-[120px] ${isMafiaVisible ? 'text-[#8B0000]' : 'text-[#916A47]'}`}>
                            {player.name}
                        </span>

                        {/* Volume Mixer Control (Only if not me and alive) */}
                        {!isMe && player.isAlive && (
                            <div
                                ref={volumeWrapperRef}
                                className="relative"
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
                                                className="absolute bottom-full right-0 mb-2 z-50 origin-bottom-right"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="bg-[#050505] rounded-md p-3 flex items-center gap-3 w-[140px] border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.9)]">
                                                    <button
                                                        onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)}
                                                        className="text-[#916A47]/70 hover:text-[#916A47] transition-colors shrink-0"
                                                    >
                                                        {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                                    </button>

                                                    <div className="flex-1 w-full">
                                                        <ElasticSlider
                                                            defaultValue={1}
                                                            onChange={handleVolumeChange}
                                                            min={0}
                                                            max={1}
                                                            step={0.05}
                                                        />
                                                    </div>
                                                </div>
                                                {/* Triangle pointer */}
                                                <div
                                                    className="absolute right-2 -bottom-2"
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
                    <div className="text-[12px] md:text-[10px] text-white/30 font-mono">
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
                                                className="object-cover grayscale contrast-125 brightness-75"
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
            </div>

            {/* DEAD Badge */}
            {!player.isAlive && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/80 text-black text-[8px] font-bold uppercase tracking-wider rounded-full z-10 shadow-lg border border-white/10">
                    DEAD
                </div>
            )}

        </motion.div >
    );
});

PlayerSpot.displayName = 'PlayerSpot';
