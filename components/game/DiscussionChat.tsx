"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { useGameContext } from '@/contexts/GameContext';
import { GamePhase } from '@/types';
import { useAppMessage, useDaily, useMeetingState } from '@daily-co/daily-react';
import { useSoundEffects } from '@/components/ui/SoundEffects';

interface ChatMessage {
    id: string;
    sender: string;
    senderAddress: string;
    content: string;
    timestamp: number;
}

type IncomingChat = {
    type?: string;
    senderName?: string;
    senderAddress?: string;
    content?: string;
    timestamp?: number;
};

export const ChatToggleButton: React.FC<{
    isExpanded: boolean;
    onToggle: () => void;
    unreadCount?: number;
    canWrite?: boolean;
}> = ({ isExpanded, onToggle, canWrite = false }) => {
    const { gameState, myPlayer } = useGameContext();
    const call = useDaily();
    const meetingState = useMeetingState();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const prevMessagesCountRef = useRef(0);
    const { playChatMessageSound } = useSoundEffects();
    const [internalUnreadCount, setInternalUnreadCount] = useState(0);

    const isConnected = meetingState === 'joined-meeting';
    const isConnecting = meetingState === 'joining-meeting' || meetingState === 'loading';

    useEffect(() => {
        if (isExpanded) setInternalUnreadCount(0);
    }, [isExpanded]);

    useEffect(() => {
        if (messages.length > prevMessagesCountRef.current) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.senderAddress.toLowerCase() !== myPlayer?.address.toLowerCase()) {
                playChatMessageSound();
                if (!isExpanded) setInternalUnreadCount((prev) => prev + 1);
            }
        }
        prevMessagesCountRef.current = messages.length;
    }, [messages, myPlayer?.address, playChatMessageSound, isExpanded]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isExpanded && canWrite && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded, canWrite]);

    useEffect(() => {
        if (gameState.phase !== GamePhase.DAY) {
            setMessages([]);
        }
    }, [gameState.phase]);

    useAppMessage<IncomingChat>({
        onAppMessage: (ev) => {
            const data = ev?.data;
            if (!data || data.type !== 'discussion-chat' || typeof data.content !== 'string') return;
            const senderAddress = String(data.senderAddress ?? ev.fromId ?? '').toLowerCase();
            if (!senderAddress || senderAddress === myPlayer?.address.toLowerCase()) return;
            setMessages((prev) => {
                const id = `${data.timestamp ?? Date.now()}_${senderAddress}`;
                if (prev.some((m) => m.id === id)) return prev;
                return [
                    ...prev,
                    {
                        id,
                        sender: data.senderName || senderAddress.slice(0, 8),
                        senderAddress,
                        content: data.content ?? '',
                        timestamp: data.timestamp ?? Date.now(),
                    },
                ];
            });
        },
    });

    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || !canWrite || !call || !myPlayer) return;
        const content = inputValue.trim();
        const timestamp = Date.now();
        setInputValue('');
        setIsSending(true);
        try {
            call.sendAppMessage({
                type: 'discussion-chat',
                senderName: myPlayer.name,
                senderAddress: myPlayer.address,
                content,
                timestamp,
            }, '*');
            setMessages((prev) => [
                ...prev,
                {
                    id: `${timestamp}_${myPlayer.address}`,
                    sender: myPlayer.name,
                    senderAddress: myPlayer.address,
                    content,
                    timestamp,
                },
            ]);
        } finally {
            setIsSending(false);
        }
    }, [call, canWrite, inputValue, myPlayer]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
        }
    };

    return (
        <div className="relative flex flex-col items-end">
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, scaleY: 0 }}
                        animate={{ opacity: 1, height: 384, scaleY: 1 }}
                        exit={{ opacity: 0, height: 0, scaleY: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut', opacity: { duration: 0.15 } }}
                        style={{ originY: 1, transformOrigin: 'bottom' }}
                        className="absolute bottom-14 right-0 w-80 mb-2 bg-[#050505] border border-white/5 rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col z-[99]"
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[#916A47]/15 bg-[#0A0908]">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-medium text-sm">Discussion Chat</span>
                                {isConnecting && <Loader2 className="w-3 h-3 text-[#916A47] animate-spin" />}
                                {isConnected && <span className="w-2 h-2 bg-[#3D5A3E] rounded-full" title="Connected" />}
                            </div>
                            <button
                                onClick={onToggle}
                                className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {messages.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-white/60 text-sm">
                                    {isConnecting ? 'Connecting...' : 'No messages yet'}
                                </div>
                            ) : (
                                messages.map((msg, idx, all) => {
                                    const isMe = msg.senderAddress.toLowerCase() === myPlayer?.address.toLowerCase();
                                    const sameSenderAsPrev = idx > 0 && all[idx - 1].senderAddress === msg.senderAddress;
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${sameSenderAsPrev ? 'mt-0.5' : ''}`}
                                        >
                                            {!sameSenderAsPrev && (
                                                <span className="text-[10px] text-white/60 mb-0.5 px-2">{msg.sender}</span>
                                            )}
                                            <div
                                                className={`max-w-[80%] px-3 py-2 rounded-sm text-sm border ${isMe
                                                    ? 'bg-[#1A130A] border-[#916A47]/50 text-white/90'
                                                    : 'bg-[#0A0A0A] border-white/10 text-white/70'}
                                                `}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-3 border-t border-[#916A47]/15 bg-[#0A0908]">
                            {canWrite ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
                                        disabled={!isConnected}
                                        maxLength={200}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:border-[#916A47]/50 transition-all disabled:opacity-50"
                                    />
                                    <button
                                        onClick={() => void handleSend()}
                                        disabled={!inputValue.trim() || isSending || !isConnected}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#916A47] text-white hover:bg-[#a5784f] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 py-2 text-white/60 text-sm">
                                    <Lock className="w-4 h-4" />
                                    <span>Wait for your turn to speak</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`
                pointer-events-auto flex items-center justify-center p-1.5
                bg-[#0A0A0A] border rounded-md shadow-xl
                transition-all hover:bg-[#1A130A]
                ${isExpanded ? 'border-[#916A47]' : internalUnreadCount > 0 ? 'border-[#916A47]/60 shadow-[0_0_12px_rgba(145,106,71,0.3)]' : 'border-[#916A47]/30 hover:border-[#916A47]/60'}
            `}>
                <button
                    onClick={onToggle}
                    className={`
                        w-10 h-10 flex items-center justify-center rounded-sm transition-all relative
                        ${isExpanded ? 'bg-[#916A47] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}
                    `}
                    title="Discussion Chat"
                >
                    <MessageCircle size={20} />
                    {internalUnreadCount > 0 && !isExpanded && (
                        <>
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-bounce">
                                {internalUnreadCount > 9 ? '9+' : internalUnreadCount}
                            </span>
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full animate-ping opacity-50" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export const DiscussionChat: React.FC<{
    isExpanded: boolean;
    onToggle: () => void;
    canWrite: boolean;
}> = () => null;
