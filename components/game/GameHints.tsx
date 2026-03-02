// components/game/GameHints.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MousePointer2, Users, Skull, Shield, Search, Target, MessageCircle } from 'lucide-react';
import { Role } from '../../types';

// ─── Hint Types ─────────────────────────────────────────────────
type HintType = 'discussion' | 'voting' | 'night_mafia' | 'night_doctor' | 'night_detective' | 'night_civilian';

interface HintConfig {
    title: string;
    description: string;
    icon: React.ReactNode;
    accentColor: string;       // e.g. "amber", "rose", "teal"
    borderColor: string;
    bgGradient: string;
    steps: string[];
}

const HINT_CONFIGS: Record<HintType, HintConfig> = {
    discussion: {
        title: 'Discussion Phase',
        description: 'Share your thoughts with other players',
        icon: <Mic className="w-6 h-6" />,
        accentColor: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        bgGradient: 'from-amber-950/60 to-amber-900/20',
        steps: [
            'When it\'s your turn, press the microphone button to speak',
            'Share observations and suspicions with the town',
            'You have limited time - use it wisely!',
            'After all players speak, voting begins automatically',
        ],
    },
    voting: {
        title: 'Voting Phase',
        description: 'Vote to eliminate a suspect',
        icon: <MousePointer2 className="w-6 h-6" />,
        accentColor: 'text-orange-400',
        borderColor: 'border-orange-500/30',
        bgGradient: 'from-orange-950/60 to-orange-900/20',
        steps: [
            'Click on a player card on the game board',
            'Press the "Vote for ..." button to confirm',
            'A majority is needed to eliminate a player',
            'All mics are open - discuss freely while voting!',
        ],
    },
    night_mafia: {
        title: 'Mafia Night Action',
        description: 'Coordinate with your team to eliminate a target',
        icon: <Skull className="w-6 h-6" />,
        accentColor: 'text-rose-400',
        borderColor: 'border-rose-500/30',
        bgGradient: 'from-rose-950/60 to-rose-900/20',
        steps: [
            'Use the mafia chat to discuss targets with allies',
            'Click on a player card to select your victim',
            'Press the "Kill ..." button to confirm your choice',
            'All mafia must choose the SAME target (consensus)',
            'If there\'s no consensus, no one is killed!',
        ],
    },
    night_doctor: {
        title: 'Doctor Night Action',
        description: 'Protect a player from being killed tonight',
        icon: <Shield className="w-6 h-6" />,
        accentColor: 'text-teal-400',
        borderColor: 'border-teal-500/30',
        bgGradient: 'from-teal-950/60 to-teal-900/20',
        steps: [
            'Click on a player card to select who to protect',
            'Press "Protect ..." to confirm your choice',
            'If you protect the mafia\'s target, they survive!',
        ],
    },
    night_detective: {
        title: 'Detective Night Action',
        description: 'Investigate a player to learn their role',
        icon: <Search className="w-6 h-6" />,
        accentColor: 'text-sky-400',
        borderColor: 'border-sky-500/30',
        bgGradient: 'from-sky-950/60 to-sky-900/20',
        steps: [
            'Click on a player card to investigate them',
            'Press "Investigate ..." to confirm',
            'You\'ll learn if they are Mafia or Innocent',
            'Use this info during next day\'s discussion!',
        ],
    },
    night_civilian: {
        title: 'Night Phase',
        description: 'Wait patiently for dawn',
        icon: <Users className="w-6 h-6" />,
        accentColor: 'text-indigo-400',
        borderColor: 'border-indigo-500/30',
        bgGradient: 'from-indigo-950/60 to-indigo-900/20',
        steps: [
            'As a civilian, you have no night actions',
            'Other players are acting in secret right now',
            'Dawn will come soon - stay alert!',
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

// ─── Single Hint Popup ─────────────────────────────────────────
const HintPopup: React.FC<{
    config: HintConfig;
    onDismiss: () => void;
}> = ({ config, onDismiss }) => {
    // Auto-dismiss after 12 seconds
    useEffect(() => {
        const timer = setTimeout(onDismiss, 12000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className={`
                relative max-w-sm w-full 
                bg-gradient-to-br ${config.bgGradient}
                backdrop-blur-2xl
                border ${config.borderColor}
                rounded-2xl shadow-2xl overflow-hidden
                pointer-events-auto
            `}
        >
            {/* Glow effect */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at 30% 0%, currentColor 0%, transparent 70%)`,
                }}
            />

            {/* Header */}
            <div className="relative flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-black/30 ${config.accentColor}`}>
                        {config.icon}
                    </div>
                    <div>
                        <h3 className={`font-bold text-sm ${config.accentColor}`}>
                            {config.title}
                        </h3>
                        <p className="text-white/40 text-[10px] leading-tight">
                            {config.description}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onDismiss}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-white/30 hover:text-white hover:bg-white/10 transition-all shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Steps */}
            <div className="px-4 pb-4 pt-1">
                <div className="space-y-2">
                    {config.steps.map((step, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + i * 0.1 }}
                            className="flex items-start gap-2.5"
                        >
                            <span className={`
                                flex items-center justify-center shrink-0 w-5 h-5 rounded-full text-[10px] font-bold mt-0.5
                                bg-white/5 ${config.accentColor}
                            `}>
                                {i + 1}
                            </span>
                            <p className="text-white/70 text-xs leading-relaxed">
                                {step}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Progress bar (auto-dismiss indicator) */}
            <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 12, ease: "linear" }}
                className={`h-0.5 origin-left`}
                style={{
                    background: `linear-gradient(to right, currentColor, transparent)`,
                }}
            />
        </motion.div>
    );
};

// ─── Exported Hook ──────────────────────────────────────────────
export const useGameHints = (roomId: string | number | undefined) => {
    const [activeHint, setActiveHint] = useState<HintType | null>(null);
    const shownThisSessionRef = useRef<Set<HintType>>(new Set());
    const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Show a hint only if it hasn't been shown in this game session
    const showHint = useCallback((hint: HintType) => {
        if (!roomId) return;
        const shown = getShownHints(roomId);
        if (shown.has(hint)) return; // Already shown this game
        if (shownThisSessionRef.current.has(hint)) return; // Already queued/shown this mount

        // Small delay so it doesn't arrive at exact same time as phase transition animation
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);

        setTimeout(() => {
            setActiveHint(hint);
            shownThisSessionRef.current.add(hint);
            markHintShown(roomId, hint);
        }, 1500);
    }, [roomId]);

    const dismissHint = useCallback(() => {
        setActiveHint(null);
    }, []);

    return { activeHint, showHint, dismissHint };
};

// ─── Exported Component ─────────────────────────────────────────
export const GameHintsOverlay: React.FC<{
    activeHint: HintType | null;
    onDismiss: () => void;
    inline?: boolean; // When true, render inline instead of fixed (for test page)
}> = ({ activeHint, onDismiss, inline = false }) => {
    if (!activeHint) return null;
    const config = HINT_CONFIGS[activeHint];
    if (!config) return null;

    return (
        <div className={inline ? "relative pointer-events-none" : "fixed bottom-6 left-6 z-[150] pointer-events-none"}>
            <AnimatePresence mode="wait">
                {activeHint && (
                    <HintPopup
                        key={activeHint}
                        config={config}
                        onDismiss={onDismiss}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
