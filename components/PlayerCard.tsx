import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { User, Shield, Crosshair, Eye, Skull, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Player, Role, cardVariants } from '../types';

interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  onAction: (playerId: `0x${string}`) => void;
  canAct: boolean;
  actionLabel: string;
  isSpeaking?: boolean;
  speechTimeRemaining?: number;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ 
  player, isMe, onAction, canAct, actionLabel, 
  isSpeaking = false, speechTimeRemaining = 0 
}) => {

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case Role.MAFIA: return <Crosshair className="w-4 h-4 text-rose-500" />;
      case Role.DOCTOR: return <Shield className="w-4 h-4 text-teal-500" />;
      case Role.DETECTIVE: return <Eye className="w-4 h-4 text-sky-500" />;
      default: return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusIndicator = () => {
    if (!player.isAlive) return null; // Skull handles death
    switch (player.status) {
      case 'connected':
        return <div className="flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20"><Wifi className="w-3 h-3" /> <span className="hidden md:inline">SYNC</span></div>;
      case 'syncing':
        return <div className="flex items-center gap-1 text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20"><Wifi className="w-3 h-3 animate-pulse" /> SYNCING</div>;
      case 'offline':
        return <div className="flex items-center gap-1 text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20"><WifiOff className="w-3 h-3" /> LOST</div>;
      case 'slashed':
        return <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/40"><AlertTriangle className="w-3 h-3" /> SLASHED</div>;
    }
  };

  return (
    <motion.div
      variants={cardVariants}
      className={`relative group ${!player.isAlive || player.status === 'slashed' ? 'opacity-50 grayscale' : ''}`}
    >
      {/* Selection Ring - blood-red noir gradient */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-red-950 via-red-900 to-red-950 rounded-xl blur opacity-0 group-hover:opacity-60 transition duration-500 ${isMe ? 'opacity-30' : ''}`}></div>

      {/* Speaking Glow (Aura) */}
      <AnimatePresence>
        {isSpeaking && speechTimeRemaining > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              boxShadow: [
                '0 0 0px rgba(145, 106, 71, 0)',
                '0 0 20px rgba(145, 106, 71, 0.4)',
                '0 0 0px rgba(145, 106, 71, 0)'
              ]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -inset-1 rounded-xl pointer-events-none z-0 border border-[#916A47]/30"
          />
        )}
      </AnimatePresence>

      <div className="relative bg-[#1a1a1a] border border-white/5 rounded-xl p-4 flex flex-col items-center gap-3 shadow-lg overflow-hidden min-h-[160px]">

        {/* Status Badge */}
        {!player.isAlive && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-[1px]">
            <Skull className="w-12 h-12 text-red-600/80" />
          </div>
        )}

        {/* Header: Status */}
        <div className="w-full flex justify-end">
          {getStatusIndicator()}
        </div>

        {/* Avatar */}
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 relative z-10">
          <Image
            src={player.avatarUrl || 'https://placehold.co/80x80'}
            alt={player.name}
            width={64}
            height={64}
            className="w-full h-full object-cover"
            unoptimized
          />
        </div>

        {/* Info */}
        <div className="text-center z-10 w-full">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h3 className="font-bold text-white text-sm truncate">{player.name}</h3>
            {isMe && <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">YOU</span>}
          </div>
          <div className="text-xs text-gray-500 font-mono truncate px-2">
            {player.address.slice(0, 6)}...{player.address.slice(-4)}
          </div>
        </div>

        {/* Revealed Role */}
        {(isMe || !player.isAlive) && (
          <div className="mt-1 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/5">
            {getRoleIcon(player.role)}
            <span className="text-[10px] font-bold tracking-wider text-gray-300">{player.role}</span>
          </div>
        )}

        {/* Action Button */}
        {canAct && player.isAlive && !isMe && player.status !== 'slashed' && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAction(player.address)}
            className="mt-2 w-full py-1.5 px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded border border-white/10 transition-colors uppercase tracking-widest z-20"
          >
            {actionLabel}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};