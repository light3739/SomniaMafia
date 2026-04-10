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
    exitContext?: 'lobby' | 'game' | 'tournament-game' | 'pre-game-abort';
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
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/74 backdrop-blur-md font-['Montserrat']"
                        onClick={handleCancelExit}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-md bg-[#0B0908] rounded-lg overflow-hidden"
                            style={{
                                border: '1px solid rgba(226,107,107,0.42)',
                                boxShadow: '0 0 80px rgba(226,107,107,0.16), 0 24px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
                            }}
                        >
                            {/* Top accent line */}
                            <div
                                className="absolute top-0 left-0 right-0 h-[2px]"
                                style={{ background: 'linear-gradient(90deg, transparent, #E26B6B, transparent)' }}
                            />

                            <div className="relative p-6">
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#E26B6B]/14">
                                        <AlertTriangle className="w-[18px] h-[18px] text-[#E26B6B]" />
                                    </span>
                                    <h3
                                        className="text-[15px] font-semibold tracking-wide text-[#E26B6B]"
                                        style={{ fontFamily: 'var(--font-cinzel)' }}
                                    >
                                        {exitContext === 'lobby' ? 'Leave Lobby?'
                                            : exitContext === 'pre-game-abort' ? 'Abort Round?'
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
                                ) : exitContext === 'tournament-game' ? (
                                    <p className="text-white/75 text-[14px] leading-relaxed mb-6">
                                        Your character will be <span className="text-[#E26B6B] font-semibold">eliminated</span>. You will <span className="text-[#E26B6B] font-semibold">lose your session gas</span> and be <span className="text-[#E26B6B] font-semibold">excluded from prizes</span>.
                                    </p>
                                ) : (
                                    <p className="text-white/75 text-[14px] leading-relaxed mb-6">
                                        Your character will be <span className="text-[#E26B6B] font-semibold">eliminated</span>. You will <span className="text-[#E26B6B] font-semibold">lose your session gas</span>.
                                    </p>
                                )}

                                {/* Buttons */}
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={handleCancelExit}
                                        disabled={isExiting}
                                        className="flex-1 h-11 rounded-md border border-white/10 text-white/65 text-[12px] uppercase tracking-[0.12em] font-semibold hover:border-white/25 hover:text-white hover:bg-white/[0.04] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Stay
                                    </button>
                                    <button
                                        onClick={handleConfirmExit}
                                        disabled={isExiting}
                                        className="flex-1 h-11 rounded-md text-[12px] uppercase tracking-[0.14em] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                                        style={{
                                            border: '1px solid #E26B6B',
                                            color: '#0A0A0A',
                                            backgroundColor: '#E26B6B',
                                            boxShadow: '0 6px 18px rgba(226,107,107,0.16)',
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ''; }}
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
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body)}
        </>
    );
};
