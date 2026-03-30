import React, { useEffect, useState } from 'react';
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

    // Delayed detective result reveal for suspense
    React.useEffect(() => {
        if (role === Role.DETECTIVE && investigationResult != null) {
            const t = setTimeout(() => setShowDetectiveResult(true), 3500);
            return () => clearTimeout(t);
        }
    }, [role, investigationResult]);

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
                ? `The family is deciding on ${targetName}... (${consensusCount}/${totalMafia})`
                : `The hit on ${targetName} is confirmed.`,
            accent: 'bg-[#8B0000]'
        },
        [Role.DOCTOR]: {
            icon: <Shield strokeWidth={1} className="w-24 h-24 md:w-32 md:h-32 text-[#0D9488]" />, // Темный хирургический тил
            title: 'STANDING WATCH',
            desc: `You are guarding ${targetName}'s door tonight.`,
            accent: 'bg-[#0D9488]'
        },
        [Role.DETECTIVE]: {
            icon: <Search strokeWidth={1} className="w-24 h-24 md:w-32 md:h-32 text-[#B45309]" />, // Ржавый янтарь (виски/лампа)
            title: investigationResult != null ? 'CASE CLOSED' : 'GATHERING INTEL',
            desc: investigationResult != null
                ? undefined
                : `The dossier on ${targetName} will be ready by dawn.`,
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

    const content = (
        // Используем fixed inset-0 z-[9000] (под заставками z-10000).
        // createPortal вытаскивает нас из контейнера GameLayout, поэтому scale не обрезает фон.
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }} // Медленное, кинематографичное затухание
            className="fixed inset-0 z-[9000] flex flex-col items-center justify-center p-4 bg-[#050505]"
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

            <div className="flex flex-col items-center text-center relative z-10 w-full max-w-lg pb-10">

                {/* Иконка медленно выплывает из темноты */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                    className="mb-8 md:mb-10"
                >
                    {config.icon}
                </motion.div>

                {/* Жесткая типографика */}
                <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 2, delay: 1.5 }}
                    className="text-2xl md:text-3xl font-['Cinzel'] font-light tracking-[0.3em] text-white/90 uppercase"
                >
                    {config.title}
                </motion.h3>

                {/* Резкая линия-разделитель (Ключевой элемент премиального дизайна) */}
                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1.5, delay: 2, ease: "circOut" }}
                    className={`w-16 h-[1px] my-6 md:my-8 ${config.accent}`}
                />

                {/* Строгий текст без лишнего форматирования / Результат расследования */}
                <AnimatePresence mode="wait">
                    {role === Role.DETECTIVE && investigationResult != null ? (
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
                                    className={`text-lg md:text-xl font-sans uppercase tracking-widest ${investigationResult === Role.MAFIA ? 'text-[#8B0000]' : 'text-[#0D9488]'}`}
                                >
                                    {targetName} IS {investigationResult === Role.MAFIA ? 'GUILTY' : 'CLEAN'}
                                </motion.span>
                            )}
                        </motion.div>
                    ) : (
                        <motion.p
                            key="desc"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 2, delay: 2.5 }}
                            className="text-white/50 text-xs md:text-sm font-sans uppercase tracking-widest max-w-[280px] leading-relaxed"
                        >
                            {config.desc}
                        </motion.p>
                    )}
                </AnimatePresence>

            </div>

            {/* Awaiting Sunrise */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, delay: 3.5 }}
                className="absolute bottom-8 md:bottom-12 flex flex-col items-center z-10"
            >
                <p className={`text-[10px] font-sans uppercase tracking-widest ${isSunRising ? 'text-[#B45309]/80 animate-pulse' : 'text-white/40'}`}>
                    {isSunRising ? 'The sun is rising...' : 'Awaiting Sunrise'}
                </p>
                {/* Minimalist timer progress line (optional visual touch) */}
                <div className="w-[100px] h-[1px] bg-white/5 mt-4 relative overflow-hidden">
                    <motion.div
                        className={`absolute top-0 bottom-0 w-1/4 ${config.accent}`}
                        animate={{ left: ["-25%", "100%"] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    />
                </div>
            </motion.div>

        </motion.div>
    );

    // Поскольку NightPhase рендерится через next/dynamic с ssr: false,
    // мы на клиенте гарантированно имеем доступ к document. 
    // Возвращаем портал сразу без задержек (useState), чтобы не было белой вспышки!
    if (typeof document === 'undefined') return content;
    return createPortal(content, document.body);
};
