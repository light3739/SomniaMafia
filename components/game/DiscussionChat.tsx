"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Lock } from 'lucide-react';
import { useGameContext } from '@/contexts/GameContext';
import { GamePhase } from '@/types';

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

export const DiscussionChat: React.FC<DiscussionChatProps> = ({ isExpanded, onToggle, canWrite }) => {
    const { gameState, myPlayer, currentRoomId } = useGameContext();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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

    // Fetch messages from server
    const fetchMessages = useCallback(async () => {
        if (!currentRoomId) return;
        try {
            const response = await fetch(`/api/game/chat?roomId=${currentRoomId}&dayCount=${gameState.dayCount}`);
            if (response.ok) {
                const data = await response.json();
                setMessages(data.messages || []);
            }
        } catch (e) {
            console.error('[DiscussionChat] Failed to fetch messages:', e);
        }
    }, [currentRoomId, gameState.dayCount]);

    // Poll for new messages
    useEffect(() => {
        if (!isExpanded || gameState.phase !== GamePhase.DAY) return;

        fetchMessages();
        const interval = setInterval(fetchMessages, 2000);
        return () => clearInterval(interval);
    }, [isExpanded, gameState.phase, fetchMessages]);

    // Send message
    const handleSend = async () => {
        if (!inputValue.trim() || !canWrite || !currentRoomId || !myPlayer) return;

        const messageContent = inputValue.trim();
        setInputValue('');
        setIsSending(true);

        try {
            const response = await fetch('/api/game/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: currentRoomId.toString(),
                    dayCount: gameState.dayCount,
                    senderAddress: myPlayer.address,
                    senderName: myPlayer.name,
                    content: messageContent
                })
            });

            if (response.ok) {
                // Optimistically add the message
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    sender: myPlayer.name,
                    senderAddress: myPlayer.address,
                    content: messageContent,
                    timestamp: Date.now()
                }]);
            }
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

    const unreadCount = 0; // Could implement unread logic later

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
                                No messages yet
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
                                    placeholder="Type a message..."
                                    maxLength={200}
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#916A47]/50 transition-all"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim() || isSending}
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
