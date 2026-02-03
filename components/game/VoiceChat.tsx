// components/game/VoiceChat.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, X, Loader2, Users } from 'lucide-react';

interface VoiceChatProps {
    roomId: string;
    userName?: string;
    isActive: boolean;
    label?: string;
    className?: string;
    onClose?: () => void;
}

export function VoiceChat({
    roomId,
    userName = 'Player',
    isActive,
    label = 'Voice Chat',
    className = '',
    onClose,
}: VoiceChatProps) {
    const [joinUrl, setJoinUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Fetch join URL from our API
    useEffect(() => {
        if (!isActive || !roomId) return;

        const fetchJoinUrl = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/voice/room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId, userName }),
                });

                if (!response.ok) {
                    throw new Error('Failed to create voice room');
                }

                const data = await response.json();

                if (data.success && data.joinUrl) {
                    setJoinUrl(data.joinUrl);
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
            } catch (err) {
                console.error('[VoiceChat] Error:', err);
                setError(err instanceof Error ? err.message : 'Failed to connect');
            } finally {
                setLoading(false);
            }
        };

        fetchJoinUrl();
    }, [roomId, userName, isActive]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (iframeRef.current) {
                iframeRef.current.src = 'about:blank';
            }
        };
    }, []);

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
                        {loading && (
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

                        {joinUrl && !loading && !error && (
                            <div className="relative">
                                <iframe
                                    ref={iframeRef}
                                    src={joinUrl}
                                    className="w-full h-[400px] rounded-lg border border-purple-500/20"
                                    allow="camera; microphone; display-capture; autoplay; clipboard-write"
                                    allowFullScreen
                                    title="Voice Chat"
                                />

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
