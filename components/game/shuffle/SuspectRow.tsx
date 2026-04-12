import React from 'react';
import { motion } from 'framer-motion';

interface SuspectRowProps {
    player: {
        address: string;
        name: string;
        hasConfirmedRole: boolean;
    };
    index: number;
    isReveal: boolean;
    isMe: boolean;
    shuffleState: {
        currentShufflerIndex: number;
        hasRevealed: boolean;
    };
}

export const SuspectRow: React.FC<SuspectRowProps> = ({ player, index, isReveal, isMe, shuffleState }) => {
    if (isReveal) {
        const hasConfirmed = player.hasConfirmedRole;
        return (
            <div
                className={`flex items-center justify-between px-4 py-2.5 border-b border-white/10 transition-all hover:bg-white/[0.03] ${
                    hasConfirmed ? 'bg-[#C49A3C]/[0.06]' : isMe ? 'bg-[#C49A3C]/[0.03]' : ''
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasConfirmed ? 'bg-[#C49A3C]' : 'bg-white/15'}`} />
                    <span className={`font-mono text-[13px] tracking-wide truncate ${isMe ? 'text-[#E0B964]' : hasConfirmed ? 'text-white/80' : 'text-white/60'}`}>
                        {player.name}{isMe ? ' (YOU)' : ''}
                    </span>
                </div>
                <div className={`text-[9px] tracking-[0.2em] font-mono px-1.5 py-0.5 rounded-sm border ${
                    hasConfirmed
                        ? 'border-[#4a8a5a]/30 text-[#4a8a5a] bg-[#4a8a5a]/[0.05]'
                        : 'border-white/10 text-white/50'
                }`}>
                    CONF
                </div>
            </div>
        );
    }

    const isDone = index < shuffleState.currentShufflerIndex || (isMe && shuffleState.hasRevealed);
    const isActive = index === shuffleState.currentShufflerIndex && !isDone;
    return (
        <motion.div
            layout
            className={`flex items-center justify-between px-4 py-2.5 border-b border-white/10 transition-all hover:bg-white/[0.03] ${
                isActive ? 'bg-[#C49A3C]/[0.10]' : isDone ? 'bg-[#C49A3C]/[0.05]' : ''
            }`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive || isDone ? 'bg-[#C49A3C]' : 'bg-white/15'}`} />
                <span className={`font-mono text-[13px] tracking-wide truncate ${
                    isMe ? 'text-[#E0B964]' :
                    isDone ? 'text-white/80' :
                    isActive ? 'text-white/90' :
                    'text-white/60'
                }`}>
                    {player.name}{isMe ? ' (YOU)' : ''}
                </span>
            </div>
            <div className={`text-[9px] tracking-[0.2em] font-mono px-1.5 py-0.5 rounded-sm border ${
                isDone
                    ? 'border-[#C49A3C]/30 text-[#C49A3C] bg-[#C49A3C]/[0.05]'
                    : isActive
                        ? 'border-[#C49A3C]/60 text-[#C49A3C] bg-[#C49A3C]/[0.1] shadow-[0_0_5px_rgba(196,154,60,0.25)]'
                        : 'border-white/10 text-white/50'
            }`}>
                {isDone ? 'DONE' : isActive ? 'ACTIVE' : 'WAIT'}
            </div>
        </motion.div>
    );
};
