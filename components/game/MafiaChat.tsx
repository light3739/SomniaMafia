// components/game/MafiaChat.tsx
// Чат для координации мафии ночью

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, MessageCircle } from 'lucide-react';
import { Player, MafiaChatMessage } from '../../types';
import { useSoundEffects } from '../ui/SoundEffects';


interface MafiaChatProps {
    myName: string;
    teammates: `0x${string}`[]; // Addresses of fellow mafia
    players: Player[];
    selectedTarget: `0x${string}` | null;
    onSuggestTarget: (targetAddress: `0x${string}`) => void;
    // Context props
    messages: MafiaChatMessage[];
    onSendMessage: (content: MafiaChatMessage['content']) => Promise<void>;
}

export const MafiaChat = memo<MafiaChatProps>(function MafiaChat({
    myName,
    teammates,
    players,
    selectedTarget,
    onSuggestTarget,
    messages,
    onSendMessage
}) {
    const [lastSuggestion, setLastSuggestion] = useState<`0x${string}` | null>(null);
    const chatRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);
    const { playProposeSound, playRejectSound } = useSoundEffects();

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [messages]);

    // Send message wrapper
    const handleSendMessage = async (content: MafiaChatMessage['content']) => {
        setIsSending(true);
        try {
            await onSendMessage(content);
        } catch (e) {
            console.error("Failed to send message:", e);
        } finally {
            setIsSending(false);
        }
    };

    // Handle "+" agree (plays propose sound)
    const handleAgree = () => {
        if (selectedTarget) {
            const targetPlayer = players.find(p => p.address.toLowerCase() === selectedTarget.toLowerCase());
            if (targetPlayer) {
                playProposeSound();
                handleSendMessage({
                    type: 'agree',
                    targetName: targetPlayer.name
                });
                setLastSuggestion(selectedTarget);
                return;
            }
        }

        if (!lastSuggestion) return;
        playProposeSound();
        handleSendMessage({ type: 'agree' });
        // Also select the suggested target
        onSuggestTarget(lastSuggestion);
    };


    // Handle "-" disagree
    const handleDisagree = () => {
        if (selectedTarget) {
            const targetPlayer = players.find(p => p.address.toLowerCase() === selectedTarget.toLowerCase());
            if (targetPlayer) {
                playRejectSound();
                handleSendMessage({
                    type: 'disagree',
                    targetName: targetPlayer.name
                });
                return;
            }
        }

        playRejectSound();
        handleSendMessage({ type: 'disagree' });
    };


    // Render message content
    const renderMessage = (msg: MafiaChatMessage) => {
        switch (msg.content.type) {
            case 'suggest':
                return (
                    <span>
                        <span className="text-red-400 font-medium">{msg.playerName}</span>
                        <span className="text-white/50"> предлагает убить </span>
                        <span className="text-red-300 font-bold">{msg.content.targetName}</span>
                    </span>
                );
            case 'agree':
                return (
                    <span>
                        <span className="text-[#916A47] font-medium">{msg.playerName}</span>
                        {msg.content.targetName ? (
                            <span className="text-[#916A47]/70"> согласен убить {msg.content.targetName} </span>
                        ) : (
                            <span className="text-[#916A47]/70"> согласен </span>
                        )}
                        <Plus className="inline w-3 h-3 text-[#916A47]" />
                    </span>
                );
            case 'disagree':
                return (
                    <span>
                        <span className="text-red-400 font-medium">{msg.playerName}</span>
                        {msg.content.targetName ? (
                            <span className="text-red-400/70"> не поддерживает убийство {msg.content.targetName} </span>
                        ) : (
                            <span className="text-red-400/70"> против </span>
                        )}
                        <Minus className="inline w-3 h-3 text-red-400" />
                    </span>
                );
            case 'text':
                return (
                    <span>
                        <span className="text-white/70 font-medium">{msg.playerName}: </span>
                        <span className="text-white/90">{msg.content.text}</span>
                    </span>
                );
            default:
                return <span className="text-white/50">Unknown message</span>;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-rose-950/20 border border-rose-500/20 rounded-2xl overflow-hidden relative"
        >
            {/* Header with action buttons */}
            <div className="flex items-center justify-between p-3 border-b border-rose-500/20 bg-rose-950/30">
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-rose-400 text-sm font-medium">Mafia Chat</span>
                    {isSending && <span className="text-xs text-white/30 animate-pulse">Sending...</span>}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                    {/* Agree button */}
                    <button
                        onClick={handleAgree}
                        disabled={(!lastSuggestion && !selectedTarget) || isSending}
                        data-custom-sound
                        className={`p-2 rounded-lg transition-all ${(lastSuggestion || selectedTarget)
                            ? 'bg-white/5 text-[#916A47] hover:bg-[#916A47]/20'
                            : 'bg-white/5 text-white/20 cursor-not-allowed'
                            }`}
                        title="Agree / Vote to Kill"
                    >
                        <Plus className="w-4 h-4" />
                    </button>

                    {/* Disagree button */}
                    <button
                        onClick={handleDisagree}
                        disabled={(!lastSuggestion && !selectedTarget) || isSending}
                        data-custom-sound
                        className={`p-2 rounded-lg transition-all ${(lastSuggestion || selectedTarget)
                            ? 'bg-white/5 text-rose-400 hover:bg-rose-500/20'
                            : 'bg-white/5 text-white/20 cursor-not-allowed'
                            }`}
                        title="Disagree / Against"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Chat messages */}
            <div
                ref={chatRef}
                className="h-[160px] overflow-y-auto p-3 space-y-2 mafia-chat-scroll"
            >
                {messages.length === 0 ? (
                    <p className="text-white/20 text-xs text-center py-8">
                        Select a player to suggest a target, or use +/- to vote.
                    </p>
                ) : (
                    messages.map(msg => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-xs"
                        >
                            {renderMessage(msg)}
                        </motion.div>
                    ))
                )}
            </div>
        </motion.div>
    );
});
