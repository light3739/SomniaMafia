import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/Button';
import { MicButton } from '../MicButton';

interface DiscussionSectionProps {
    discussionState: any;
    isTestMode: boolean;
    smoothTimeRemaining: number;
    currentSpeaker: any;
    currentRoomId: any;
    myPlayer: any;
    isProcessing: boolean;
    onSkip: () => void;
    isHost?: boolean;
}

export const DiscussionSection: React.FC<DiscussionSectionProps> = ({
    discussionState, isTestMode, smoothTimeRemaining, currentSpeaker, currentRoomId, myPlayer, isProcessing, onSkip, isHost = false
}) => {
    const [sessionInvalid, setSessionInvalid] = useState<{ bad: boolean; reason: string }>({ bad: false, reason: '' });

    useEffect(() => {
        if (isTestMode || !myPlayer?.address || !currentRoomId) {
            setSessionInvalid({ bad: false, reason: '' });
            return;
        }
        const check = () => {
            try {
                const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('somnia_mafia_session') : null;
                const raw = stored ? JSON.parse(stored) : null;
                if (!raw) return setSessionInvalid({ bad: true, reason: 'missing' });
                if (raw.mainWallet?.toLowerCase() !== myPlayer.address.toLowerCase()) {
                    return setSessionInvalid({ bad: true, reason: 'wallet mismatch' });
                }
                try {
                    if (BigInt(raw.roomId) !== BigInt(currentRoomId)) {
                        return setSessionInvalid({ bad: true, reason: 'room mismatch' });
                    }
                } catch {
                    return setSessionInvalid({ bad: true, reason: 'room invalid' });
                }
                if (typeof raw.expiresAt !== 'number' || Date.now() >= raw.expiresAt) {
                    return setSessionInvalid({ bad: true, reason: 'expired' });
                }
                setSessionInvalid({ bad: false, reason: '' });
            } catch {
                setSessionInvalid({ bad: true, reason: 'parse error' });
            }
        };
        check();
        const iv = setInterval(check, 3000);
        return () => clearInterval(iv);
    }, [isTestMode, myPlayer?.address, currentRoomId]);

    if (!discussionState?.active && !isTestMode) {
        if (discussionState?.finished) {
            return (
                <div className="w-full py-3 text-center bg-[#0A0A0A] rounded-md border border-[#916A47]/30 shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
                    <p className="text-[#916A47] font-bold text-base animate-pulse">Starting Vote...</p>
                </div>
            );
        }
        return (
            <div className="w-full py-6 text-center bg-[#0A0A0A] rounded-md border border-[#916A47]/30 shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
                <p className="text-[#916A47] font-medium text-lg animate-pulse">Waiting for discussion to start...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full space-y-3"
        >
            <div className="relative w-full py-2 text-center bg-[#0A0A0A] rounded-md border border-[#916A47]/30 shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
                {discussionState?.phase === 'initial_delay' ? (
                    <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 text-[#916A47]" />
                        <span className="text-2xl font-bold text-white tabular-nums">{smoothTimeRemaining}s</span>
                        <span className="text-[#916A47] text-[10px] uppercase font-bold tracking-widest ml-2">Starting Discussion...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 text-[#916A47]" />
                        <span className="text-2xl font-bold text-white tabular-nums">
                            {Math.floor(smoothTimeRemaining / 60)}:{String(smoothTimeRemaining % 60).padStart(2, '0')}
                        </span>
                        <span className="text-[#916A47] text-[10px] uppercase font-bold tracking-widest ml-2">
                            {discussionState?.isMyTurn || isTestMode ? 'Your Speech' : `${currentSpeaker?.name || 'Player'} Speaking`}
                        </span>
                    </div>
                )}
                {currentRoomId && myPlayer && (
                    <div className="absolute right-[-70px] top-1/2 -translate-y-1/2">
                        <MicButton
                            roomId={`${currentRoomId}-day`}
                            userName={myPlayer.name}
                            isMyTurn={discussionState?.isMyTurn || false}
                        />
                    </div>
                )}
            </div>

            {sessionInvalid.bad && (
                <div className="w-full px-3 py-2 rounded-md border border-orange-500/40 bg-orange-500/10 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                    <p className="text-orange-200 text-[11px] leading-tight">
                        Session lost ({sessionInvalid.reason}). Game actions will require a wallet signature popup. Refresh the page or rejoin the room to restore auto-signing.
                    </p>
                </div>
            )}

            {(discussionState?.isMyTurn || isTestMode) && (
                <Button
                    onClick={onSkip}
                    disabled={isProcessing}
                    isLoading={isProcessing}
                    variant="outline-gold"
                    className="w-full h-[50px] font-['Cinzel'] tracking-[0.08em] text-[13px] uppercase"
                >
                    <ChevronRight className="w-5 h-5 mr-2" />
                    Finish Speech Early
                </Button>
            )}

            {isHost && (!discussionState?.isMyTurn || isTestMode) && (
                <Button
                    onClick={onSkip}
                    disabled={isProcessing}
                    isLoading={isProcessing}
                    variant="outline-gold"
                    className="w-full h-[50px] font-['Cinzel'] tracking-[0.08em] text-[13px] uppercase mt-2 !bg-[#121212] !border-[#6B6B6B]/60 !text-[#6B6B6B] hover:!bg-[#3D3D3D] hover:!border-[#3D3D3D] hover:!text-white"
                >
                    <ChevronRight className="w-5 h-5 mr-2" />
                    Force Skip (Host)
                </Button>
            )}
        </motion.div>
    );
};
