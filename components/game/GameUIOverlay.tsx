"use client";

import React, { useState, useEffect } from 'react';
import { ChatToggleButton } from './DiscussionChat';
import { SessionKeyBanner } from './SessionKeyBanner';
import { BackgroundMusic } from '@/components/ui/BackgroundMusic';
import { useGameContext } from '@/contexts/GameContext';
import { useAccount } from 'wagmi';
import { GamePhase } from '@/types';

/**
 * GameUIOverlay - Renders game-specific UI elements that need GameContext access
 * Includes: Chat button (merged with BackgroundMusic), SessionKeyBanner, and confirming indicator.
 */
export const GameUIOverlay: React.FC = () => {
    const { chainId, address } = useAccount();
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
                    `/api/game/discussion?roomId=${currentRoomId}&dayCount=${gameState.dayCount}&playerAddress=${myPlayer?.address || ''}&chainId=${chainId || ''}`,
                    { cache: 'no-store' }
                );
                const data = await response.json();
                setIsMyTurn(data?.isMyTurn || false);
            } catch (e) {
                console.error('[GameUIOverlay] Failed to fetch discussion state:', e);
            }
        };

        fetchDiscussionState();
        const interval = setInterval(() => {
            // FIX: Stop polling immediately if phase changes
            if (gameState.phase === GamePhase.DAY && currentRoomId) {
                fetchDiscussionState();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [currentRoomId, gameState.phase, gameState.dayCount, myPlayer?.address, chainId]);

    // Only show chat button during DAY phase
    const showChatButton = gameState.phase === GamePhase.DAY || gameState.phase === GamePhase.VOTING;

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

    // Chat toggle button to pass as additionalButtons to BackgroundMusic
    const chatButton = showChatButton ? (
        <ChatToggleButton
            isExpanded={isChatExpanded}
            onToggle={() => setIsChatExpanded(!isChatExpanded)}
            canWrite={canWrite}
        />
    ) : undefined;

    return (
        <>
            {/* Subtle confirming indicator — shows when TXs are being confirmed in background */}
            {isTxConfirming && gameState.phase !== GamePhase.SHUFFLING && gameState.phase !== GamePhase.REVEAL && gameState.phase !== GamePhase.LOBBY && (
                <div className="fixed top-2 right-2 z-[200] flex items-center gap-2 px-3 py-1.5 bg-[#050505] border border-[#916A47]/30 rounded-md shadow-[0_5px_15px_rgba(0,0,0,0.9)]">
                    <div className="w-1.5 h-1.5 bg-[#916A47] rounded-full animate-pulse" />
                    <span className="text-[#916A47]/80 text-[10px] uppercase tracking-widest font-mono">Confirming</span>
                </div>
            )}
            
            {/* Session Key Banner (Sessionic) */}
            {currentRoomId && gameState.phase !== GamePhase.LOBBY && (
                <div className="fixed bottom-6 left-6 z-[100]">
                    <SessionKeyBanner 
                        roomId={Number(currentRoomId)} 
                    />
                </div>
            )}

            {/* BackgroundMusic with Chat button integrated for slide animation */}
            <BackgroundMusic
                additionalButtons={chatButton}
                isChatExpanded={isChatExpanded}
            />
        </>
    );
};
