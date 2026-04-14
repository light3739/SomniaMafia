"use client";

import { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import {
    useDaily,
    useLocalSessionId,
    useMeetingState,
    useParticipantProperty,
} from '@daily-co/daily-react';

interface MicButtonProps {
    roomId?: string;
    userName?: string;
    isMyTurn: boolean;
    freeTalk?: boolean;
    className?: string;
}

export function MicButton({
    isMyTurn,
    freeTalk = false,
    className = '',
}: MicButtonProps) {
    const call = useDaily();
    const meetingState = useMeetingState();
    const localSessionId = useLocalSessionId();
    const audioState = useParticipantProperty(localSessionId ?? '', 'tracks.audio.state') as string | undefined;
    const isMuted = audioState !== 'playable' && audioState !== 'sendable';
    const isConnected = meetingState === 'joined-meeting';
    const isConnecting = meetingState === 'joining-meeting' || meetingState === 'loading';

    const canSpeak = freeTalk || isMyTurn;

    const toggleMic = useCallback(() => {
        if (!call || !canSpeak || !isConnected) return;
        call.setLocalAudio(isMuted);
    }, [call, canSpeak, isConnected, isMuted]);

    useEffect(() => {
        if (!call || !isConnected) return;
        if (!freeTalk && !isMyTurn && !isMuted) {
            call.setLocalAudio(false);
        }
    }, [call, isConnected, freeTalk, isMyTurn, isMuted]);

    const isDisabled = !canSpeak || !isConnected;

    return (
        <div className={`relative ${className}`}>
            <motion.button
                onClick={toggleMic}
                disabled={isDisabled}
                className={`
                    relative w-14 h-14 rounded-full flex items-center justify-center
                    transition-all duration-300 shadow-lg
                    ${isDisabled
                        ? 'bg-gray-800/50 border border-gray-600/30 cursor-not-allowed opacity-50'
                        : isMuted
                            ? 'bg-[#111111] border-2 border-[#916A47]/40 hover:border-[#916A47]/80 hover:bg-[#1A1510]'
                            : 'bg-[#1A1510] border-2 border-[#916A47] shadow-[0_0_14px_rgba(145,106,71,0.35)]'
                    }
                `}
                whileHover={!isDisabled ? { scale: 1.05 } : {}}
                whileTap={!isDisabled ? { scale: 0.95 } : {}}
                title={
                    !isConnected ? 'Connecting...' :
                        !canSpeak ? 'Not your turn' :
                            isMuted ? 'Click to speak' : 'Speaking (click to mute)'
                }
            >
                <AnimatePresence>
                    {isConnecting && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 rounded-full border-2 border-[#916A47]/50 animate-ping"
                        />
                    )}
                </AnimatePresence>

                {!isMuted && canSpeak && isConnected && (
                    <span className="absolute inset-0 rounded-full bg-[#916A47]/30 animate-ping" />
                )}

                {isConnecting ? (
                    <Loader2 className="w-6 h-6 text-[#916A47] animate-spin" />
                ) : isMuted ? (
                    <MicOff className={`w-6 h-6 ${isDisabled ? 'text-gray-500' : 'text-[#916A47]/70'}`} />
                ) : (
                    <Mic className="w-6 h-6 text-[#C49A3C]" />
                )}
            </motion.button>
        </div>
    );
}
