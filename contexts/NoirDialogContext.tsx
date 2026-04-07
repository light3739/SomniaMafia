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
// consistent and easy to extend.
const VARIANT_STYLES: Record<DialogVariant, {
    accent: string;
    accentSoft: string;
    border: string;
    glow: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
}> = {
    default: {
        accent: '#C5A059',
        accentSoft: 'rgba(197,160,89,0.12)',
        border: 'rgba(197,160,89,0.32)',
        glow: 'rgba(197,160,89,0.10)',
        icon: Info,
        iconClass: 'text-[#C5A059]',
    },
    danger: {
        accent: '#E26B6B',
        accentSoft: 'rgba(226,107,107,0.14)',
        border: 'rgba(226,107,107,0.42)',
        glow: 'rgba(226,107,107,0.16)',
        icon: AlertTriangle,
        iconClass: 'text-[#E26B6B]',
    },
    success: {
        accent: '#5BBB8C',
        accentSoft: 'rgba(91,187,140,0.14)',
        border: 'rgba(91,187,140,0.32)',
        glow: 'rgba(91,187,140,0.10)',
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
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center px-4 font-['Montserrat']"
            style={{ backgroundColor: 'rgba(0,0,0,0.74)', backdropFilter: 'blur(6px)' }}
            onKeyDown={handleKeyDown}
            onClick={handleCancel}
        >
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="w-full max-w-md bg-[#0B0B0B] rounded-lg relative overflow-hidden"
                style={{
                    border: `1px solid ${styles.border}`,
                    boxShadow: `0 0 80px ${styles.glow}, 0 24px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Top accent line */}
                <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${styles.accent}, transparent)` }}
                />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-1">
                    <div className="flex items-center gap-3">
                        <span
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: styles.accentSoft }}
                        >
                            <Icon className={`w-[18px] h-[18px] ${styles.iconClass}`} />
                        </span>
                        <h3
                            className="text-[15px] font-semibold tracking-wide"
                            style={{ color: styles.accent, fontFamily: 'var(--font-cinzel)' }}
                        >
                            {dialog.title ?? defaultTitle}
                        </h3>
                    </div>
                    <button
                        onClick={handleCancel}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 pt-4 pb-5">
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
                            className="mt-5 w-full bg-black/60 border border-white/10 rounded-md px-4 py-3 text-white text-[14px] outline-none transition-all placeholder:text-white/35 focus:border-[#C5A059]/60 focus:shadow-[0_0_0_3px_rgba(197,160,89,0.12)]"
                        />
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 px-6 pb-6">
                    {dialog.type !== 'alert' && (
                        <button
                            onClick={handleCancel}
                            className="flex-1 h-11 rounded-md border border-white/10 text-white/65 text-[12px] uppercase tracking-[0.12em] font-semibold hover:border-white/25 hover:text-white hover:bg-white/[0.04] transition-all active:scale-[0.98]"
                        >
                            {dialog.cancelLabel ?? 'Cancel'}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        className="flex-1 h-11 rounded-md text-[12px] uppercase tracking-[0.14em] font-bold transition-all active:scale-[0.98]"
                        style={{
                            border: `1px solid ${styles.accent}`,
                            color: '#0A0A0A',
                            backgroundColor: styles.accent,
                            boxShadow: `0 6px 18px ${styles.glow}`,
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.filter = '';
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
