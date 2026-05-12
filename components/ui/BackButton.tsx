import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, LogOut, AlertTriangle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface BackButtonProps {
    to?: string; // If not provided, goes back in history
    label?: string;
    className?: string;
    /** If true, shows an exit-game confirmation modal before navigating */
    exitGame?: boolean;
    /** Called when user confirms game exit (e.g. claimRefund). Should resolve when done. */
    onExitGame?: () => Promise<void>;
    /** Whether a transaction is currently pending */
    isLoading?: boolean;
    /** Context for the exit confirmation message */
    exitContext?: 'lobby' | 'game' | 'tournament-game' | 'pre-game-abort' | 'dead-player';
}

export const BackButton: React.FC<BackButtonProps> = ({
    to,
    label = "Back",
    className = "",
    exitGame = false,
    onExitGame,
    isLoading = false,
    exitContext = 'game',
}) => {
    const router = useRouter();
    const [showConfirm, setShowConfirm] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const handleClick = () => {
        if (exitGame) {
            setShowConfirm(true);
        } else {
            if (to) {
                router.push(to);
            } else {
                // If no "to" provided, go to home to ensure site-based navigation
                router.push('/');
            }
        }
    };

    const handleConfirmExit = async () => {
        setIsExiting(true);
        try {
            if (onExitGame) {
                await onExitGame();
            }
            // Always clear local storage so the game isn't re-loaded on browser back
            sessionStorage.removeItem('currentRoomId');
            localStorage.removeItem('currentRoomId');

            // Navigate after successful exit
            if (to) {
                router.push(to);
            } else {
                router.push('/lobby');
            }
        } catch (err) {
            console.error('[ExitGame] Failed:', err);
        } finally {
            // ALWAYS execute cleanup, even if contract call fails
            const rid = sessionStorage.getItem('currentRoomId') || localStorage.getItem('currentRoomId');
            if (rid && exitGame) {
                try {
                    const abandoned = JSON.parse(localStorage.getItem('mafia_abandoned_rooms') || '[]');
                    if (!abandoned.includes(rid)) {
                        abandoned.push(rid);
                        localStorage.setItem('mafia_abandoned_rooms', JSON.stringify(abandoned.slice(-20))); // Keep last 20
                    }
                } catch (e) { }
            }

            sessionStorage.removeItem('currentRoomId');
            localStorage.removeItem('currentRoomId');
            setIsExiting(false);
            setShowConfirm(false);

            if (to) {
                router.push(to);
            } else {
                router.push('/lobby');
            }
        }
    };

    const handleCancelExit = () => {
        if (!isExiting) {
            setShowConfirm(false);
        }
    };

    return (
        <>
            <button
                onClick={handleClick}
                disabled={isLoading && !exitGame}
                className={`group text-white/60 hover:text-white flex items-center gap-3 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            >
                <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 backdrop-blur-sm flex items-center justify-center transition-all group-hover:bg-[#8B2E2E]/40 group-hover:border-[#C94040]/50 group-hover:shadow-[0_0_15px_rgba(201,64,64,0.2)]">
                    {exitGame ? (
                        <LogOut className="w-5 h-5 rotate-180" />
                    ) : (
                        <ArrowLeft className="w-5 h-5" />
                    )}
                </div>
                {label && <span className="font-medium tracking-wide">{label}</span>}
            </button>

            {/* Exit Game Confirmation Modal — portal to body to escape overflow/transform containers */}
            {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
                {showConfirm && (
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
                        onClick={handleCancelExit}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: -14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-md rounded-[12px] overflow-hidden"
                            style={{
                                background:
                                    'linear-gradient(155deg, #1A0F05 0%, #2A1A0A 45%, #1A0F05 100%)',
                                border: '1px solid rgba(226,107,107,0.32)',
                                boxShadow: '0 24px 60px -18px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
                            }}
                        >
                            {/* Brass corner ornaments (danger tint) */}
                            <BackButtonCorner className="absolute top-2 left-2" />
                            <BackButtonCorner className="absolute top-2 right-2 rotate-90" />
                            <BackButtonCorner className="absolute bottom-2 left-2 -rotate-90" />
                            <BackButtonCorner className="absolute bottom-2 right-2 rotate-180" />

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
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(226,107,107,0.5), transparent)' }}
                            />

                            <div className="relative p-7">
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <span
                                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
                                        style={{
                                            backgroundColor: 'rgba(226,107,107,0.12)',
                                            borderColor: 'rgba(226,107,107,0.44)',
                                        }}
                                    >
                                        <AlertTriangle className="w-[18px] h-[18px] text-[#E26B6B]" />
                                    </span>
                                    <h3
                                        className="text-[19px] md:text-[20px] tracking-[0.14em] leading-tight text-[#E26B6B]"
                                        style={{ fontFamily: 'var(--font-cinzel), Cinzel, serif' }}
                                    >
                                        {exitContext === 'lobby' ? 'Leave Lobby?'
                                            : exitContext === 'pre-game-abort' ? 'Abort Round?'
                                                : exitContext === 'dead-player' ? 'Leave Game?'
                                                    : 'Leave Game?'}
                                    </h3>
                                </div>

                                {/* Description — context-dependent */}
                                {exitContext === 'lobby' ? (
                                    <p className="text-white/75 text-[14px] leading-relaxed mb-6">
                                        You will leave the lobby. Your session gas will be <span className="text-[#5BBB8C] font-semibold">refunded</span>.
                                    </p>
                                ) : exitContext === 'pre-game-abort' ? (
                                    <p className="text-white/75 text-[14px] leading-relaxed mb-6">
                                        The round hasn&apos;t started yet, so leaving <span className="text-[#E26B6B] font-semibold">cancels the whole round</span>. Every player (including anyone who went offline) gets a <span className="text-[#5BBB8C] font-semibold">full refund</span> — deposit and tournament buy-in back to their wallet.
                                    </p>
                                ) : exitContext === 'dead-player' ? (
                                    <p className="text-white/75 text-[14px] leading-relaxed mb-6">
                                        You&apos;re eliminated but the game is still going. If you <span className="text-[#5BBB8C] font-semibold">stay until the end</span>, your session gas will be <span className="text-[#5BBB8C] font-semibold">refunded automatically</span>. If you leave now, your gas <span className="text-[#E26B6B] font-semibold">will not be returned</span>.
                                    </p>
                                ) : exitContext === 'tournament-game' ? (
                                    <p className="text-white/75 text-[14px] leading-relaxed mb-6">
                                        Your character will be <span className="text-[#E26B6B] font-semibold">eliminated</span>. You will <span className="text-[#E26B6B] font-semibold">lose your session gas</span> and be <span className="text-[#E26B6B] font-semibold">excluded from prizes</span>.
                                    </p>
                                ) : (
                                    <p className="text-white/75 text-[14px] leading-relaxed mb-6">
                                        Your character will be <span className="text-[#E26B6B] font-semibold">eliminated</span>. You will <span className="text-[#E26B6B] font-semibold">lose your session gas</span>.
                                    </p>
                                )}

                                {/* Buttons — matches the game's secondary-lobby
                                    / primary-lobby button language. Solid mid-
                                    tone bg, darker on hover, no glow, no scale-
                                    up. */}
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={handleCancelExit}
                                        disabled={isExiting}
                                        className="flex-1 h-11 rounded-md border border-white/5 bg-[#19130D] text-white/80 text-[12px] uppercase tracking-[0.14em] font-medium hover:bg-[#2a2118] active:scale-[0.98] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Stay
                                    </button>
                                    <button
                                        onClick={handleConfirmExit}
                                        disabled={isExiting}
                                        className="flex-1 h-11 rounded-md border border-white/10 bg-[#8B2424] hover:bg-[#6B1818] text-white text-[12px] uppercase tracking-[0.14em] font-bold active:scale-[0.98] transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {isExiting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Leaving...
                                            </>
                                        ) : (
                                            <>
                                                <LogOut className="w-4 h-4" />
                                                Leave
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Bottom accent rule */}
                            <div
                                className="h-px w-full"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(226,107,107,0.32), transparent)' }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body)}
        </>
    );
};

// Decorative brass L-corners (red-tinted to match the danger context).
const BackButtonCorner: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className={`pointer-events-none ${className}`}
        style={{ color: '#E26B6B', opacity: 0.5 }}
        aria-hidden
    >
        <path d="M2 9 V3 H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="3" cy="3" r="1" fill="currentColor" opacity="0.7" />
    </svg>
);
