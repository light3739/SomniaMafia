"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface JoinByIdModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (id: string) => Promise<void> | void;
    isLoading?: boolean;
}

export const JoinByIdModal: React.FC<JoinByIdModalProps> = ({
    open,
    onClose,
    onSubmit,
    isLoading = false,
}) => {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setValue("");
            // Defer focus so the modal mounts first
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isLoading) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, isLoading]);

    const submit = async () => {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) return;
        await onSubmit(trimmed);
    };

    const valid = /^\d+$/.test(value.trim());

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => !isLoading && onClose()}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
                    style={{
                        backgroundImage:
                            "radial-gradient(ellipse at center, rgba(40,22,8,0.55) 0%, rgba(0,0,0,0.9) 80%)",
                    }}
                >
                    <motion.div
                        key="panel"
                        initial={{ opacity: 0, y: -14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-[420px] overflow-hidden rounded-[12px] border border-[#C49A3C]/28 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.04)]"
                        style={{
                            background:
                                "linear-gradient(155deg, #1A0F05 0%, #2A1A0A 45%, #1A0F05 100%)",
                        }}
                    >
                        {/* Brass corner ornaments */}
                        <CornerOrnament className="absolute top-2 left-2" />
                        <CornerOrnament className="absolute top-2 right-2 rotate-90" />
                        <CornerOrnament className="absolute bottom-2 left-2 -rotate-90" />
                        <CornerOrnament className="absolute bottom-2 right-2 rotate-180" />

                        {/* Subtle film grain overlay */}
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
                            style={{
                                backgroundImage:
                                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
                            }}
                        />

                        {/* Top gold rule */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#C49A3C]/60 to-transparent" />

                        <div className="relative px-8 pt-7 pb-7 flex flex-col items-center text-center">
                            {/* Close X */}
                            <button
                                onClick={() => !isLoading && onClose()}
                                disabled={isLoading}
                                aria-label="Close"
                                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white/90 hover:bg-white/5 transition disabled:opacity-30"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>

                            {/* Eyebrow */}
                            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#C49A3C]/80 font-['Montserrat']">
                                Join by Room ID
                            </span>

                            {/* Wax seal mark */}
                            <div className="mt-4 mb-3 relative">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-[#2E1A0A] to-[#0E0703] border border-[#C49A3C]/40">
                                    <span className="text-[#C49A3C] text-3xl font-['Cinzel'] leading-none translate-y-[1px]">#</span>
                                </div>
                                {/* outer ring */}
                                <div className="absolute inset-[-6px] rounded-full border border-[#C49A3C]/12 pointer-events-none" />
                            </div>

                            {/* Title */}
                            <h3 className="font-['Cinzel'] text-white/95 text-[26px] md:text-[28px] tracking-[0.1em] leading-tight">
                                Enter Room Number
                            </h3>
                            <p className="mt-2 text-white/45 text-[12px] italic max-w-[300px] leading-relaxed">
                                Type the room ID your host gave you to join directly.
                            </p>

                            {/* Input row */}
                            <div className="mt-6 w-full">
                                <div
                                    className={`flex items-center w-full h-[60px] rounded-md border bg-black/55 transition-colors ${valid
                                        ? "border-[#C49A3C]/45"
                                        : "border-white/10"
                                        } focus-within:border-[#C49A3C]/80`}
                                >
                                    <span className="pl-5 pr-3 text-[#C49A3C]/70 text-xl font-['Cinzel'] select-none">
                                        #
                                    </span>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        inputMode="numeric"
                                        value={value}
                                        onChange={(e) => {
                                            const v = e.target.value.replace(/[^0-9]/g, "");
                                            setValue(v);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && valid && !isLoading) submit();
                                        }}
                                        disabled={isLoading}
                                        placeholder="0000"
                                        className="flex-1 bg-transparent h-full pr-5 outline-none text-white text-2xl font-mono tabular-nums tracking-[0.18em] placeholder:text-white/20 placeholder:tracking-[0.18em] disabled:opacity-60"
                                    />
                                </div>
                            </div>

                            {/* CTA — matches the game's primary-lobby button:
                                solid mid-tone bg, darker on hover, no glow,
                                no scale-up. */}
                            <button
                                onClick={submit}
                                disabled={!valid || isLoading}
                                className={`mt-5 w-full h-[52px] rounded-md font-['Montserrat'] font-bold tracking-[0.18em] text-[13px] uppercase transition-colors border active:scale-[0.98] ${valid && !isLoading
                                    ? "bg-[#A8784F] hover:bg-[#8A6340] text-white border-white/10"
                                    : "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"
                                    }`}
                            >
                                {isLoading ? (
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <Spinner /> Joining…
                                    </span>
                                ) : (
                                    "Join Room"
                                )}
                            </button>

                            <p className="mt-4 text-white/30 text-[10px] uppercase tracking-[0.3em] font-['Montserrat']">
                                Numbers only · Press Enter to confirm
                            </p>
                        </div>

                        {/* Bottom gold rule */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#C49A3C]/40 to-transparent" />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Decorative L-shaped corner brackets
const CornerOrnament: React.FC<{ className?: string }> = ({ className = "" }) => (
    <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className={`text-[#C49A3C]/55 ${className}`}
        aria-hidden
    >
        <path
            d="M2 9 V3 H8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
        />
        <circle cx="3" cy="3" r="1" fill="currentColor" opacity="0.7" />
    </svg>
);

const Spinner: React.FC = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2.5"
        />
        <path
            d="M21 12a9 9 0 0 1-9 9"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
        />
    </svg>
);
