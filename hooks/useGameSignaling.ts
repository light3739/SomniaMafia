/**
 * useGameSignaling — Daily app-message bridge for instant game events.
 *
 * Mounted INSIDE <DailyProvider>. Connects Daily's sendAppMessage channel
 * (~50-200ms latency) to GameContext, enabling instant optimistic UI
 * updates before the blockchain event arrives (2-5s).
 *
 * Supported events:
 *   - OPTIMISTIC_VOTE:      player voted (shows connection line + badge)
 *   - OPTIMISTIC_COMMITTED: player submitted night action
 *   - OPTIMISTIC_SPEAKER:   player is now speaking in day discussion
 *   - MAFIA_CHAT:           encrypted chat message for mafia
 */
"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useAppMessage, useDaily } from '@daily-co/daily-react';
import { useGameContext } from '../contexts/GameContext';
import { useAccount } from 'wagmi';

export type GameSignalType =
    | 'OPTIMISTIC_VOTE'
    | 'OPTIMISTIC_COMMITTED'
    | 'OPTIMISTIC_SPEAKER'
    | 'MAFIA_CHAT';

export interface GameSignalVote {
    type: 'OPTIMISTIC_VOTE';
    voter: string;
    target: string;
    roomId: string;
}

export interface GameSignalCommitted {
    type: 'OPTIMISTIC_COMMITTED';
    player: string;
    roomId: string;
}

export interface GameSignalSpeaker {
    type: 'OPTIMISTIC_SPEAKER';
    playerName: string;
    playerAddress: string;
    roomId: string;
}

export interface GameSignalChat {
    type: 'MAFIA_CHAT';
    encryptedData: string;
    sender: string;
    roomId: string;
}

export type GameSignal = GameSignalVote | GameSignalCommitted | GameSignalSpeaker | GameSignalChat;

export function useGameSignaling() {
    const call = useDaily();
    const { setVoteMap, setGameState, currentRoomId, handleIncomingMafiaSignal, fetchDiscussionState } = useGameContext();
    const { address } = useAccount();

    const currentRoomIdRef = useRef(currentRoomId);
    const addressRef = useRef(address);
    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
    useEffect(() => { addressRef.current = address; }, [address]);

    const handleAppMessage = useCallback((ev: { data: unknown; fromId?: string }) => {
        const data = ev?.data as GameSignal | null | undefined;
        if (!data || typeof data !== 'object' || !('type' in data)) return;
        const type = (data as { type?: string }).type;
        if (!type) return;
        if (!type.startsWith('OPTIMISTIC_') && type !== 'MAFIA_CHAT') return;
        if ((data as GameSignal).roomId !== currentRoomIdRef.current?.toString()) return;

        const myAddr = addressRef.current?.toLowerCase();
        const signal = data as GameSignal;

        switch (signal.type) {
            case 'OPTIMISTIC_VOTE': {
                if (signal.voter === myAddr) return;
                console.log(`[Signaling] OPTIMISTIC_VOTE from ${signal.voter.slice(0, 8)} -> ${signal.target.slice(0, 8)}`);
                setVoteMap((prev) => ({ ...prev, [signal.voter]: signal.target }));
                setGameState((prev) => ({
                    ...prev,
                    players: prev.players.map((p) =>
                        p.address.toLowerCase() === signal.voter ? { ...p, hasVoted: true } : p
                    ),
                }));
                break;
            }
            case 'OPTIMISTIC_COMMITTED': {
                if (signal.player === myAddr) return;
                console.log(`[Signaling] OPTIMISTIC_COMMITTED from ${signal.player.slice(0, 8)}`);
                setGameState((prev) => ({
                    ...prev,
                    players: prev.players.map((p) =>
                        p.address.toLowerCase() === signal.player ? { ...p, hasNightCommitted: true } : p
                    ),
                }));
                break;
            }
            case 'OPTIMISTIC_SPEAKER': {
                console.log(`[Signaling] OPTIMISTIC_SPEAKER from ${signal.playerName}`);
                fetchDiscussionState();
                break;
            }
            case 'MAFIA_CHAT': {
                if (signal.sender === myAddr) return;
                console.log(`[Signaling] MAFIA_CHAT from ${signal.sender.slice(0, 8)}`);
                handleIncomingMafiaSignal?.(signal.sender, signal.encryptedData);
                break;
            }
        }
    }, [setVoteMap, setGameState, handleIncomingMafiaSignal, fetchDiscussionState]);

    useAppMessage({ onAppMessage: handleAppMessage });

    const broadcast = useCallback((signal: GameSignal) => {
        if (!call) {
            console.warn('[Signaling] Cannot broadcast: Daily call not connected');
            return;
        }
        try {
            call.sendAppMessage(signal, '*');
            console.log(`[Signaling] Broadcast: ${signal.type}`);
        } catch (e) {
            console.warn('[Signaling] Broadcast failed:', e);
        }
    }, [call]);

    return { broadcast };
}
