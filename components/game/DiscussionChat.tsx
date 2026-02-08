"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Lock, Loader2 } from 'lucide-react';
import { useGameContext } from '@/contexts/GameContext';
import { GamePhase } from '@/types';
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client';

interface ChatMessage {
    id: string;
    sender: string;
    senderAddress: string;
    content: string;
    timestamp: number;
}

interface DiscussionChatProps {
    isExpanded: boolean;
    onToggle: () => void;
    canWrite: boolean; // true if it's my turn during discussion
}

// Text encoder/decoder for data channel
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const DiscussionChat: React.FC<DiscussionChatProps> = ({ isExpanded, onToggle, canWrite }) => {
    const { gameState, myPlayer, currentRoomId } = useGameContext();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const roomRef = useRef<Room | null>(null);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when expanded and can write
    useEffect(() => {
        if (isExpanded && canWrite && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded, canWrite]);

    // Handle incoming data messages
    const handleDataReceived = useCallback((payload: Uint8Array, participant: any) => {
        try {
            const messageStr = decoder.decode(payload);
            const data = JSON.parse(messageStr);

            if (data.type === 'chat') {
                const newMessage: ChatMessage = {
                    id: `${Date.now()}_${participant?.identity || 'unknown'}`,
                    sender: data.senderName,
                    senderAddress: data.senderAddress,
                    content: data.content,
                    timestamp: data.timestamp
                };

                setMessages(prev => {
                    // Avoid duplicates
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
            }
        } catch (e) {
            console.error('[DiscussionChat] Failed to parse message:', e);
        }
    }, []);

    // Connect to LiveKit room for data channel
    useEffect(() => {
        if (!isExpanded || !currentRoomId || gameState.phase !== GamePhase.DAY) {
            return;
        }

        let cancelled = false;

        const connect = async () => {
            if (roomRef.current?.state === 'connected') return;

            setIsConnecting(true);

            try {
                // Get token from API (same room as voice chat)
                const roomName = `${currentRoomId}-day`;
                const resp = await fetch('/api/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        room: roomName,
                        username: (myPlayer?.name || 'Player') + '_chat'
                    })
                });

                if (!resp.ok) throw new Error('Failed to get token');

                const data = await resp.json();
                if (data.error) throw new Error(data.error);

                if (cancelled) return;

                // Create room connection
                const room = new Room({
                    adaptiveStream: false,
                    dynacast: false,
                });

                room.on(RoomEvent.Connected, () => {
                    if (!cancelled) {
                        setIsConnected(true);
                        setIsConnecting(false);
                        console.log('[DiscussionChat] Connected to room');
                    }
                });

                room.on(RoomEvent.Disconnected, () => {
                    if (!cancelled) {
                        setIsConnected(false);
                        console.log('[DiscussionChat] Disconnected from room');
                    }
                });

                // Handle incoming data messages
                room.on(RoomEvent.DataReceived, (payload, participant) => {
                    handleDataReceived(payload, participant);
                });

                roomRef.current = room;

                // Connect to room (only data, no audio/video)
                await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, data.token, {
                    autoSubscribe: true
                });

            } catch (e) {
                console.error('[DiscussionChat] Connection error:', e);
                if (!cancelled) {
                    setIsConnecting(false);
                }
            }
        };

        connect();

        return () => {
            cancelled = true;
            // Don't disconnect - MicButton might be using the same room
            // roomRef.current?.disconnect();
        };
    }, [isExpanded, currentRoomId, gameState.phase, myPlayer?.name, handleDataReceived]);

    // Clean up on phase change
    useEffect(() => {
        if (gameState.phase !== GamePhase.DAY) {
            setMessages([]);
            if (roomRef.current) {
                roomRef.current.disconnect();
                roomRef.current = null;
            }
            setIsConnected(false);
        }
    }, [gameState.phase]);

    // Send message via LiveKit data channel
    const handleSend = async () => {
        if (!inputValue.trim() || !canWrite || !roomRef.current || !myPlayer) return;

        const messageContent = inputValue.trim();
        setInputValue('');
        setIsSending(true);

        try {
            const messageData = {
                type: 'chat',
                senderName: myPlayer.name,
                senderAddress: myPlayer.address,
                content: messageContent,
                timestamp: Date.now()
            };

            const payload = encoder.encode(JSON.stringify(messageData));

            // Send to all participants (reliable)
            await roomRef.current.localParticipant.publishData(payload, {
                reliable: true
            });

            // Add to local messages
            setMessages(prev => [...prev, {
                id: `${Date.now()}_${myPlayer.address}`,
                sender: myPlayer.name,
                senderAddress: myPlayer.address,
                content: messageContent,
                timestamp: Date.now()
            }]);

        } catch (e) {
            console.error('[DiscussionChat] Failed to send message:', e);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <AnimatePresence>
            {isExpanded && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed bottom-20 right-6 z-[99] w-80 h-96 bg-black/90 backdrop-blur-2xl border border-[#916A47]/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-[#916A47]" />
                            <span className="text-white font-medium text-sm">Discussion Chat</span>
                            {isConnecting && (
                                <Loader2 className="w-3 h-3 text-[#916A47] animate-spin" />
                            )}
                            {isConnected && (
                                <span className="w-2 h-2 bg-green-500 rounded-full" title="Connected" />
                            )}
                        </div>
                        <button
                            onClick={onToggle}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-white/30 text-sm">
                                {isConnecting ? 'Connecting...' : 'No messages yet'}
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.senderAddress.toLowerCase() === myPlayer?.address.toLowerCase();
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                    >
                                        <span className="text-[10px] text-white/40 mb-0.5 px-2">
                                            {msg.sender}
                                        </span>
                                        <div
                                            className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isMe
                                                ? 'bg-[#916A47] text-white rounded-br-md'
                                                : 'bg-white/10 text-white/90 rounded-bl-md'
                                                }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-white/10 bg-black/40">
                        {canWrite ? (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={isConnected ? "Type a message..." : "Connecting..."}
                                    disabled={!isConnected}
                                    maxLength={200}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#916A47]/50 transition-all disabled:opacity-50"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim() || isSending || !isConnected}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#916A47] text-white hover:bg-[#a5784f] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 py-2 text-white/40 text-sm">
                                <Lock className="w-4 h-4" />
                                <span>Wait for your turn to speak</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Chat toggle button component (to be placed next to sound buttons)
export const ChatToggleButton: React.FC<{
    isExpanded: boolean;
    onToggle: () => void;
    unreadCount?: number;
}> = ({ isExpanded, onToggle, unreadCount = 0 }) => {
    return (
        <button
            onClick={onToggle}
            className={`
                w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 relative
                ${isExpanded ? 'bg-[#916A47] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}
            `}
            title="Discussion Chat"
        >
            <MessageCircle size={20} />
            {unreadCount > 0 && !isExpanded && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
};
