import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { Activity } from 'lucide-react';

export const GameLog: React.FC = () => {
    const { gameState } = useGameContext();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Автоскролл вниз
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [gameState.logs]);

    const getLogColor = (type: string) => {
        switch (type) {
            case 'danger': return 'text-red-400 border-l-2 border-red-500/50 pl-2';
            case 'success': return 'text-green-400 border-l-2 border-green-500/50 pl-2';
            case 'phase': return 'text-[#916A47] font-bold border-l-2 border-[#916A47] pl-2 py-2 my-1 bg-[#916A47]/10';
            case 'warning': return 'text-amber-400';
            default: return 'text-white/60';
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Заголовок лога */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#916A47]" />
                    <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Game Feed</span>
                </div>
                <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500/20" />
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500/20" />
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500/20" />
                </div>
            </div>

            {/* Контент */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs md:text-sm custom-scrollbar"
            >
                <AnimatePresence initial={false}>
                    {gameState.logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`${getLogColor(log.type)} transition-colors`}
                        >
                            <span className="opacity-30 mr-2">[{log.timestamp}]</span>
                            <span>{log.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {gameState.logs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 italic">
                        <span>Waiting for events...</span>
                    </div>
                )}
            </div>
        </div>
    );
};