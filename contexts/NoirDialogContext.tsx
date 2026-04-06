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

// ─── Ornament (thin decorative separator) ────────────────────────────────────

const Ornament = () => (
    <div className="flex items-center gap-2 my-1">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#C5A059]/30" />
        <div className="w-1 h-1 rounded-full bg-[#C5A059]/50" />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#C5A059]/30" />
    </div>
);

// ─── Single Modal ─────────────────────────────────────────────────────────────

interface ModalProps {
    dialog: ActiveDialog;
    onResolve: (value: string | boolean | null) => void;
}

function NoirModal({ dialog, onResolve }: ModalProps) {
    const [inputValue, setInputValue] = useState(dialog.defaultValue ?? '');
    const inputRef = useRef<HTMLInputElement>(null);
    const variant = dialog.variant ?? 'default';

    const accentColor =
        variant === 'danger' ? '#cc4444' :
        variant === 'success' ? '#4caf82' :
        '#C5A059';

    const borderColor =
        variant === 'danger' ? 'border-[#8B0000]/50' :
        variant === 'success' ? 'border-[#4caf82]/30' :
        'border-[#C5A059]/25';

    const shadowColor =
        variant === 'danger' ? 'rgba(139,0,0,0.15)' :
        variant === 'success' ? 'rgba(76,175,130,0.1)' :
        'rgba(197,160,89,0.08)';

    const Icon =
        variant === 'danger' ? AlertTriangle :
        variant === 'success' ? CheckCircle :
        Info;

    const iconColor =
        variant === 'danger' ? 'text-[#cc4444]' :
        variant === 'success' ? 'text-[#4caf82]' :
        'text-[#C5A059]/70';

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

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
            onKeyDown={handleKeyDown}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: 'spring', damping: 28, stiffness: 380, duration: 0.22 }}
                className={`w-full max-w-sm bg-[#0D0D0D] border ${borderColor} rounded-sm relative overflow-hidden`}
                style={{ boxShadow: `0 0 60px ${shadowColor}, 0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.03)` }}
                onClick={e => e.stopPropagation()}
            >
                {/* Top accent line */}
                <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${accentColor}55, transparent)` }}
                />

                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-3">
                    <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                        <h3
                            className="text-[11px] uppercase tracking-[0.18em] font-semibold"
                            style={{ fontFamily: 'var(--font-cinzel)', color: accentColor }}
                        >
                            {dialog.title ?? (
                                dialog.type === 'confirm' ? 'Confirm Action' :
                                dialog.type === 'prompt' ? 'Input Required' :
                                'Notice'
                            )}
                        </h3>
                    </div>
                    {dialog.type !== 'confirm' && (
                        <button
                            onClick={handleCancel}
                            className="w-10 h-10 flex items-center justify-center rounded-full text-white/50 hover:text-white/80 hover:bg-white/8 transition-all shrink-0 -mt-0.5"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <Ornament />

                {/* Body */}
                <div className="px-5 pt-3 pb-4">
                    <p
                        className="text-white/70 text-[13px] leading-relaxed"
                        style={{ fontFamily: 'var(--font-montserrat)' }}
                    >
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
                            className="mt-4 w-full bg-black/60 border border-white/10 rounded-sm px-3 py-2.5 text-white text-[13px] outline-none transition-all placeholder:text-white/40 focus:border-[#C5A059]/50 focus:shadow-[0_0_0_1px_rgba(197,160,89,0.15)] font-['Montserrat']"
                        />
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 px-5 pb-5">
                    {dialog.type !== 'alert' && (
                        <button
                            onClick={handleCancel}
                            className="flex-1 py-2.5 rounded-sm border border-white/10 text-white/60 text-[11px] uppercase tracking-[0.12em] font-semibold hover:border-white/25 hover:text-white/80 transition-all active:scale-[0.97]"
                            style={{ fontFamily: 'var(--font-cinzel)' }}
                        >
                            {dialog.cancelLabel ?? 'Cancel'}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className="flex-1 py-2.5 rounded-sm border text-[11px] uppercase tracking-[0.12em] font-semibold transition-all active:scale-[0.97]"
                        style={{
                            fontFamily: 'var(--font-cinzel)',
                            borderColor: `${accentColor}55`,
                            color: accentColor,
                            backgroundColor: `${accentColor}08`,
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = `${accentColor}99`;
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentColor}15`;
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 18px ${accentColor}20`;
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = `${accentColor}55`;
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentColor}08`;
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                        }}
                    >
                        {dialog.confirmLabel ?? (dialog.type === 'confirm' ? 'Confirm' : 'OK')}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

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
