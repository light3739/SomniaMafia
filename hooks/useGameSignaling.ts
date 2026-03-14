/**
 * useGameSignaling — LiveKit DataChannel bridge for instant game events.
 *
 * Must be mounted INSIDE <LiveKitRoom> (where useRoomContext() works).
 * Connects LiveKit's P2P data channel (~50ms latency) to GameContext,
 * enabling instant optimistic UI updates for all players before the
 * blockchain event arrives (which takes 2-5 seconds).
 *
 * Supported events:
 *   - OPTIMISTIC_VOTE:      player voted (shows ✅ instantly to all)
 *   - OPTIMISTIC_COMMITTED: player submitted night action
 *   - OPTIMISTIC_SPEAKER:   player is now speaking in day discussion
 *   - MAFIA_CHAT:           encrypted chat message for mafia
 */
"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useGameContext } from '../contexts/GameContext';
import { useAccount } from 'wagmi';

// ─── Message Types ────────────────────────────────────────────────────────────

export type GameSignalType =
    | 'OPTIMISTIC_VOTE'
    | 'OPTIMISTIC_COMMITTED'
    | 'OPTIMISTIC_SPEAKER'
    | 'MAFIA_CHAT';

export interface GameSignalVote {
    type: 'OPTIMISTIC_VOTE';
    voter: string;   // lowercase address
    target: string;  // lowercase address
    roomId: string;
}

export interface GameSignalCommitted {
    type: 'OPTIMISTIC_COMMITTED';
    player: string;  // lowercase address
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
    encryptedData: string; // Hex encrypted with Mafia AES key
    sender: string;
    roomId: string;
}

export type GameSignal = GameSignalVote | GameSignalCommitted | GameSignalSpeaker | GameSignalChat;

// ─── Encoder/Decoder (module-level singletons for performance) ────────────────
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameSignaling() {
    const room = useRoomContext();
    const { setVoteMap, setGameState, currentRoomId, handleIncomingMafiaSignal } = useGameContext();
    const { address } = useAccount();

    // Ref to store latest values without re-subscribing DataReceived
    const currentRoomIdRef = useRef(currentRoomId);
    const addressRef = useRef(address);
    useEffect(() => { currentRoomIdRef.current = currentRoomId; }, [currentRoomId]);
    useEffect(() => { addressRef.current = address; }, [address]);

    // ── Receive: handle incoming signals from other players ──────────────────
    useEffect(() => {
        const handleData = (payload: Uint8Array, participant?: any) => {
            try {
                const text = decoder.decode(payload);
                const data = JSON.parse(text) as GameSignal;

                // Support both OPTIMISTIC_ and MAFIA_ chat signals
                if (!data.type?.startsWith('OPTIMISTIC_') && data.type !== 'MAFIA_CHAT') return;

                // Ignore signals from different rooms (safety check)
                if (data.roomId !== currentRoomIdRef.current?.toString()) return;

                // Ignore signals from ourselves (we already applied optimistic update locally)
                const myAddr = addressRef.current?.toLowerCase();

                switch (data.type) {
                    case 'OPTIMISTIC_VOTE': {
                        if (data.voter === myAddr) return; // Our own vote — already applied
                        console.log(`[Signaling] ⚡ OPTIMISTIC_VOTE from ${data.voter.slice(0, 8)} → ${data.target.slice(0, 8)}`);

                        // 1. Update vote map (shows connection line in UI instantly)
                        setVoteMap(prev => ({ ...prev, [data.voter]: data.target }));

                        // 2. Mark voting player as hasVoted (shows ✅ badge instantly)
                        setGameState(prev => ({
                            ...prev,
                            players: prev.players.map(p =>
                                p.address.toLowerCase() === data.voter
                                    ? { ...p, hasVoted: true }
                                    : p
                            )
                        }));
                        break;
                    }

                    case 'OPTIMISTIC_COMMITTED': {
                        if (data.player === myAddr) return;
                        console.log(`[Signaling] ⚡ OPTIMISTIC_COMMITTED from ${data.player.slice(0, 8)}`);

                        // Mark player as night-committed (shows in counter N/M)
                        setGameState(prev => ({
                            ...prev,
                            players: prev.players.map(p =>
                                p.address.toLowerCase() === data.player
                                    ? { ...p, hasNightCommitted: true }
                                    : p
                            )
                        }));
                        break;
                    }

                    case 'OPTIMISTIC_SPEAKER': {
                        // Speaker is already handled by discussion polling,
                        // this is just for rooms where polling lags behind.
                        // No-op for now — handled by liveDiscussion prop in GameLog.
                        break;
                    }

                    case 'MAFIA_CHAT': {
                        if (data.sender === myAddr) return;
                        console.log(`[Signaling] ⚡ MAFIA_CHAT from ${data.sender.slice(0, 8)}`);
                        handleIncomingMafiaSignal?.(data.sender, data.encryptedData);
                        break;
                    }
                }
            } catch {
                // Non-game or malformed payload — silently ignore
            }
        };

        room.on(RoomEvent.DataReceived, handleData);
        return () => {
            room.off(RoomEvent.DataReceived, handleData);
        };
    }, [room, setVoteMap, setGameState]);

    // ── Send: broadcast a game signal to all participants ────────────────────
    const broadcast = useCallback((signal: GameSignal) => {
        if (!room.localParticipant) {
            console.warn('[Signaling] Cannot broadcast: not connected to LiveKit room');
            return;
        }
        try {
            const payload = encoder.encode(JSON.stringify(signal));
            // reliable: true = guaranteed delivery (small perf cost, worth it for game state)
            room.localParticipant.publishData(payload, { reliable: true });
            console.log(`[Signaling] 📡 Broadcast: ${signal.type}`);
        } catch (e) {
            // LiveKit disconnected — not a fatal error, blockchain is source of truth
            console.warn('[Signaling] Broadcast failed (LiveKit disconnected?):', e);
        }
    }, [room]);

    return { broadcast };
}
