// components/game/GameHints.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MousePointer2, Users, Skull, Shield, Search } from 'lucide-react';
import { Role } from '../../types';

// ─── Hint Types ─────────────────────────────────────────────────
type HintType = 'discussion' | 'voting' | 'night_mafia' | 'night_doctor' | 'night_detective' | 'night_civilian';

interface HintConfig {
    title: string;
    description: string;
    icon: React.ReactNode;
    accentColor: string;
    borderColor: string;
    bgGradient: string;
    steps: string[];
}

const HINT_CONFIGS: Record<HintType, HintConfig> = {
    discussion: {
        title: 'Discussion Phase',
        description: 'Share your thoughts with other players',
        icon: <Mic className="w-5 h-5" />,
        accentColor: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        bgGradient: 'from-amber-950/80 to-amber-900/30',
        steps: [
            'When it\'s your turn, press the mic to speak',
            'Share observations and suspicions',
            'After all players speak, voting begins automatically',
        ],
    },
    voting: {
        title: 'Voting Phase',
        description: 'Vote to eliminate a suspect',
        icon: <MousePointer2 className="w-5 h-5" />,
        accentColor: 'text-orange-400',
        borderColor: 'border-orange-500/30',
        bgGradient: 'from-orange-950/80 to-orange-900/30',
        steps: [
            'Click on a player card on the game board',
            'Press the "Vote for ..." button to confirm',
            'A majority is needed to eliminate',
            'All mics are open — discuss freely!',
        ],
    },
    night_mafia: {
        title: 'Mafia Night Action',
        description: 'Coordinate with your team',
        icon: <Skull className="w-5 h-5" />,
        accentColor: 'text-rose-400',
        borderColor: 'border-rose-500/30',
        bgGradient: 'from-rose-950/80 to-rose-900/30',
        steps: [
            'Use the mafia chat to agree on a target',
            'Click a player card, then press "Kill"',
            'All mafia must agree — no consensus = no kill',
        ],
    },
    night_doctor: {
        title: 'Doctor Night Action',
        description: 'Protect a player from being killed',
        icon: <Shield className="w-5 h-5" />,
        accentColor: 'text-teal-400',
        borderColor: 'border-teal-500/30',
        bgGradient: 'from-teal-950/80 to-teal-900/30',
        steps: [
            'Click a player card to select who to protect',
            'Press "Protect ..." to confirm',
            'If you protect the mafia\'s target — they survive!',
        ],
    },
    night_detective: {
        title: 'Detective Night Action',
        description: 'Investigate a player\'s role',
        icon: <Search className="w-5 h-5" />,
        accentColor: 'text-sky-400',
        borderColor: 'border-sky-500/30',
        bgGradient: 'from-sky-950/80 to-sky-900/30',
        steps: [
            'Click a player card to investigate them',
            'You\'ll learn if they are Mafia or Innocent',
            'Use this info during next day\'s discussion!',
        ],
    },
    night_civilian: {
        title: 'Night Phase',
        description: 'Wait patiently for dawn',
        icon: <Users className="w-5 h-5" />,
        accentColor: 'text-indigo-400',
        borderColor: 'border-indigo-500/30',
        bgGradient: 'from-indigo-950/80 to-indigo-900/30',
        steps: [
            'As a civilian, you have no night actions',
            'Other players are acting in secret',
            'Dawn will come soon — stay alert!',
        ],
    },
};

// ─── Storage Keys ───────────────────────────────────────────────
const getStorageKey = (roomId: string | number) => `game_hints_shown_${roomId}`;

const getShownHints = (roomId: string | number): Set<HintType> => {
    try {
        const raw = localStorage.getItem(getStorageKey(roomId));
        if (raw) return new Set(JSON.parse(raw) as HintType[]);
    } catch { }
    return new Set();
};

const markHintShown = (roomId: string | number, hint: HintType) => {
    const shown = getShownHints(roomId);
    shown.add(hint);
    localStorage.setItem(getStorageKey(roomId), JSON.stringify([...shown]));
};

// ─── Hint Card ──────────────────────────────────────────────────
const HintCard: React.FC<{
    config: HintConfig;
    onDismiss: () => void;
}> = ({ config, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 14000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <motion.div
            initial={{ opacity: 0, x: 24, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className={`
                relative w-full md:w-[340px]
                bg-gradient-to-br ${config.bgGradient}
                backdrop-blur-2xl
                border ${config.borderColor}
                rounded-2xl shadow-2xl overflow-hidden
                pointer-events-auto
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2.5">
                    <div className={`shrink-0 ${config.accentColor}`}>
                        {config.icon}
                    </div>
                    <div>
                        <h3 className={`font-bold text-[14px] leading-tight ${config.accentColor}`}>
                            {config.title}
                        </h3>
                        <p className="text-white/35 text-[11px] leading-tight">
                            {config.description}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onDismiss}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-white/25 hover:text-white hover:bg-white/10 transition-all shrink-0 ml-1"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>

            {/* Steps */}
            <div className="px-4 pb-4 pt-1.5 space-y-2">
                {config.steps.map((step, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.08 }}
                        className="flex items-start gap-2.5"
                    >
                        <span className={`
                            flex items-center justify-center shrink-0 w-5 h-5 rounded-full text-[10px] font-bold mt-0.5
                            bg-white/5 ${config.accentColor}
                        `}>
                            {i + 1}
                        </span>
                        <p className="text-white/65 text-[12px] leading-relaxed">
                            {step}
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* Auto-dismiss progress bar */}
            <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 14, ease: 'linear' }}
                className={`h-[2px] origin-left`}
                style={{
                    background: `linear-gradient(to right, currentColor 0%, transparent 100%)`,
                }}
            />
        </motion.div>
    );
};

// ─── Connector SVG ──────────────────────────────────────────────
// Draws an elbow line from the left edge of the hint to the gamefeed label
const HintConnector: React.FC<{ color: string }> = ({ color }) => (
    <svg
        className="absolute -left-[100px] top-[26px] pointer-events-none"
        width="100"
        height="2"
        viewBox="0 0 100 2"
        fill="none"
    >
        <line
            x1="0" y1="1" x2="100" y2="1"
            stroke={color}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.5"
        />
    </svg>
);

// ─── Exported Hook ──────────────────────────────────────────────
export const useGameHints = (roomId: string | number | undefined) => {
    const [activeHint, setActiveHint] = useState<HintType | null>(null);
    const shownThisSessionRef = useRef<Set<HintType>>(new Set());

    const showHint = useCallback((hint: HintType) => {
        if (!roomId) return;
        const shown = getShownHints(roomId);
        if (shown.has(hint)) return;
        if (shownThisSessionRef.current.has(hint)) return;

        // Tiny delay so it doesn't appear at exact same frame as phase UI
        setTimeout(() => {
            setActiveHint(hint);
            shownThisSessionRef.current.add(hint);
            markHintShown(roomId, hint);
        }, 800);
    }, [roomId]);

    const dismissHint = useCallback(() => {
        setActiveHint(null);
    }, []);

    return { activeHint, showHint, dismissHint };
};

// ─── Exported Component ─────────────────────────────────────────
// Placed right of the game feed — absolute, attached via the feed container ref
export const GameHintsOverlay: React.FC<{
    activeHint: HintType | null;
    onDismiss: () => void;
    inline?: boolean;
    scale?: number;
}> = ({ activeHint, onDismiss, inline = false }) => {
    if (!activeHint) return null;
    const config = HINT_CONFIGS[activeHint];
    if (!config) return null;

    // Inline mode: used on TestPage, render relative
    if (inline) {
        return (
            <div className="relative pointer-events-none">
                <AnimatePresence mode="wait">
                    {activeHint && (
                        <HintCard key={activeHint} config={config} onDismiss={onDismiss} />
                    )}
                </AnimatePresence>
            </div>
        );
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

    // Mobile/Tablet mode within the scaled container (1488x1024)
    if (isMobile) {
        return (
            <div className="absolute z-[150] pointer-events-none flex justify-center w-full" style={{ bottom: '12%', left: 0 }}>
                <AnimatePresence mode="wait">
                    {activeHint && (
                        <div key={activeHint} className="w-full max-w-[420px] px-4 flex justify-center mx-auto">
                            <HintCard config={config} onDismiss={onDismiss} />
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Desktop: absolute right of the 600px center panel
    // Center is at X=744. Right edge of 600px panel is 744 + 300 = 1044. Add 16px gap = 1060px.
    return (
        <div
            className="absolute z-[150] pointer-events-none"
            style={{
                left: '1060px',
                top: '50%',
                transform: 'translateY(-180px)',
            }}
        >
            <AnimatePresence mode="wait">
                {activeHint && (
                    <div key={activeHint} className="relative">
                        <HintConnector color={
                            activeHint === 'discussion' ? '#f59e0b' :
                                activeHint === 'voting' ? '#f97316' :
                                    activeHint === 'night_mafia' ? '#f43f5e' :
                                        activeHint === 'night_doctor' ? '#14b8a6' :
                                            activeHint === 'night_detective' ? '#0ea5e9' :
                                                '#6366f1'
                        } />
                        <HintCard config={config} onDismiss={onDismiss} />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
