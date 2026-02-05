"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BackgroundMusic } from '../ui/BackgroundMusic';
import { DiscussionChat, ChatToggleButton } from './DiscussionChat';
import { useGameContext } from '@/contexts/GameContext';
import { GamePhase } from '@/types';

/**
 * GameUIOverlay - Renders game-specific UI elements that need GameContext access
 * Includes: BackgroundMusic with integrated Chat button
 */
export const GameUIOverlay: React.FC = () => {
    const { gameState, myPlayer, currentRoomId } = useGameContext();
    const [isChatExpanded, setIsChatExpanded] = useState(false);

    // Track if it's my turn during discussion
    const [isMyTurn, setIsMyTurn] = useState(false);

    // Fetch discussion state to check if it's my turn
    const fetchDiscussionState = useCallback(async () => {
        if (!currentRoomId || gameState.phase !== GamePhase.DAY) {
            setIsMyTurn(false);
            return;
        }
        try {
            const response = await fetch(
                `/api/game/discussion?roomId=${currentRoomId}&dayCount=${gameState.dayCount}&playerAddress=${myPlayer?.address || ''}`
            );
            const data = await response.json();
            setIsMyTurn(data?.isMyTurn || false);
        } catch (e) {
            console.error('[GameUIOverlay] Failed to fetch discussion state:', e);
        }
    }, [currentRoomId, gameState.phase, gameState.dayCount, myPlayer?.address]);

    // Poll discussion state
    useEffect(() => {
        if (gameState.phase !== GamePhase.DAY) {
            setIsMyTurn(false);
            return;
        }

        fetchDiscussionState();
        const interval = setInterval(fetchDiscussionState, 2000);
        return () => clearInterval(interval);
    }, [gameState.phase, fetchDiscussionState]);

    // Only show chat button during DAY phase
    const showChatButton = gameState.phase === GamePhase.DAY;

    // Can write only during my turn in discussion (DAY phase)
    const canWrite = isMyTurn && gameState.phase === GamePhase.DAY;

    return (
        <>
            {/* Discussion Chat Panel */}
            {showChatButton && (
                <DiscussionChat
                    isExpanded={isChatExpanded}
                    onToggle={() => setIsChatExpanded(!isChatExpanded)}
                    canWrite={canWrite}
                />
            )}

            {/* Background Music with Chat Button */}
            <BackgroundMusic
                additionalButtons={
                    showChatButton ? (
                        <ChatToggleButton
                            isExpanded={isChatExpanded}
                            onToggle={() => setIsChatExpanded(!isChatExpanded)}
                        />
                    ) : undefined
                }
            />
        </>
    );
};
