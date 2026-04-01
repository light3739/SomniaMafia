import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../ui/Button';
import { TypewriterText } from './TypewriterText';

interface ShufflePanelProps {
    shuffleState: {
        currentShufflerIndex: number;
        deck: string[];
        isMyTurn: boolean;
        hasCommitted: boolean;
        hasRevealed: boolean;
        isFailed: boolean;
        phaseDeadline: number;
    };
    progress: number;
    isProcessing: boolean;
    isTxPending: boolean;
    currentShufflerName?: string;
    totalPlayers: number;
    onRetry: () => void;
}

export const ShufflePanel: React.FC<ShufflePanelProps> = ({
    shuffleState, progress, isProcessing, isTxPending, currentShufflerName, totalPlayers, onRetry
}) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-12">
            {/* Status Section */}
            <div className="text-center">
                <p className="font-mono text-[10px] tracking-[0.35em] text-white/35 uppercase mb-3.5">&gt; STATUS</p>
                <div className="flex items-center justify-center gap-1.5">
                    <p className={`font-mono text-[16px] tracking-widest uppercase leading-tight ${
                        shuffleState.isFailed ? 'text-[#8B0000]' :
                        'text-white/85'
                    }`}>
                        {(() => {
                            if (shuffleState.isFailed) return <TypewriterText text="TX_FAILED_PRESS_RETRY" />;

                            const name = currentShufflerName?.toUpperCase() || 'PLAYER';
                            return (
                                <>
                                    <span className="opacity-40">PENDING // </span>
                                    <TypewriterText text={name} />
                                </>
                            );
                        })()}
                    </p>
                    {!shuffleState.isFailed && (
                        <motion.div
                            className="w-2 h-4 bg-[#c8a84b]"
                            animate={{ opacity: [1, 1, 0, 0, 1] }}
                            transition={{ 
                                duration: 1, 
                                repeat: Infinity, 
                                times: [0, 0.5, 0.51, 0.99, 1],
                                ease: "linear"
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Hero Progress — Enlarged Cards */}
            <div className="w-full">
                <div className="flex gap-3 justify-center">
                    {[...Array(totalPlayers)].map((_, i) => {
                        const isDone = i < shuffleState.currentShufflerIndex;
                        const isActive = i === shuffleState.currentShufflerIndex && !shuffleState.isFailed;
                        return (
                            <div
                                key={i}
                                className={`w-8 h-11 border text-[12px] flex items-center justify-center rounded-[2px] transition-all duration-500 overflow-hidden relative ${
                                    isDone 
                                        ? 'border-[#c8a84b] text-[#c8a84b] bg-[#c8a84b]/20 shadow-[0_0_12px_rgba(200,168,75,0.25)]'
                                        : isActive
                                            ? 'border-[#c8a84b] text-[#c8a84b] bg-[#c8a84b]/5 animate-pulse'
                                            : 'border-white/10 text-white/10 bg-[#13120f]/50'
                                }`}
                            >
                                {(isDone || isActive) && <div className={`absolute top-0 left-0 right-0 h-[3px] bg-[#c8a84b] ${isActive ? 'animate-pulse' : ''}`} />}
                                <span className="font-mono">?</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {shuffleState.isFailed && shuffleState.isMyTurn && (
                <Button
                    variant="ghost"
                    className="text-[10px] font-mono tracking-[0.3em] h-10 px-8 border-[#8B0000]/40 text-[#8B0000] hover:bg-[#8B0000]/10 uppercase rounded-sm"
                    onClick={onRetry}
                >
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    RETRY OPERATION
                </Button>
            )}
        </div>
    );
};
