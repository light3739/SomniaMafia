'use client';

import React, { createContext, useContext, useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type DialogType = 'alert' | 'confirm' | 'prompt';
type DialogVariant = 'default' | 'danger' | 'success';

interface DialogConfig {
    type: DialogType;
    message: string;
    title?: string;
    variant?: DialogVariant;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
}

interface ActiveDialog extends DialogConfig {
    id: number;
    resolve: (value: string | boolean | null) => void;
}

interface NoirDialogContextValue {
    showAlert: (message: string, options?: Partial<Omit<DialogConfig, 'type'>>) => Promise<void>;
    showConfirm: (message: string, options?: Partial<Omit<DialogConfig, 'type'>>) => Promise<boolean>;
    showPrompt: (message: string, options?: Partial<Omit<DialogConfig, 'type'>>) => Promise<string | null>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const NoirDialogContext = createContext<NoirDialogContextValue | null>(null);

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNoirDialog(): NoirDialogContextValue {
    const ctx = useContext(NoirDialogContext);
    if (!ctx) throw new Error('useNoirDialog must be used within NoirDialogProvider');
    return ctx;
}

// ─── Single Modal ─────────────────────────────────────────────────────────────

interface ModalProps {
    dialog: ActiveDialog;
    onResolve: (value: string | boolean | null) => void;
}

// Variant palette — single source of truth so the redesigned modal stays
// consistent and easy to extend. Button colors mirror the game's existing
// primary-lobby pattern (solid mid-tone, darker on hover) so dialogs feel
// native to the rest of the UI.
const VARIANT_STYLES: Record<DialogVariant, {
    accent: string;       // title + icon color (lighter tint)
    accentSoft: string;   // icon-circle bg
    border: string;       // panel border tint
    btnBg: string;        // confirm button base bg
    btnBgHover: string;   // confirm button hover bg
    btnText: string;      // confirm button label
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
}> = {
    default: {
        accent: '#C5A059',
        accentSoft: 'rgba(197,160,89,0.12)',
        border: 'rgba(197,160,89,0.28)',
        btnBg: '#A8784F',
        btnBgHover: '#8A6340',
        btnText: '#FFFFFF',
        icon: Info,
        iconClass: 'text-[#C5A059]',
    },
    danger: {
        accent: '#E26B6B',
        accentSoft: 'rgba(226,107,107,0.12)',
        border: 'rgba(226,107,107,0.32)',
        btnBg: '#8B2424',
        btnBgHover: '#6B1818',
        btnText: '#FFE4E4',
        icon: AlertTriangle,
        iconClass: 'text-[#E26B6B]',
    },
    success: {
        accent: '#5BBB8C',
        accentSoft: 'rgba(91,187,140,0.12)',
        border: 'rgba(91,187,140,0.28)',
        btnBg: '#3F8458',
        btnBgHover: '#2D6440',
        btnText: '#FFFFFF',
        icon: CheckCircle,
        iconClass: 'text-[#5BBB8C]',
    },
};

function NoirModal({ dialog, onResolve }: ModalProps) {
    const [inputValue, setInputValue] = useState(dialog.defaultValue ?? '');
    const inputRef = useRef<HTMLInputElement>(null);
    const variant = dialog.variant ?? 'default';
    const styles = VARIANT_STYLES[variant];
    const Icon = styles.icon;

    const handleConfirm = () => {
        if (dialog.type === 'prompt') onResolve(inputValue || null);
        else if (dialog.type === 'confirm') onResolve(true);
        else onResolve(null);
    };

    const handleCancel = () => {
        if (dialog.type === 'confirm') onResolve(false);
        else onResolve(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') handleCancel();
    };

    const defaultTitle =
        dialog.type === 'confirm' ? 'Confirm Action' :
        dialog.type === 'prompt' ? 'Input Required' :
        variant === 'danger' ? 'Warning' :
        variant === 'success' ? 'Success' :
        'Notice';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center px-4 font-['Montserrat']"
            style={{
                backgroundImage:
                    'radial-gradient(ellipse at center, rgba(40,22,8,0.55) 0%, rgba(0,0,0,0.9) 80%)',
                backdropFilter: 'blur(8px)',
            }}
            onKeyDown={handleKeyDown}
            onClick={handleCancel}
        >
            <motion.div
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="w-full max-w-md rounded-[12px] relative overflow-hidden"
                style={{
                    background:
                        'linear-gradient(155deg, #1A0F05 0%, #2A1A0A 45%, #1A0F05 100%)',
                    border: `1px solid ${styles.border}`,
                    boxShadow: '0 24px 60px -18px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Brass corner ornaments (variant-tinted) */}
                <CornerOrnament accent={styles.accent} className="absolute top-2 left-2" />
                <CornerOrnament accent={styles.accent} className="absolute top-2 right-2 rotate-90" />
                <CornerOrnament accent={styles.accent} className="absolute bottom-2 left-2 -rotate-90" />
                <CornerOrnament accent={styles.accent} className="absolute bottom-2 right-2 rotate-180" />

                {/* Subtle film grain */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
                    style={{
                        backgroundImage:
                            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
                    }}
                />

                {/* Top accent rule */}
                <div
                    className="h-px w-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${styles.accent}66, transparent)` }}
                />

                <div className="relative">
                    {/* Header */}
                    <div className="flex items-center justify-between px-7 pt-6 pb-2">
                        <div className="flex items-center gap-3">
                            <span
                                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
                                style={{
                                    backgroundColor: styles.accentSoft,
                                    borderColor: `${styles.accent}44`,
                                }}
                            >
                                <Icon className={`w-[18px] h-[18px] ${styles.iconClass}`} />
                            </span>
                            <h3
                                className="text-[19px] md:text-[20px] tracking-[0.14em] leading-tight"
                                style={{ color: styles.accent, fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
                            >
                                {dialog.title ?? defaultTitle}
                            </h3>
                        </div>
                        <button
                            onClick={handleCancel}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/90 hover:bg-white/[0.06] transition-all shrink-0"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-7 pt-3 pb-5">
                        <p className="text-white/75 text-[14px] leading-relaxed">
                            {dialog.message}
                        </p>

                        {dialog.type === 'prompt' && (
                            <input
                                ref={inputRef}
                                autoFocus
                                type="text"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                placeholder={dialog.placeholder ?? ''}
                                className="mt-5 w-full bg-black/55 border rounded-md px-4 py-3 text-white text-[14px] outline-none transition-all placeholder:text-white/35"
                                style={{
                                    borderColor: 'rgba(255,255,255,0.10)',
                                }}
                                onFocus={e => {
                                    e.currentTarget.style.borderColor = `${styles.accent}99`;
                                    e.currentTarget.style.boxShadow = `0 0 0 3px ${styles.accent}1f`;
                                }}
                                onBlur={e => {
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                                    e.currentTarget.style.boxShadow = '';
                                }}
                            />
                        )}
                    </div>

                    {/* Actions — match the game's existing primary-lobby /
                        secondary-lobby button language: solid mid-tone bg,
                        darker on hover, no glow, no scale-up. */}
                    <div className="flex gap-2.5 px-7 pb-6">
                        {dialog.type !== 'alert' && (
                            <button
                                onClick={handleCancel}
                                className="flex-1 h-11 rounded-md border border-white/5 bg-[#19130D] text-white/80 text-[12px] uppercase tracking-[0.14em] font-medium font-['Montserrat'] hover:bg-[#2a2118] active:scale-[0.98] transition-colors"
                            >
                                {dialog.cancelLabel ?? 'Cancel'}
                            </button>
                        )}
                        <button
                            onClick={handleConfirm}
                            className="flex-1 h-11 rounded-md border border-white/10 text-[12px] uppercase tracking-[0.14em] font-bold font-['Montserrat'] active:scale-[0.98] transition-colors"
                            style={{
                                color: styles.btnText,
                                backgroundColor: styles.btnBg,
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor = styles.btnBgHover;
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLButtonElement).style.backgroundColor = styles.btnBg;
                            }}
                        >
                            {dialog.confirmLabel ?? (dialog.type === 'confirm' ? 'Confirm' : 'OK')}
                        </button>
                    </div>
                </div>

                {/* Bottom accent rule */}
                <div
                    className="h-px w-full"
                    style={{ background: `linear-gradient(90deg, transparent, ${styles.accent}44, transparent)` }}
                />
            </motion.div>
        </motion.div>
    );
}

// Decorative L-shaped brass corner brackets — tinted with variant accent
const CornerOrnament: React.FC<{ accent: string; className?: string }> = ({ accent, className = '' }) => (
    <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className={`pointer-events-none ${className}`}
        style={{ color: accent, opacity: 0.5 }}
        aria-hidden
    >
        <path d="M2 9 V3 H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="3" cy="3" r="1" fill="currentColor" opacity="0.7" />
    </svg>
);


// ─── Provider ─────────────────────────────────────────────────────────────────

export function NoirDialogProvider({ children }: { children: React.ReactNode }) {
    const [dialogs, setDialogs] = useState<ActiveDialog[]>([]);
    const counterRef = useRef(0);

    const openDialog = useCallback((config: DialogConfig): Promise<string | boolean | null> => {
        return new Promise(resolve => {
            const id = ++counterRef.current;
            setDialogs(prev => [...prev, { ...config, id, resolve }]);
        });
    }, []);

    const resolveDialog = useCallback((id: number, value: string | boolean | null) => {
        setDialogs(prev => {
            const dialog = prev.find(d => d.id === id);
            if (dialog) dialog.resolve(value);
            return prev.filter(d => d.id !== id);
        });
    }, []);

    const showAlert = useCallback(
        (message: string, options?: Partial<Omit<DialogConfig, 'type'>>) =>
            openDialog({ type: 'alert', message, ...options }).then(() => undefined),
        [openDialog]
    );

    const showConfirm = useCallback(
        (message: string, options?: Partial<Omit<DialogConfig, 'type'>>) =>
            openDialog({ type: 'confirm', message, ...options }).then(v => Boolean(v)),
        [openDialog]
    );

    const showPrompt = useCallback(
        (message: string, options?: Partial<Omit<DialogConfig, 'type'>>) =>
            openDialog({ type: 'prompt', message, ...options }).then(v => v as string | null),
        [openDialog]
    );

    const activeDialog = dialogs[dialogs.length - 1] ?? null;

    return (
        <NoirDialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
            {children}
            <AnimatePresence>
                {activeDialog && (
                    <NoirModal
                        key={activeDialog.id}
                        dialog={activeDialog}
                        onResolve={val => resolveDialog(activeDialog.id, val)}
                    />
                )}
            </AnimatePresence>
        </NoirDialogContext.Provider>
    );
}
