import React from 'react';
import { motion } from 'framer-motion';
import { Player, Role } from '../../types';
import { Shield, Crosshair, Eye, Skull } from 'lucide-react';

interface PlayerSpotProps {
    player: Player;
    onClick: () => void;
    isMe: boolean;
    canAct: boolean;
}

export const PlayerSpot: React.FC<PlayerSpotProps> = ({ player, onClick, isMe, canAct }) => {
    
    // Иконка роли (видна только мне или если игрок мертв/раскрыт)
    const getRoleIcon = () => {
        if (!isMe && player.isAlive && player.role === Role.UNKNOWN) return null;
        
        // В реальной игре роль других видна только после смерти или в конце
        // Для демо показываем свою роль
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
            onClick={() => (player.isAlive && canAct ? onClick() : null)}
            className={`
                relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-300
                ${canAct && player.isAlive ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}
                ${isMe ? 'bg-[#916A47]/10 border border-[#916A47]/50' : 'bg-[#19130D]/60 border border-white/5'}
            `}
        >
            {/* Аватар */}
            <div className="relative">
                <div className={`
                    w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 
                    ${isMe ? 'border-[#916A47] shadow-[0_0_15px_rgba(145,106,71,0.3)]' : 'border-white/10'}
                    ${!player.isAlive ? 'grayscale opacity-50' : ''}
                `}>
                    <img src={player.avatarUrl} alt={player.name} className="w-full h-full object-cover" />
                </div>
                
                {/* Бейдж смерти */}
                {!player.isAlive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                        <Skull className="w-8 h-8 text-white/80" />
                    </div>
                )}

                {/* Индикатор статуса (онлайн/оффлайн) */}
                {player.isAlive && (
                    <div className={`
                        absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#19130D]
                        ${player.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}
                    `} />
                )}
            </div>

            {/* Инфо */}
            <div className="text-center w-full">
                <div className="flex items-center justify-center gap-1">
                    <span className={`text-xs md:text-sm font-bold truncate max-w-[100px] ${isMe ? 'text-[#916A47]' : 'text-white/90'}`}>
                        {player.name}
                    </span>
                    {getRoleIcon()}
                </div>
                <div className="text-[10px] text-white/30 font-mono">
                    {player.address.slice(0, 4)}...{player.address.slice(-4)}
                </div>
            </div>
            
            {/* Метка "ВЫ" */}
            {isMe && (
                <div className="absolute -top-2 px-2 py-0.5 bg-[#916A47] text-black text-[8px] font-bold uppercase tracking-wider rounded-full">
                    YOU
                </div>
            )}
        </motion.div>
    );
};