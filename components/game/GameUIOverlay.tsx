"use client";

import React, { useState, useEffect } from 'react';
import { ChatToggleButton } from './DiscussionChat';
import { SessionKeyBanner } from './SessionKeyBanner';
import { BackButton } from '@/components/ui/BackButton';
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
    const { gameState, myPlayer, currentRoomId, isTxConfirming, isTxPending, discussionState, forfeitGameOnChain } = useGameContext();
    const [isChatExpanded, setIsChatExpanded] = useState(false);

    // Track if it's my turn during discussion — use shared state from GameContext
    const [isMyTurn, setIsMyTurn] = useState(false);

    // Derive isMyTurn from shared discussion state (no extra API calls)
    useEffect(() => {
        if (gameState.phase !== GamePhase.DAY) {
            setIsMyTurn(false);
            return;
        }
        setIsMyTurn(discussionState?.isMyTurn || false);
    }, [gameState.phase, discussionState?.isMyTurn]);

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

    // Show exit button during active game phases (not during shuffle/reveal overlays or ended)
    const showExitButton = [GamePhase.DAY, GamePhase.VOTING, GamePhase.NIGHT].includes(gameState.phase);

    return (
        <>
            {/* Exit Game button — top left */}
            {showExitButton && (
                <div className="fixed top-4 left-4 z-[100]">
                    <BackButton
                        to="/setup"
                        label=""
                        exitGame
                        onExitGame={async () => { await forfeitGameOnChain(); }}
                        isLoading={isTxPending}
                    />
                </div>
            )}

            {/* Subtle confirming indicator — shows when TXs are being confirmed in background */}
            {isTxConfirming && gameState.phase !== GamePhase.SHUFFLING && gameState.phase !== GamePhase.REVEAL && gameState.phase !== GamePhase.LOBBY && (
                <div className="fixed top-2 right-2 z-[200] flex items-center gap-2 px-3 py-1.5 bg-[#050505] border border-[#916A47]/30 rounded-md shadow-[0_5px_15px_rgba(0,0,0,0.9)]">
                    <div className="w-1.5 h-1.5 bg-[#916A47] rounded-full animate-pulse" />
                    <span className="text-[#916A47]/80 text-[10px] uppercase tracking-widest font-mono">Confirming</span>
                </div>
            )}
            
            {/* Session Key Banner (Sessionic) 
            {currentRoomId && gameState.phase !== GamePhase.LOBBY && (
                <div className="fixed bottom-6 left-6 z-[100]">
                    <SessionKeyBanner 
                        roomId={Number(currentRoomId)} 
                    />
                </div>
            )}
            */}

            {/* BackgroundMusic with Chat button integrated for slide animation */}
            <BackgroundMusic
                additionalButtons={chatButton}
                isChatExpanded={isChatExpanded}
            />
        </>
    );
};
