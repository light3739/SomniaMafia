"use client";

import React, { useState, useEffect } from 'react';
import { BackgroundMusic } from '../ui/BackgroundMusic';
import { ChatToggleButton } from './DiscussionChat';
import { useGameContext } from '@/contexts/GameContext';
import { GamePhase } from '@/types';

/**
 * GameUIOverlay - Renders game-specific UI elements that need GameContext access
 * Includes: BackgroundMusic with integrated Chat button
 */
export const GameUIOverlay: React.FC = () => {
    const { gameState, myPlayer, currentRoomId, isTxConfirming } = useGameContext();
    const [isChatExpanded, setIsChatExpanded] = useState(false);

    // Track if it's my turn during discussion
    const [isMyTurn, setIsMyTurn] = useState(false);

    // Poll discussion state
    useEffect(() => {
        if (gameState.phase !== GamePhase.DAY) {
            setIsMyTurn(false);
            return;
        }

        const fetchDiscussionState = async () => {
            if (!currentRoomId) {
                setIsMyTurn(false);
                return;
            }
            try {
                const response = await fetch(
                    `/api/game/discussion?roomId=${currentRoomId}&dayCount=${gameState.dayCount}&playerAddress=${myPlayer?.address || ''}`,
                    { cache: 'no-store' }
                );
                const data = await response.json();
                setIsMyTurn(data?.isMyTurn || false);
            } catch (e) {
                console.error('[GameUIOverlay] Failed to fetch discussion state:', e);
            }
        };

        fetchDiscussionState();
        const interval = setInterval(fetchDiscussionState, 2000);
        return () => clearInterval(interval);
    }, [currentRoomId, gameState.phase, gameState.dayCount, myPlayer?.address]);

    // Only show chat button during DAY phase
    const showChatButton = gameState.phase === GamePhase.DAY;

    // Can write only during my turn in discussion (DAY phase)
    const canWrite = isMyTurn && gameState.phase === GamePhase.DAY;

    // Auto-open chat when DAY phase starts
    useEffect(() => {
        if (gameState.phase === GamePhase.DAY) {
            setIsChatExpanded(true);
        } else {
            setIsChatExpanded(false);
        }
    }, [gameState.phase]);

    return (
        <>
            {/* Subtle confirming indicator — shows when TXs are being confirmed in background */}
            {isTxConfirming && gameState.phase !== GamePhase.SHUFFLING && gameState.phase !== GamePhase.REVEAL && gameState.phase !== GamePhase.LOBBY && (
                <div className="fixed top-2 right-2 z-[200] flex items-center gap-1.5 px-3 py-1.5 bg-yellow-900/60 border border-yellow-500/30 rounded-full backdrop-blur-sm">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    <span className="text-yellow-300/80 text-[11px] font-medium">Confirming...</span>
                </div>
            )}
            {/* Background Music with Chat Button (chat panel is integrated in ChatToggleButton) */}
            <BackgroundMusic
                additionalButtons={
                    showChatButton ? (
                        <ChatToggleButton
                            isExpanded={isChatExpanded}
                            onToggle={() => setIsChatExpanded(!isChatExpanded)}
                            canWrite={canWrite}
                        />
                    ) : undefined
                }
            />
        </>
    );
};
