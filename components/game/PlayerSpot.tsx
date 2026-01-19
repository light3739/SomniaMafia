import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Player, Role } from '../../types';
import { Shield, Crosshair, Eye, Skull } from 'lucide-react';
import { useSoundEffects } from '../ui/SoundEffects';

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
    const { playClickSound } = useSoundEffects();

    // Determine selection color based on role during night
    const getSelectionClasses = () => {
        if (!isSelected) {
            return 'bg-[#916A47]/20 border border-[#916A47]/80';
        }

        // Night phase - use role-specific colors
        if (isNight && myRole) {
            switch (myRole) {
                case Role.MAFIA:
                    return 'bg-red-500/30 border border-red-500 ring-2 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]';
                case Role.DOCTOR:
                    return 'bg-green-500/30 border border-green-500 ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.5)]';
                case Role.DETECTIVE:
                    return 'bg-blue-500/30 border border-blue-500 ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]';
                default:
                    return 'bg-[#916A47]/50 border border-[#916A47] ring-2 ring-[#916A47] shadow-[0_0_20px_rgba(145,106,71,0.5)]';
            }
        }

        // Day/Voting phase - brown color
        return 'bg-[#916A47]/50 border border-[#916A47] ring-2 ring-[#916A47] shadow-[0_0_20px_rgba(145,106,71,0.5)]';
    };

    const getRoleIcon = () => {
        if (!isMe && player.isAlive && player.role === Role.UNKNOWN) return null;

        switch (player.role) {
            case Role.MAFIA: return <Crosshair className="w-3 h-3 text-red-500" />;
            case Role.DOCTOR: return <Shield className="w-3 h-3 text-green-500" />;
            case Role.DETECTIVE: return <Eye className="w-3 h-3 text-blue-500" />;
            default: return null;
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: player.isAlive ? 1 : 0.5, scale: 1 }}
            whileHover={player.isAlive && canAct ? { scale: 1.05, y: -5 } : {}}
            onClick={() => {
                if (player.isAlive && canAct && onAction) {
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
                    <span className="text-sm md:text-base font-bold truncate text-[#916A47] block max-w-full">
                        {player.name}
                    </span>
                    <div className="shrink-0">
                        {getRoleIcon()}
                    </div>
                </div>
                <div className="text-[10px] text-white/30 font-mono">
                    {player.address ? `${player.address.slice(0, 4)}...${player.address.slice(-4)}` : '0x...'}
                </div>
            </div>

        </motion.div>
    );
});

PlayerSpot.displayName = 'PlayerSpot';
