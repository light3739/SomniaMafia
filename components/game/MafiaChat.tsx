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
                        <span className="text-white/50 font-medium">{msg.playerName}</span>
                        <span className="text-white/40 italic"> suggests terminating </span>
                        <span className="text-red-900/80 font-bold">{msg.content.targetName}</span>
                    </span>
                );
            case 'agree':
                return (
                    <span>
                        <span className="text-white/50 font-medium">{msg.playerName}</span>
                        {msg.content.targetName ? (
                            <span className="text-white/40 italic"> concurs: {msg.content.targetName} </span>
                        ) : (
                            <span className="text-white/40 italic"> concurs </span>
                        )}
                        <Plus className="inline w-3 h-3 text-white/70" />
                    </span>
                );
            case 'disagree':
                return (
                    <span>
                        <span className="text-white/50 font-medium">{msg.playerName}</span>
                        {msg.content.targetName ? (
                            <span className="text-white/40 italic"> disputes: {msg.content.targetName} </span>
                        ) : (
                            <span className="text-white/40 italic"> disputes </span>
                        )}
                        <Minus className="inline w-3 h-3 text-white/70" />
                    </span>
                );
            case 'text':
                return (
                    <span>
                        <span className="text-white/50 font-medium">{msg.playerName}: </span>
                        <span className="text-white/70">{msg.content.text}</span>
                    </span>
                );
            default:
                return <span className="text-white/30">Unknown message</span>;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 bg-[#050505] border border-[#1a1a1a] rounded-md overflow-hidden relative shadow-2xl"
        >
            {/* Header with action buttons */}
            <div className="flex items-center justify-between p-3 border-b border-[#1a1a1a]/50 bg-[#080808]">
                <div className="flex items-center gap-2">
                    <span className="text-white/40 text-[10px] font-['Cinzel'] tracking-[0.2em] uppercase">Private Feed</span>
                    {isSending && <span className="text-[10px] text-white/10 animate-pulse ml-2">Transmitting...</span>}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                    {/* Agree button */}
                    <button
                        onClick={handleAgree}
                        disabled={(!lastSuggestion && !selectedTarget) || isSending}
                        data-custom-sound
                        className={`p-2 rounded-lg transition-all ${(lastSuggestion || selectedTarget)
                            ? 'bg-white/5 text-white/80 hover:bg-white/10'
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
                            ? 'bg-white/5 text-white/80 hover:bg-white/10'
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
