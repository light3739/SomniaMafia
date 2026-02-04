"use client";

import { LiveKitRoom, RoomAudioRenderer, ControlBar } from "@livekit/components-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, X, Loader2, Users } from 'lucide-react';

interface LiveKitVoiceChatProps {
    roomId: string;
    userName?: string;
    isActive: boolean;
    label?: string;
    className?: string;
    onClose?: () => void;
}

export function LiveKitVoiceChat({
    roomId,
    userName = 'Player',
    isActive,
    label = 'Voice Chat',
    className = '',
    onClose,
}: LiveKitVoiceChatProps) {
    const [token, setToken] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        if (!isActive || !roomId) {
            setToken("");
            return;
        }

        (async () => {
            try {
                setError(null);
                const resp = await fetch("/api/token", {
                    method: "POST",
                    body: JSON.stringify({ room: roomId, username: userName }),
                    headers: { "Content-Type": "application/json" },
                });

                if (!resp.ok) {
                    throw new Error(`Failed to get token: ${resp.status}`);
                }

                const data = await resp.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                setToken(data.token);
            } catch (e) {
                console.error('[LiveKitVoiceChat] Error:', e);
                setError(e instanceof Error ? e.message : 'Failed to connect');
            }
        })();
    }, [isActive, roomId, userName]);

    if (!isActive) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`bg-gray-900/95 border border-purple-500/30 rounded-lg shadow-2xl ${className}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20">
                    <div className="flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-white">{label}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                            title={isMinimized ? 'Expand' : 'Minimize'}
                        >
                            <span className="text-purple-400 text-sm">
                                {isMinimized ? '▲' : '▼'}
                            </span>
                        </button>

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                title="Close"
                            >
                                <X className="w-4 h-4 text-red-400" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {!isMinimized && (
                    <div className="p-4">
                        {!token && !error && (
                            <div className="flex flex-col items-center justify-center py-8 gap-3">
                                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                                <p className="text-gray-400 text-sm">Connecting to voice...</p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                                <p className="text-red-400 text-sm">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="mt-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 text-sm transition-colors"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {token && !error && (
                            <div className="relative">
                                <LiveKitRoom
                                    video={false}
                                    audio={true}
                                    token={token}
                                    serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
                                    data-lk-theme="default"
                                    style={{
                                        minHeight: '200px',
                                        background: 'transparent',
                                    }}
                                    className="livekit-room-custom"
                                >
                                    <RoomAudioRenderer />
                                    <ControlBar
                                        controls={{
                                            camera: false,
                                            screenShare: false,
                                            chat: false,
                                        }}
                                        className="bg-gray-800/50 rounded-lg"
                                    />
                                </LiveKitRoom>

                                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                                    <Users className="w-3 h-3" />
                                    <span>Voice room: {roomId}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
