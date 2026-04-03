import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Role } from '../../types';
import { Skull, Shield, Search, Moon, CheckCircle2 } from 'lucide-react';

interface CinematicFeedbackProps {
    role: Role;
    targetName?: string;
    investigationResult?: Role | null;
    timeLeft?: number | null;
    isWaitingConsensus?: boolean;
    consensusCount?: number;
    totalMafia?: number;
}

export const CinematicNightFeedback: React.FC<CinematicFeedbackProps> = ({
    role,
    targetName = 'someone',
    investigationResult,
    timeLeft,
    isWaitingConsensus = false,
    consensusCount = 1,
    totalMafia = 1,
}) => {
    const [showDetectiveResult, setShowDetectiveResult] = React.useState(false);

    // Freeze targetName and investigationResult on first valid value.
    // When night resolves (NightFinalized → fetchGameData), gameState.players
    // updates and committedTargetName can momentarily revert to "someone"
    // because the player lookup runs against updated state.
    // These refs preserve the values shown to the user.
    const frozenTargetRef = useRef<string>(targetName);
    const frozenResultRef = useRef<Role | null | undefined>(investigationResult);

    if (targetName && targetName !== 'someone') {
        frozenTargetRef.current = targetName;
    }
    if (investigationResult != null) {
        frozenResultRef.current = investigationResult;
    }

    // Use frozen values for display
    const displayTarget = frozenTargetRef.current;
    const displayResult = frozenResultRef.current;

    // Track if this is a remount (from state sync flickering)
    // so we skip the slow entrance animations and show content immediately
    const isRemountRef = useRef(false);
    const [skipAnim, setSkipAnim] = useState(false);

    useEffect(() => {
        const CINEMATIC_KEY = 'mafia_cinematic_shown';
        const wasShown = sessionStorage.getItem(CINEMATIC_KEY);
        if (wasShown) {
            // Component remounted — skip entrance animations
            isRemountRef.current = true;
            setSkipAnim(true);
        } else {
            // First mount this night — play animations normally
            sessionStorage.setItem(CINEMATIC_KEY, '1');
        }
        return () => {
            // Don't clear on unmount — keep flag alive for remount detection
            // It will be cleared when night phase ends (via NightPhase cleanup)
        };
    }, []);

    // Delayed detective result reveal for suspense
    React.useEffect(() => {
        if (role === Role.DETECTIVE && displayResult != null) {
            const t = setTimeout(() => setShowDetectiveResult(true), skipAnim ? 500 : 3500);
            return () => clearTimeout(t);
        }
    }, [role, displayResult, skipAnim]);

    // АБСОЛЮТНО ПЛОСКИЙ И ЖЕСТКИЙ ДИЗАЙН (Minimalist Brutalism / Noir)
    const configs: Record<string, {
        icon: React.ReactNode;
        title: string;
        desc: string | undefined;
        accent: string;
    }> = {
        [Role.MAFIA]: {
            icon: <Skull strokeWidth={1} className="w-24 h-24 md:w-32 md:h-32 text-[#8B0000]" />, // Цвет засохшей крови
            title: isWaitingConsensus ? 'AWAITING ORDERS' : 'CONTRACT SEALED',
            desc: isWaitingConsensus
                ? `The family is deciding on ${displayTarget}... (${consensusCount}/${totalMafia})`
                : `The hit on ${displayTarget} is confirmed.`,
            accent: 'bg-[#8B0000]'
        },
        [Role.DOCTOR]: {
            icon: <Shield strokeWidth={1} className="w-24 h-24 md:w-32 md:h-32 text-[#0D9488]" />, // Темный хирургический тил
            title: 'STANDING WATCH',
            desc: `You are guarding ${displayTarget}'s door tonight.`,
            accent: 'bg-[#0D9488]'
        },
        [Role.DETECTIVE]: {
            icon: <Search strokeWidth={1} className="w-24 h-24 md:w-32 md:h-32 text-[#B45309]" />, // Ржавый янтарь (виски/лампа)
            title: displayResult != null ? 'CASE CLOSED' : 'GATHERING INTEL',
            desc: displayResult != null
                ? undefined
                : `The dossier on ${displayTarget} will be ready by dawn.`,
            accent: 'bg-[#B45309]'
        },
        [Role.CIVILIAN]: {
            icon: <Moon strokeWidth={1} className="w-24 h-24 md:w-32 md:h-32 text-[#6B5A4A]" />,
            title: 'DEEP SLEEP',
            desc: `Every sound in the dark makes your heart race. Pray for sunrise.`,
            accent: 'bg-[#6B5A4A]'
        },
    };

    // Civilian window-light shimmer
    const civilianShimmerLines = [
        { top: '22%', width: '55%', opacity: 0.06, duration: 9, delay: 0 },
        { top: '38%', width: '70%', opacity: 0.04, duration: 13, delay: 2.5 },
        { top: '55%', width: '45%', opacity: 0.07, duration: 11, delay: 1 },
        { top: '70%', width: '60%', opacity: 0.05, duration: 15, delay: 4 },
    ];


    const fallbackConfig = {
        icon: <CheckCircle2 strokeWidth={1} className="w-24 h-24 md:w-32 md:h-32 text-gray-700" />,
        title: 'ACTION CONFIRMED',
        desc: 'Waiting for the night to end...',
        accent: 'bg-gray-700'
    };

    const config = configs[role] || fallbackConfig;
    const isSunRising = timeLeft !== null && timeLeft !== undefined && timeLeft <= 0;

    // Animation durations — skip slow animations on remount
    const fadeIn = skipAnim ? 0.1 : 1.5;
    const iconDelay = skipAnim ? 0 : 0.5;
    const titleDelay = skipAnim ? 0 : 1.5;
    const lineDelay = skipAnim ? 0 : 2;
    const descDelay = skipAnim ? 0 : 2.5;
    const footerDelay = skipAnim ? 0 : 3.5;

    const content = (
        // Используем fixed inset-0 z-[9000] (под заставками z-10000).
        // createPortal вытаскивает нас из контейнера GameLayout, поэтому scale не обрезает фон.
        <motion.div
            initial={{ opacity: skipAnim ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: fadeIn, ease: "easeOut" }}
            className="fixed inset-0 z-[9000] flex flex-col items-center bg-[#050505] overflow-hidden custom-scrollbar"
        >
            {/* ОЧЕНЬ тусклый, едва заметный радиальный свет — breathing pulse */}
            <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            >
                <div className={`w-[250px] h-[250px] md:w-[350px] md:h-[350px] rounded-full blur-[100px] ${config.accent.replace('bg-', 'bg-')}`} />
            </motion.div>

            {/* Ambient floating dust particles — cinematic depth */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Civilian window-light shimmer overlay */}
                {role === Role.CIVILIAN && civilianShimmerLines.map((line, i) => (
                    <motion.div
                        key={`shimmer-${i}`}
                        className="absolute h-[1px] left-0"
                        style={{
                            top: line.top,
                            width: line.width,
                            background: 'linear-gradient(90deg, transparent 0%, rgba(200,200,255,0.8) 40%, rgba(200,200,255,0.8) 60%, transparent 100%)',
                            filter: 'blur(3px)',
                        }}
                        animate={{ opacity: [0, line.opacity, line.opacity * 1.5, line.opacity, 0], x: [-20, 40] }}
                        transition={{ duration: line.duration, repeat: Infinity, ease: 'easeInOut', delay: line.delay }}
                    />
                ))}
                {[
                    { top: '20%', left: '15%', size: 3, dx: 20, dy: -15, dur: 9, delay: 0 },
                    { top: '70%', left: '80%', size: 2.5, dx: -15, dy: 20, dur: 11, delay: 1 },
                    { top: '40%', left: '60%', size: 4, dx: 12, dy: -25, dur: 13, delay: 2 },
                    { top: '55%', left: '25%', size: 2, dx: -18, dy: 15, dur: 10, delay: 3 },
                    { top: '30%', left: '75%', size: 4.5, dx: 10, dy: -10, dur: 14, delay: 1.5 },
                    { top: '80%', left: '40%', size: 3, dx: -8, dy: -18, dur: 12, delay: 4 },
                    { top: '15%', left: '50%', size: 3.5, dx: -10, dy: 22, dur: 10.5, delay: 2.5 },
                    { top: '85%', left: '15%', size: 4, dx: 15, dy: -12, dur: 12.5, delay: 0.5 },
                ].map((p, i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full bg-white"
                        style={{
                            top: p.top,
                            left: p.left,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            boxShadow: '0 0 6px 1px rgba(255, 255, 255, 0.3)',
                        }}
                        animate={{
                            x: [0, p.dx, 0],
                            y: [0, p.dy, 0],
                            opacity: [0.1, 0.5, 0.1],
                        }}
                        transition={{
                            duration: p.dur,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: p.delay,
                        }}
                    />
                ))}
            </div>

            <div className="flex-1 w-full min-h-[40px]" />

            <div className="flex flex-col items-center text-center relative z-10 w-full max-w-lg shrink-0 px-4">

                {/* Иконка медленно выплывает из темноты */}
                <motion.div
                    initial={{ opacity: skipAnim ? 1 : 0, y: skipAnim ? 0 : 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: skipAnim ? 0.1 : 2, ease: "easeOut", delay: iconDelay }}
                    className="mb-8 md:mb-10"
                >
                    {config.icon}
                </motion.div>

                {/* Жесткая типографика */}
                <motion.h3
                    initial={{ opacity: skipAnim ? 1 : 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: skipAnim ? 0.1 : 2, delay: titleDelay }}
                    className="text-2xl md:text-3xl font-['Cinzel'] font-light tracking-[0.3em] text-white/90 uppercase"
                >
                    {config.title}
                </motion.h3>

                {/* Резкая линия-разделитель (Ключевой элемент премиального дизайна) */}
                <motion.div
                    initial={{ scaleX: skipAnim ? 1 : 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: skipAnim ? 0.1 : 1.5, delay: lineDelay, ease: "circOut" }}
                    className={`w-16 h-[1px] my-6 md:my-8 ${config.accent}`}
                />

                {/* Строгий текст без лишнего форматирования / Результат расследования */}
                <AnimatePresence mode="wait">
                    {role === Role.DETECTIVE && displayResult != null ? (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: showDetectiveResult ? 1 : 0 }}
                            transition={{ duration: 1.5 }}
                            className="flex flex-col items-center"
                        >
                            <span className="text-white/50 text-[10px] md:text-xs font-sans uppercase tracking-widest mb-4">
                                {showDetectiveResult ? 'Result' : 'Decrypting dossier...'}
                            </span>
                            {showDetectiveResult && (
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.8 }}
                                    className={`text-lg md:text-xl font-sans uppercase tracking-widest ${displayResult === Role.MAFIA ? 'text-[#8B0000]' : 'text-[#0D9488]'}`}
                                >
                                    {displayTarget} IS {displayResult === Role.MAFIA ? 'GUILTY' : 'CLEAN'}
                                </motion.span>
                            )}
                        </motion.div>
                    ) : (
                        <motion.p
                            key="desc"
                            initial={{ opacity: skipAnim ? 1 : 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: skipAnim ? 0.1 : 2, delay: descDelay }}
                            className="text-white/50 text-xs md:text-sm font-sans uppercase tracking-widest max-w-[280px] leading-relaxed"
                        >
                            {config.desc}
                        </motion.p>
                    )}
                </AnimatePresence>

            </div>

            <div className="flex-1 w-full flex flex-col items-center justify-end pb-8 md:pb-12 z-10 min-h-[60px] shrink-0">
                {/* Awaiting Sunrise */}
                <motion.div
                    initial={{ opacity: skipAnim ? 1 : 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: skipAnim ? 0.1 : 2, delay: footerDelay }}
                    className="flex flex-col items-center"
                >
                    <div className="flex flex-col items-center group cursor-pointer" onClick={() => (window as any).refreshGame && (window as any).refreshGame()}>
                        <p className={`text-[10px] font-sans uppercase tracking-[0.3em] mb-2 transition-all duration-500 ${isSunRising ? 'text-amber-500/80 animate-pulse' : 'text-white/40 group-hover:text-white/70'}`}>
                            {isSunRising ? 'Daylight is breaking...' : 'Waiting for the Dawn'}
                        </p>
                        
                        {/* Minimalist timer progress line */}
                        <div className="w-[120px] h-[1px] bg-white/5 relative overflow-hidden">
                            <motion.div
                                className={`absolute top-0 bottom-0 w-1/3 ${config.accent}`}
                                animate={{ left: ["-33%", "100%"] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            />
                        </div>
                    </div>
                </motion.div>
            </div>

        </motion.div>
    );

    // Поскольку NightPhase рендерится через next/dynamic с ssr: false,
    // мы на клиенте гарантированно имеем доступ к document. 
    // Возвращаем портал сразу без задержек (useState), чтобы не было белой вспышки!
    if (typeof document === 'undefined') return content;
    return createPortal(content, document.body);
};
