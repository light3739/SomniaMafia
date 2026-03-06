import React, { useState } from 'react';
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
}

export const BackButton: React.FC<BackButtonProps> = ({
    to,
    label = "Back",
    className = "",
    exitGame = false,
    onExitGame,
    isLoading = false,
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

            {/* Exit Game Confirmation Modal */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={handleCancelExit}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-[380px] max-w-[90vw] bg-gradient-to-b from-[#1A1210] to-[#0D0907] border border-[#8B2E2E]/30 rounded-2xl overflow-hidden"
                        >
                            {/* Red glow at top */}
                            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#8B2E2E]/10 to-transparent pointer-events-none" />

                            <div className="relative p-6 flex flex-col items-center text-center">
                                {/* Warning Icon */}
                                <div className="w-14 h-14 rounded-full bg-[#8B2E2E]/15 border border-[#C94040]/30 flex items-center justify-center mb-4">
                                    <AlertTriangle className="w-7 h-7 text-[#C94040]" />
                                </div>

                                {/* Title */}
                                <h3 className="text-white text-lg font-['Cinzel'] font-bold tracking-wide mb-2">
                                    Leave Game?
                                </h3>

                                {/* Description */}
                                <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-[280px]">
                                    Your character will be <span className="text-[#C94040] font-semibold">eliminated</span> from the game.
                                    Your deposit will be <span className="text-[#4CAF50] font-semibold">refunded</span>.
                                </p>

                                {/* Buttons */}
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={handleCancelExit}
                                        disabled={isExiting}
                                        className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Stay
                                    </button>
                                    <button
                                        onClick={handleConfirmExit}
                                        disabled={isExiting}
                                        className="flex-1 h-11 rounded-xl bg-[#8B2E2E] hover:bg-[#A33636] border border-[#C94040]/30 text-white transition-all text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,46,46,0.3)] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {isExiting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Leaving...
                                            </>
                                        ) : (
                                            <>
                                                <LogOut className="w-4 h-4" />
                                                Leave Game
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
