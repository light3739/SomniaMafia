"use client";

import { LiveKitRoom, RoomAudioRenderer, ControlBar, useRoomContext } from "@livekit/components-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, X, Loader2, Users } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import { signRequest } from '@/services/requestSigning';
import { buildTokenMessage } from '@/services/signingSchema';
import { ConnectionState, RoomEvent } from 'livekit-client';

interface VoiceChatMessage {
    id: string;
    sender: string;
    content: string;
    mine: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function normalizeLiveKitWsUrl(rawUrl?: string): string | undefined {
    if (!rawUrl) return undefined;
    if (rawUrl.startsWith('wss://') || rawUrl.startsWith('ws://')) return rawUrl;
    if (rawUrl.startsWith('https://')) return rawUrl.replace('https://', 'wss://');
    if (rawUrl.startsWith('http://')) return rawUrl.replace('http://', 'ws://');
    return `wss://${rawUrl}`;
}

function SafeTextChat({ displayName }: { displayName: string }) {
    const room = useRoomContext();
    const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>(room.state);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleConnectionStateChanged = (state: ConnectionState) => {
            setConnectionState(state);
            if (state === ConnectionState.Connected) {
                setChatError(null);
            }
        };

        room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
        return () => {
            room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
        };
    }, [room]);

    useEffect(() => {
        const handleData = (payload: Uint8Array, participant?: any) => {
            try {
                const text = decoder.decode(payload);
                const data = JSON.parse(text);
                if (data?.type !== 'chat' || typeof data?.content !== 'string') return;

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `${Date.now()}_${participant?.identity || 'unknown'}`,
                        sender: data.sender || participant?.identity || 'Player',
                        content: data.content,
                        mine: false,
                    },
                ]);
            } catch {
                // Ignore non-chat payloads
            }
        };

        room.on(RoomEvent.DataReceived, handleData);
        return () => {
            room.off(RoomEvent.DataReceived, handleData);
        };
    }, [room]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = useCallback(async () => {
        const content = input.trim();
        if (!content || sending) return;

        setSending(true);
        setChatError(null);
        try {
            const payload = encoder.encode(JSON.stringify({
                type: 'chat',
                sender: displayName || room.localParticipant?.identity || 'Player',
                content,
                timestamp: Date.now(),
            }));

            await room.localParticipant.publishData(payload, { reliable: true });

            setMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}_self`,
                    sender: 'You',
                    content,
                    mine: true,
                },
            ]);
            setInput('');
        } catch (error: any) {
            const message = String(error?.message || '');
            if (
                message.includes('UnexpectedConnectionState') ||
                message.includes('PC manager is closed') ||
                message.includes('Client initiated disconnect')
            ) {
                setChatError('Connection closed. Rejoin room to continue chat.');
                return;
            }
            setChatError('Failed to send message');
        } finally {
            setSending(false);
        }
    }, [displayName, input, room, sending]);

    return (
        <div className="mt-4 bg-purple-950/20 border border-purple-500/20 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-2 border-b border-purple-500/20 bg-purple-950/30">
                <span className="text-purple-400 text-xs font-medium">Text Chat</span>
                {connectionState !== ConnectionState.Connected && (
                    <span className="text-[10px] text-yellow-400/80 ml-auto">{String(connectionState).toLowerCase()}...</span>
                )}
            </div>

            <div className="h-[200px] overflow-y-auto p-2 space-y-2 livekit-chat-custom">
                {messages.length === 0 && (
                    <p className="text-xs text-white/40 text-center mt-16">No messages yet</p>
                )}
                {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs ${message.mine ? 'bg-purple-700/40 text-white' : 'bg-white/10 text-white/90'}`}>
                            <p className="text-[10px] text-purple-300 mb-1">{message.sender}</p>
                            <p>{message.content}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-2 border-t border-purple-500/20 flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                        }
                    }}
                    placeholder="Type a message"
                    className="flex-1 bg-black/40 border border-purple-500/30 rounded-lg text-white px-3 py-2 text-xs focus:outline-none"
                    maxLength={300}
                />
                <button
                    onClick={() => void sendMessage()}
                    disabled={sending || !input.trim()}
                    className="px-3 py-2 rounded-lg text-xs bg-purple-600/50 text-white disabled:opacity-40"
                >
                    Send
                </button>
            </div>
            {chatError && <p className="px-3 pb-2 text-[10px] text-red-300">{chatError}</p>}
        </div>
    );
}

interface LiveKitVoiceChatProps {
    roomId: string;
    userName?: string;
    isActive: boolean;
    label?: string;
    className?: string;
    onClose?: () => void;
    showTextChat?: boolean; // Show text chat alongside voice
}

export function LiveKitVoiceChat({
    roomId,
    userName = 'Player',
    isActive,
    label = 'Voice Chat',
    className = '',
    onClose,
    showTextChat = false,
}: LiveKitVoiceChatProps) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const [token, setToken] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [sessionIdentity, setSessionIdentity] = useState('');
    const livekitServerUrl = normalizeLiveKitWsUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL);

    useEffect(() => {
        const suffix = Math.random().toString(36).slice(2, 8);
        setSessionIdentity(`${userName}-${suffix}`);
    }, [userName]);

    useEffect(() => {
        if (!isActive || !roomId) {
            setToken("");
            return;
        }

        if (!sessionIdentity) return;

        (async () => {
            try {
                setError(null);
                const playerAddress = address || '';
                let signature: `0x${string}` | undefined;
                let signerAddress: string | undefined;
                let nonce: string | undefined;
                let timestamp: number | undefined;

                if (playerAddress) {
                    const roomIdPrefix = roomId.split('-')[0];
                    const parsedRoomId = Number(roomIdPrefix);
                    if (Number.isFinite(parsedRoomId)) {
                        const signed = await signRequest({
                            address: playerAddress,
                            roomId: parsedRoomId,
                            walletClient,
                            buildMessage: ({ nonce, timestamp }) => buildTokenMessage({
                                room: roomId,
                                username: userName,
                                playerAddress,
                                nonce,
                                timestamp,
                            }),
                        });
                        signature = signed.signature;
                        signerAddress = signed.signerAddress;
                        nonce = signed.nonce;
                        timestamp = signed.timestamp;
                    }
                }

                const resp = await fetch("/api/token", {
                    method: "POST",
                    body: JSON.stringify({
                        room: roomId,
                        username: sessionIdentity,
                        playerAddress,
                        signerAddress,
                        signature,
                        nonce,
                        timestamp,
                    }),
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
    }, [isActive, roomId, userName, address, walletClient, sessionIdentity]);

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
                                    serverUrl={livekitServerUrl}
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

                                    {showTextChat && <SafeTextChat displayName={userName} />}
                                </LiveKitRoom>

                                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                                    <Users className="w-3 h-3" />
                                    <span>Voice room: {roomId}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Custom Styles for Chat */}
                {showTextChat && (
                    <style jsx global>{`
                        .livekit-chat-custom {
                            font-family: inherit;
                        }
                        
                        .livekit-chat-custom input {
                            background: rgba(0, 0, 0, 0.4) !important;
                            border: 1px solid rgba(168, 85, 247, 0.3) !important;
                            border-radius: 8px !important;
                            color: white !important;
                            padding: 8px 12px !important;
                            font-size: 13px !important;
                        }
                        
                        .livekit-chat-custom input::placeholder {
                            color: rgba(255, 255, 255, 0.3) !important;
                        }
                        
                        .livekit-chat-custom input:focus {
                            outline: none !important;
                            border-color: rgba(168, 85, 247, 0.5) !important;
                        }
                        
                        .livekit-chat-custom button {
                            background: rgba(168, 85, 247, 0.3) !important;
                            border-radius: 8px !important;
                            color: rgba(168, 85, 247, 1) !important;
                            transition: all 0.2s !important;
                        }
                        
                        .livekit-chat-custom button:hover {
                            background: rgba(168, 85, 247, 0.4) !important;
                        }
                        
                        .livekit-chat-custom [data-lk-message] {
                            padding: 6px 12px !important;
                            margin: 4px 0 !important;
                            border-radius: 8px !important;
                            background: rgba(168, 85, 247, 0.05) !important;
                            font-size: 13px !important;
                        }
                        
                        .livekit-chat-custom [data-lk-message-body] {
                            color: rgba(255, 255, 255, 0.9) !important;
                        }
                        
                        .livekit-chat-custom [data-lk-message-sender] {
                            color: rgba(168, 85, 247, 0.8) !important;
                            font-weight: 600 !important;
                            font-size: 12px !important;
                        }
                    `}</style>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
