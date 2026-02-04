"use client";

import { Chat } from "@livekit/components-react";
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

interface LiveKitChatProps {
    className?: string;
}

export function LiveKitChat({ className = '' }: LiveKitChatProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-purple-950/20 border border-purple-500/20 rounded-2xl overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="flex items-center gap-2 p-3 border-b border-purple-500/20 bg-purple-950/30">
                <MessageCircle className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 text-sm font-medium">Text Chat</span>
            </div>

            {/* LiveKit Chat Component */}
            <div className="livekit-chat-container">
                <Chat
                    style={{
                        height: '200px',
                        background: 'transparent',
                        border: 'none',
                    }}
                    className="livekit-chat-custom"
                />
            </div>

            {/* Custom Styles */}
            <style jsx global>{`
                .livekit-chat-container {
                    --lk-bg: transparent;
                    --lk-bg2: rgba(168, 85, 247, 0.05);
                    --lk-fg: rgba(255, 255, 255, 0.9);
                    --lk-fg2: rgba(255, 255, 255, 0.6);
                    --lk-border-color: rgba(168, 85, 247, 0.2);
                    --lk-control-bg: rgba(0, 0, 0, 0.4);
                    --lk-control-hover-bg: rgba(168, 85, 247, 0.2);
                }
                
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
        </motion.div>
    );
}
