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
                className={`flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] transition-all hover:bg-white/[0.02] ${
                    hasConfirmed ? 'bg-[#c8a84b]/[0.05]' : isMe ? 'bg-[#c8a84b]/[0.03]' : ''
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasConfirmed ? 'bg-[#c8a84b]' : 'bg-[#3a3838]'}`} />
                    <span className={`font-mono text-[13px] tracking-wide truncate ${isMe ? 'text-[#e8c86a]' : hasConfirmed ? 'text-white/80' : 'text-white/40'}`}>
                        {player.name}{isMe ? ' (YOU)' : ''}
                    </span>
                </div>
                <div className={`text-[9px] tracking-[0.2em] font-mono px-1.5 py-0.5 rounded-[1px] border ${
                    hasConfirmed 
                        ? 'border-[#4a8a5a]/30 text-[#4a8a5a] bg-[#4a8a5a]/[0.05]' 
                        : 'border-white/10 text-white/20'
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
            className={`flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] transition-all hover:bg-white/[0.02] ${
                isActive ? 'bg-[#c8a84b]/[0.08]' : isDone ? 'bg-[#c8a84b]/[0.04]' : ''
            }`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive || isDone ? 'bg-[#c8a84b]' : 'bg-[#3a3838]'}`} />
                <span className={`font-mono text-[13px] tracking-wide truncate ${
                    isMe ? 'text-[#e8c86a]' :
                    isDone ? 'text-white/80' :
                    isActive ? 'text-white/90' :
                    'text-white/40'
                }`}>
                    {player.name}{isMe ? ' (YOU)' : ''}
                </span>
            </div>
            <div className={`text-[9px] tracking-[0.2em] font-mono px-1.5 py-0.5 rounded-[1px] border ${
                isDone 
                    ? 'border-[#c8a84b]/30 text-[#c8a84b] bg-[#c8a84b]/[0.05]' 
                    : isActive 
                        ? 'border-[#c8a84b]/60 text-[#c8a84b] bg-[#c8a84b]/[0.1] shadow-[0_0_5px_rgba(200,168,75,0.2)]'
                        : 'border-white/10 text-white/10'
            }`}>
                {isDone ? 'DONE' : isActive ? 'ACTIVE' : 'WAIT'}
            </div>
        </motion.div>
    );
};
