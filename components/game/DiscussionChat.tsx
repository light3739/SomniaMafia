"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Lock, Loader2 } from 'lucide-react';
import { useGameContext } from '@/contexts/GameContext';
import { GamePhase } from '@/types';
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client';
import { useSoundEffects } from '@/components/ui/SoundEffects';
import { useWalletClient } from 'wagmi';
import { signRequest } from '@/services/requestSigning';
import { buildTokenMessage } from '@/services/signingSchema';

interface ChatMessage {
    id: string;
    sender: string;
    senderAddress: string;
    content: string;
    timestamp: number;
}

// Text encoder/decoder for data channel
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function normalizeLiveKitWsUrl(rawUrl?: string): string {
    if (!rawUrl) return 'wss://livekit.mafiaonchain.live';
    if (rawUrl.startsWith('wss://') || rawUrl.startsWith('ws://')) return rawUrl;
    if (rawUrl.startsWith('https://')) return rawUrl.replace('https://', 'wss://');
    if (rawUrl.startsWith('http://')) return rawUrl.replace('http://', 'ws://');
    return `wss://${rawUrl}`;
}

// Chat toggle button component with integrated chat panel AND LiveKit connection
export const ChatToggleButton: React.FC<{
    isExpanded: boolean;
    onToggle: () => void;
    unreadCount?: number;
    canWrite?: boolean;
}> = ({ isExpanded, onToggle, unreadCount = 0, canWrite = false }) => {
    const { gameState, myPlayer, currentRoomId } = useGameContext();
    const { data: walletClient } = useWalletClient();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const roomRef = useRef<Room | null>(null);
    const prevMessagesCountRef = useRef(0);
    const { playChatMessageSound } = useSoundEffects();
    const [internalUnreadCount, setInternalUnreadCount] = useState(0);
    const livekitServerUrl = normalizeLiveKitWsUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL);

    // Reset unread count when chat is opened
    useEffect(() => {
        if (isExpanded) {
            setInternalUnreadCount(0);
        }
    }, [isExpanded]);

    // Play sound and track unread when new message arrives (not from self)
    useEffect(() => {
        if (messages.length > prevMessagesCountRef.current) {
            const lastMsg = messages[messages.length - 1];
            // Only for messages from others
            if (lastMsg && lastMsg.senderAddress.toLowerCase() !== myPlayer?.address.toLowerCase()) {
                playChatMessageSound();
                // Increment unread count when chat is closed
                if (!isExpanded) {
                    setInternalUnreadCount(prev => prev + 1);
                }
            }
        }
        prevMessagesCountRef.current = messages.length;
    }, [messages, myPlayer?.address, playChatMessageSound, isExpanded]);

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
            console.error('[ChatToggleButton] Failed to parse message:', e);
        }
    }, []);

    // Store username in ref to avoid dependency issues
    const userNameRef = useRef(myPlayer?.name || 'Player');
    useEffect(() => {
        userNameRef.current = myPlayer?.name || 'Player';
    }, [myPlayer?.name]);

    // Connect to LiveKit room for data channel
    useEffect(() => {
        // Connect in background regardless of isExpanded state
        if (!currentRoomId || gameState.phase !== GamePhase.DAY) {
            return;
        }

        // Skip if already connected or connecting
        if (roomRef.current) {
            console.log('[ChatToggleButton] Already have room instance, skipping connect');
            return;
        }

        let cancelled = false;

        const connect = async () => {
            console.log('[ChatToggleButton] Starting connection...');
            setIsConnecting(true);

            try {
                // Get token from API (same room as voice chat)
                const roomName = `${currentRoomId}-day`;
                console.log('[ChatToggleButton] Getting token for room:', roomName);

                const playerAddress = myPlayer?.address || '';
                const username = `${userNameRef.current}_chat`;

                let signature: `0x${string}` | undefined;
                let signerAddress: string | undefined;
                let nonce: string | undefined;
                let timestamp: number | undefined;

                if (playerAddress) {
                    const signed = await signRequest({
                        address: playerAddress,
                        roomId: Number(currentRoomId),
                        walletClient,
                        buildMessage: ({ nonce, timestamp }) => buildTokenMessage({
                            room: roomName,
                            username,
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

                const resp = await fetch('/api/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        room: roomName,
                        // Add _chat suffix to avoid DUPLICATE_IDENTITY with MicButton
                        username,
                        playerAddress,
                        signerAddress,
                        signature,
                        nonce,
                        timestamp,
                    })
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(`Failed to get token: ${resp.status} - ${text}`);
                }

                const data = await resp.json();
                if (data.error) throw new Error(data.error);

                if (cancelled) {
                    console.log('[ChatToggleButton] Cancelled before connect');
                    return;
                }

                console.log('[ChatToggleButton] Got token, creating room...');

                // Create room connection
                const room = new Room({
                    adaptiveStream: false,
                    dynacast: false,
                });

                room.on(RoomEvent.Connected, () => {
                    if (!cancelled) {
                        console.log('[ChatToggleButton] Connected to room!');
                        setIsConnected(true);
                        setIsConnecting(false);
                    }
                });

                room.on(RoomEvent.Disconnected, () => {
                    if (!cancelled) {
                        console.log('[ChatToggleButton] Disconnected from room');
                        setIsConnected(false);
                    }
                });

                // Handle incoming data messages
                room.on(RoomEvent.DataReceived, (payload, participant) => {
                    handleDataReceived(payload, participant);
                });

                roomRef.current = room;

                // Connect to room (only data, no audio/video)
                console.log('[ChatToggleButton] Connecting to LiveKit...');
                await room.connect(livekitServerUrl, data.token, {
                    autoSubscribe: true
                });
                console.log('[ChatToggleButton] room.connect() completed');

            } catch (e: any) {
                const message = String(e?.message || '');
                const isExpectedCleanupError =
                    cancelled ||
                    message.includes('Client initiated disconnect') ||
                    message.includes('UnexpectedConnectionState') ||
                    message.includes('PC manager is closed');

                if (!isExpectedCleanupError) {
                    console.error('[ChatToggleButton] Connection error:', e);
                } else {
                    console.log('[ChatToggleButton] Connection closed during cleanup.');
                }

                if (!cancelled) {
                    setIsConnecting(false);
                }
            }
        };

        connect();

        return () => {
            console.log('[ChatToggleButton] Cleanup called');
            cancelled = true;
            if (roomRef.current) {
                roomRef.current.disconnect();
                roomRef.current = null;
            }
        };
    }, [currentRoomId, gameState.phase, handleDataReceived, myPlayer?.address, walletClient]);

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
            console.error('[ChatToggleButton] Failed to send message:', e);
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
        <div className="relative flex flex-col items-end">
            {/* Chat Panel - expands upward from button */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, scaleY: 0 }}
                        animate={{ opacity: 1, height: 384, scaleY: 1 }}
                        exit={{ opacity: 0, height: 0, scaleY: 0 }}
                        transition={{
                            duration: 0.25,
                            ease: 'easeOut',
                            opacity: { duration: 0.15 }
                        }}
                        style={{ originY: 1, transformOrigin: 'bottom' }}
                        className="absolute bottom-14 right-0 w-80 mb-2 bg-[#050505] border border-white/5 rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col z-[99]"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[#916A47]/15 bg-[#0A0908]">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-medium text-sm">Discussion Chat</span>
                                {isConnecting && (
                                    <Loader2 className="w-3 h-3 text-[#916A47] animate-spin" />
                                )}
                                {isConnected && (
                                    <span className="w-2 h-2 bg-[#3D5A3E] rounded-full" title="Connected" />
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
                                                className={`max-w-[80%] px-3 py-2 rounded-sm text-sm border ${isMe
                                                    ? 'bg-[#1A130A] border-[#916A47]/50 text-white/90'
                                                    : 'bg-[#0A0A0A] border-white/10 text-white/70'
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
                        <div className="p-3 border-t border-[#916A47]/15 bg-[#0A0908]">
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

            {/* Toggle Button Container - matches Sound Panel style */}
            <div className={`
                pointer-events-auto flex items-center justify-center p-1.5 
                bg-[#0A0A0A] border rounded-md shadow-xl
                transition-all hover:bg-[#1A130A]
                ${isExpanded ? 'border-[#916A47]' : internalUnreadCount > 0 ? 'border-[#916A47]/60 shadow-[0_0_12px_rgba(145,106,71,0.3)]' : 'border-white/5 hover:border-[#916A47]/40'}
            `}>
                <button
                    onClick={onToggle}
                    className={`
                        w-10 h-10 flex items-center justify-center rounded-sm transition-all relative
                        ${isExpanded
                            ? 'bg-[#916A47] text-white'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                        }
                    `}
                    title="Discussion Chat"
                >
                    <MessageCircle size={20} />
                    {internalUnreadCount > 0 && !isExpanded && (
                        <>
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-bounce">
                                {internalUnreadCount > 9 ? '9+' : internalUnreadCount}
                            </span>
                            {/* Pulsing ring for attention */}
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-ping opacity-50" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

// Keep DiscussionChat export for backward compatibility but it doesn't render anything
// All functionality is now in ChatToggleButton
export const DiscussionChat: React.FC<{
    isExpanded: boolean;
    onToggle: () => void;
    canWrite: boolean;
}> = () => null;
