/**
 * ShareModal — social share modal for any URL + text.
 *
 * Stateless, game-agnostic presenter: accepts a URL, a text snippet, and
 * an optional `generateImage` callback for the legacy html-to-image "Save
 * Image" action. Renders a grid of platform deep-link buttons plus a
 * clipboard fallback and (on supporting devices) a native Web Share API
 * entry point.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { X, Link as LinkIcon, Download, Share2, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import {
    twitterIntent,
    telegramIntent,
    warpcastIntent,
    whatsappIntent,
    redditIntent,
    discordShareText,
} from '../../services/share/intents';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    text: string;
    title: string;
    generateImage?: () => Promise<Blob | null>;
}

// Brand SVGs inlined so every button carries the platform's actual logo.
// Lucide only ships generic fallbacks for most of these, which look off-brand
// next to the X logo and muddle quick recognition.
const XLogo = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2H21.5l-7.5 8.57L22.75 22h-6.82l-5.34-6.98L4.5 22H1.244l8.03-9.18L1.75 2h6.98l4.83 6.39L18.244 2Zm-1.196 18h1.89L7.04 4H5.05l11.998 16Z" />
    </svg>
);

const TelegramLogo = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <path d="M21.5 3.5 2.3 10.9c-1 .4-1 1 .2 1.4l4.6 1.4 1.8 5.6c.2.6.4.9.8.9.3 0 .5-.1.8-.4l2.4-2.3 4.8 3.6c.9.5 1.5.2 1.8-.8L22.5 5c.3-1.3-.5-1.9-1-1.5Zm-4.8 4.6-8.6 7.8-.3 3.1-1.6-4.9 10.1-6.6c.4-.3.8.1.4.6Z" />
    </svg>
);

const WarpcastLogo = () => (
    <svg viewBox="0 0 225 225" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <path d="M57 35h111v155h-17v-70h-.2a39 39 0 0 0-77.6 0H73v70H57V35Zm-9 0-4 19h14v117h-9v19h56v-19h-9V86h-2l-20-30-20 30h-2v66h-9V54h14l-4-19H48Zm160 0-4 19h14v117h-9v19h56v-19h-9V86h-2l-20-30-20 30h-2v66h-9V54h14l-4-19h-5Z" />
    </svg>
);

const WhatsAppLogo = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.36c-.3-.15-1.74-.86-2-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.15-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.34.44-.5.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.18-.24-.58-.48-.5-.66-.5-.17 0-.37-.02-.57-.02-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.47 0 1.45 1.07 2.87 1.22 3.06.15.2 2.1 3.2 5.08 4.48 2.98 1.28 2.98.85 3.52.8.54-.05 1.74-.7 1.98-1.4.25-.67.25-1.25.17-1.4-.07-.15-.27-.22-.57-.37ZM12.05 21h-.04A9.86 9.86 0 0 1 7 19.62l-.36-.22-3.73.97 1-3.63-.23-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.45-9.89 9.93-9.89 2.65 0 5.14 1.03 7.02 2.9a9.88 9.88 0 0 1 2.91 7c0 5.45-4.45 9.88-9.98 9.88ZM20.52 3.45A11.82 11.82 0 0 0 12.05 0C5.45 0 .1 5.33.1 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.64a11.96 11.96 0 0 0 5.74 1.46h.01c6.6 0 11.96-5.34 11.96-11.9 0-3.18-1.24-6.17-3.5-8.47Z" />
    </svg>
);

const DiscordLogo = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <path d="M20.32 4.57A19.79 19.79 0 0 0 16.56 3c-.17.3-.37.7-.5 1.02a18.3 18.3 0 0 0-5.12 0c-.13-.32-.34-.72-.5-1.02a19.74 19.74 0 0 0-3.76 1.57C3.8 8.24 2.9 11.8 3.14 15.3a19.88 19.88 0 0 0 6.06 3.06c.49-.67.92-1.38 1.3-2.13-.72-.27-1.4-.6-2.06-.99.17-.13.34-.26.5-.4a14.16 14.16 0 0 0 12.12 0c.17.14.34.27.5.4-.65.4-1.34.72-2.06 1 .37.74.8 1.45 1.29 2.12a19.86 19.86 0 0 0 6.07-3.06c.3-4.02-.72-7.54-3.52-10.73ZM9.29 13.1c-1.16 0-2.12-1.07-2.12-2.38 0-1.32.93-2.4 2.12-2.4 1.2 0 2.15 1.08 2.13 2.4 0 1.31-.94 2.38-2.13 2.38Zm5.42 0c-1.16 0-2.12-1.07-2.12-2.38 0-1.32.93-2.4 2.12-2.4 1.2 0 2.15 1.08 2.12 2.4 0 1.31-.92 2.38-2.12 2.38Z" />
    </svg>
);

const RedditLogo = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <path d="M22 12.06c0-1.2-.98-2.18-2.18-2.18-.59 0-1.12.23-1.51.61-1.5-1.08-3.55-1.77-5.83-1.85l1-4.69 3.27.7a1.56 1.56 0 1 0 .15-.87l-3.65-.78a.43.43 0 0 0-.5.34L11.6 8.65c-2.32.06-4.42.76-5.94 1.86a2.17 2.17 0 0 0-1.5-.63 2.18 2.18 0 0 0-.89 4.17c-.03.2-.05.4-.05.6 0 3.05 3.55 5.52 7.93 5.52S19.1 17.7 19.1 14.65c0-.2-.01-.4-.05-.6.7-.32 1.2-1.03 1.2-1.85.01.02-1.25.05-1.25-.14ZM7 13.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5S7 14.33 7 13.5Zm8.37 3.86a5.33 5.33 0 0 1-3.39 1.03c-1.28.01-2.5-.34-3.39-1.03a.37.37 0 1 1 .51-.54c.72.55 1.7.84 2.88.84s2.16-.29 2.89-.84a.37.37 0 0 1 .5.54Zm-.4-2.36c-.82 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5Z" />
    </svg>
);

interface PlatformButtonProps {
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
}

const PlatformButton: React.FC<PlatformButtonProps> = ({ label, onClick, icon, disabled }) => (
    <Button
        variant="outline-gold"
        onClick={onClick}
        disabled={disabled}
        className="flex-1 h-11 gap-2 text-xs tracking-wide"
    >
        <span className="flex items-center justify-center">{icon}</span>
        <span className="font-['Montserrat'] uppercase">{label}</span>
    </Button>
);

export const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    url,
    text,
    title,
    generateImage,
}) => {
    const [canNativeShare, setCanNativeShare] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Feature-detect Web Share API on mount — never at render top level
    // because it would break SSR.
    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        setCanNativeShare(typeof navigator.share === 'function');
    }, []);

    // Focus management + Escape to close
    useEffect(() => {
        if (!isOpen) return;
        previousFocusRef.current = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
        const focusTimer = setTimeout(() => {
            const first = dialogRef.current?.querySelector<HTMLButtonElement>('button:not([aria-hidden="true"])');
            first?.focus();
        }, 50);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            clearTimeout(focusTimer);
            document.removeEventListener('keydown', onKey);
            previousFocusRef.current?.focus?.();
        };
    }, [isOpen, onClose]);

    const openIntent = useCallback((intent: string) => {
        // Must run synchronously inside the click handler or popup blockers kill it.
        window.open(intent, '_blank', 'noopener,noreferrer');
    }, []);

    const writeClipboard = useCallback(async (value: string): Promise<boolean> => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch {
            // fall through
        }
        // Legacy fallback for insecure contexts — a hidden textarea + execCommand.
        try {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }, []);

    const handleCopyLink = useCallback(async () => {
        const ok = await writeClipboard(url);
        if (!mountedRef.current) return;
        if (ok) {
            setCopied(true);
            toast.success('Link copied');
            setTimeout(() => { if (mountedRef.current) setCopied(false); }, 2000);
        } else {
            toast.error('Copy failed — long-press the link below');
        }
    }, [url, writeClipboard]);

    const handleDiscord = useCallback(async () => {
        const ok = await writeClipboard(discordShareText(url, text));
        if (!mountedRef.current) return;
        if (ok) toast.success('Copied — paste into Discord');
        else toast.error('Copy failed');
    }, [url, text, writeClipboard]);

    const handleNativeShare = useCallback(async () => {
        if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
        try {
            await navigator.share({ url, text, title });
        } catch (e) {
            if ((e as { name?: string } | undefined)?.name !== 'AbortError') {
                toast.error('Share failed');
            }
        }
    }, [url, text, title]);

    const handleSaveImage = useCallback(async () => {
        if (!generateImage) return;
        setIsSaving(true);
        try {
            const blob = await generateImage();
            if (!mountedRef.current) return;
            if (!blob) {
                toast.error('Failed to generate screenshot');
                return;
            }
            // Try Web Share API with the file first on mobile — it gives the
            // nicest UX (native sheet with save/AirDrop/etc). Otherwise fall
            // back to a direct download.
            const file = new File([blob], `mafia-onchain-${Date.now()}.png`, { type: 'image/png' });
            if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title, text });
                    return;
                } catch (e) {
                    if ((e as { name?: string } | undefined)?.name === 'AbortError') return;
                }
            }
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `mafia-onchain-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            toast.success('Screenshot downloaded');
        } catch (e) {
            if ((e as { name?: string } | undefined)?.name !== 'AbortError') {
                toast.error('Share failed');
            }
        } finally {
            if (mountedRef.current) setIsSaving(false);
        }
    }, [generateImage, title, text]);

    const urlDisabled = !url;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="share-modal"
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="share-modal-title"
                >
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={onClose}
                        aria-hidden="true"
                    />
                    <motion.div
                        ref={dialogRef}
                        initial={{ opacity: 0, y: 30, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.97 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="relative w-full max-w-md rounded-xl bg-[#0D0D0D] border border-[#C49A6C]/30 overflow-hidden"
                        style={{
                            boxShadow: '0 0 60px rgba(196,154,108,0.18), 0 20px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
                        }}
                    >
                        <div className="h-[1px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(196,154,108,0.5), transparent)' }} />

                        <div className="flex items-center justify-between px-5 pt-4 pb-3">
                            <h2
                                id="share-modal-title"
                                className="font-['Cinzel'] text-[#C49A3C] text-lg uppercase tracking-[0.18em]"
                            >
                                Share your verdict
                            </h2>
                            <button
                                onClick={onClose}
                                className="text-[#C49A3C]/60 hover:text-[#C49A3C] transition-colors p-1"
                                aria-label="Close share modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-5 pb-5 space-y-2">
                            <div className="flex gap-2">
                                <PlatformButton
                                    label="X / Twitter"
                                    icon={<XLogo />}
                                    onClick={() => openIntent(twitterIntent(url, text))}
                                    disabled={urlDisabled}
                                />
                                <PlatformButton
                                    label="Telegram"
                                    icon={<TelegramLogo />}
                                    onClick={() => openIntent(telegramIntent(url, text))}
                                    disabled={urlDisabled}
                                />
                            </div>
                            <div className="flex gap-2">
                                <PlatformButton
                                    label="Warpcast"
                                    icon={<WarpcastLogo />}
                                    onClick={() => openIntent(warpcastIntent(url, text))}
                                    disabled={urlDisabled}
                                />
                                <PlatformButton
                                    label="WhatsApp"
                                    icon={<WhatsAppLogo />}
                                    onClick={() => openIntent(whatsappIntent(url, text))}
                                    disabled={urlDisabled}
                                />
                            </div>
                            <div className="flex gap-2">
                                <PlatformButton
                                    label="Reddit"
                                    icon={<RedditLogo />}
                                    onClick={() => openIntent(redditIntent(url, title))}
                                    disabled={urlDisabled}
                                />
                                <PlatformButton
                                    label="Discord"
                                    icon={<DiscordLogo />}
                                    onClick={handleDiscord}
                                    disabled={urlDisabled}
                                />
                            </div>
                            <div className="flex gap-2">
                                {generateImage && (
                                    <PlatformButton
                                        label={isSaving ? 'Saving…' : 'Save Image'}
                                        icon={<Download className="w-4 h-4" />}
                                        onClick={handleSaveImage}
                                        disabled={isSaving}
                                    />
                                )}
                                {canNativeShare && (
                                    <PlatformButton
                                        label="More…"
                                        icon={<Share2 className="w-4 h-4" />}
                                        onClick={handleNativeShare}
                                        disabled={urlDisabled}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="border-t border-[#C49A6C]/15 px-5 py-3 bg-[#19130D]/60">
                            <button
                                onClick={handleCopyLink}
                                disabled={urlDisabled}
                                className="w-full flex items-center justify-between gap-2 text-left group disabled:opacity-50"
                                aria-label="Copy share link"
                            >
                                <span className="text-[#C49A3C]/60 text-[10px] uppercase tracking-[0.2em] font-bold font-['Montserrat'] shrink-0">
                                    Link
                                </span>
                                <span className="flex-1 text-[#C49A3C] text-[11px] font-mono truncate group-hover:text-[#F0E6D8] transition-colors">
                                    {url || '—'}
                                </span>
                                {copied ? (
                                    <Check className="w-3.5 h-3.5 text-[#0D9488] shrink-0" aria-hidden="true" />
                                ) : (
                                    <LinkIcon className="w-3.5 h-3.5 text-[#C49A3C]/50 group-hover:text-[#C49A3C] transition-colors shrink-0" aria-hidden="true" />
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
