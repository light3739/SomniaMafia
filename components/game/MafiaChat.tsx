// components/game/MafiaChat.tsx
// Чат для координации мафии ночью

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Plus, Minus, Skull, MessageCircle } from 'lucide-react';
import { Player, MafiaChatMessage } from '../../types';
import { useSoundEffects } from '../ui/SoundEffects';

// Chat action mode
type ChatMode = 'none' | 'suggest';

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

export const MafiaChat: React.FC<MafiaChatProps> = ({
    myName,
    teammates,
    players,
    selectedTarget,
    onSuggestTarget,
    messages,
    onSendMessage
}) => {
    const [mode, setMode] = useState<ChatMode>('none');
    const [lastSuggestion, setLastSuggestion] = useState<`0x${string}` | null>(null);
    const chatRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);
    const { playProposeSound, playApproveSound, playRejectSound } = useSoundEffects();

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

    // Handle "?" button - enter suggest mode
    const handleSuggestMode = () => {
        if (mode === 'suggest') {
            setMode('none');
        } else {
            playProposeSound();
            setMode('suggest');
        }
    };

    // Handle clicking a player while in suggest mode
    const handlePlayerSelect = (targetAddress: `0x${string}`) => {
        if (mode !== 'suggest') return;

        const targetPlayer = players.find(p => p.address.toLowerCase() === targetAddress.toLowerCase());
        if (!targetPlayer) return;

        // Add suggestion message
        handleSendMessage({
            type: 'suggest',
            targetName: targetPlayer.name || targetPlayer.address.slice(0, 6)
        });

        // Set as last suggestion for voting (optimistic)
        setLastSuggestion(targetAddress);

        // Also set as selected target
        onSuggestTarget(targetAddress);

        // Exit suggest mode
        setMode('none');
    };

    // Handle "+" agree
    const handleAgree = () => {
        if (!lastSuggestion) return;
        playApproveSound();
        handleSendMessage({ type: 'agree' });
        // Also select the suggested target
        onSuggestTarget(lastSuggestion);
    };

    // Handle "-" disagree
    const handleDisagree = () => {
        playRejectSound();
        handleSendMessage({ type: 'disagree' });
    };

    // When selectedTarget changes in suggest mode, treat it as a suggestion
    useEffect(() => {
        if (mode === 'suggest' && selectedTarget) {
            handlePlayerSelect(selectedTarget);
        }
    }, [selectedTarget, mode]);

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
                        <span className="text-green-400 font-medium">{msg.playerName}</span>
                        <span className="text-green-400/70"> согласен </span>
                        <Plus className="inline w-3 h-3 text-green-400" />
                    </span>
                );
            case 'disagree':
                return (
                    <span>
                        <span className="text-red-400 font-medium">{msg.playerName}</span>
                        <span className="text-red-400/70"> против </span>
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
            className="mb-4 bg-red-950/20 border border-red-500/20 rounded-2xl overflow-hidden relative"
        >
            {/* Header with action buttons */}
            <div className="flex items-center justify-between p-3 border-b border-red-500/20 bg-red-950/30">
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-sm font-medium">Mafia Chat</span>
                    {isSending && <span className="text-xs text-white/30 animate-pulse">Sending...</span>}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                    {/* Suggest button */}
                    <button
                        onClick={handleSuggestMode}
                        data-custom-sound
                        className={`p-2 rounded-lg transition-all ${mode === 'suggest'
                            ? 'bg-yellow-500/30 text-yellow-300 ring-2 ring-yellow-500/50'
                            : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                            }`}
                        title="Предложить цель (кликните на игрока)"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>

                    {/* Agree button */}
                    <button
                        onClick={handleAgree}
                        disabled={!lastSuggestion || isSending}
                        data-custom-sound
                        className={`p-2 rounded-lg transition-all ${lastSuggestion
                            ? 'bg-white/5 text-green-400 hover:bg-green-500/20'
                            : 'bg-white/5 text-white/20 cursor-not-allowed'
                            }`}
                        title="Согласен с последним предложением"
                    >
                        <Plus className="w-4 h-4" />
                    </button>

                    {/* Disagree button */}
                    <button
                        onClick={handleDisagree}
                        disabled={!lastSuggestion || isSending}
                        data-custom-sound
                        className={`p-2 rounded-lg transition-all ${lastSuggestion
                            ? 'bg-white/5 text-red-400 hover:bg-red-500/20'
                            : 'bg-white/5 text-white/20 cursor-not-allowed'
                            }`}
                        title="Не согласен"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Suggest mode indicator */}
            <AnimatePresence>
                {mode === 'suggest' && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-[49px] left-0 right-0 z-10 bg-yellow-900/90 border-b border-yellow-500/20 px-3 py-2 backdrop-blur-sm"
                    >
                        <p className="text-yellow-300 text-xs flex items-center justify-center gap-2 font-medium">
                            <Skull className="w-3 h-3" />
                            Кликните на карточку игрока
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat messages */}
            <div
                ref={chatRef}
                className="h-[160px] overflow-y-auto p-3 space-y-2 mafia-chat-scroll"
            >
                {messages.length === 0 ? (
                    <p className="text-white/20 text-xs text-center py-8">
                        Выберите игрока для обсуждения и нажмите ?
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
};
