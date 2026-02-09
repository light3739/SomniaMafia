import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { Activity } from 'lucide-react';

const logColorMap: Record<string, string> = {
    danger: 'text-red-400 border-l-4 border-red-600/60 pl-3 py-3 my-2 bg-red-500/5 rounded-r-lg text-sm md:text-base font-bold shadow-[0_0_20px_rgba(220,38,38,0.1)]',
    success: 'text-emerald-400 border-l-2 border-emerald-500/50 pl-2',
    phase: 'text-[#916A47] font-black border-l-4 border-[#916A47] pl-3 py-4 my-4 bg-[#916A47]/10 rounded-r-lg text-base md:text-lg tracking-wide uppercase shadow-[inset_0_0_30px_rgba(145,106,71,0.1)]',
    warning: 'text-amber-400 border-l-2 border-amber-500/40 pl-2 font-medium bg-amber-500/5 py-1 rounded-r-sm',
    info: 'text-sky-400/80 border-l-2 border-sky-500/30 pl-2',
    default: 'text-white/40 pl-2'
};

export const GameLog: React.FC = React.memo(() => {
    const { gameState } = useGameContext();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Автоскролл вниз
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [gameState.logs]);

    const getLogColor = useCallback((type: string) => logColorMap[type] || logColorMap.default, []);

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Заголовок лога */}
            <div className="flex items-center px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <span className="text-sm font-semibold text-white/40 uppercase tracking-widest">Game Feed</span>
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
});

GameLog.displayName = 'GameLog';