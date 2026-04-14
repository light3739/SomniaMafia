"use client";

import { useCallback, useEffect, useRef } from 'react';
import { DailyAudio, DailyProvider, useCallObject, useDaily } from '@daily-co/daily-react';
import { useAccount, useWalletClient } from 'wagmi';
import { useGameContext } from '../../contexts/GameContext';
import { GamePhase } from '../../types';
import { signRequest } from '../../services/requestSigning';
import { buildTokenMessage } from '../../services/signingSchema';
import { loadSession } from '../../services/sessionKeyService';
import { useGameSignaling, type GameSignal } from '../../hooks/useGameSignaling';

interface TokenResponse {
    token: string;
    roomUrl: string;
    roomName: string;
}

const JOINED_STATES = new Set(['joining-meeting', 'joined-meeting']);

function VoiceJoiner() {
    const call = useDaily();
    const { currentRoomId, gameState, myPlayer, playerName } = useGameContext();
    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();

    const phase = gameState.phase;
    const shouldBeActive =
        currentRoomId != null &&
        (phase === GamePhase.DAY || phase === GamePhase.VOTING || phase === GamePhase.NIGHT);

    // Monotonic generation — any async path that finds its generation stale bails out.
    const genRef = useRef(0);
    const joinedForRoomRef = useRef<string | null>(null);
    const joinInFlightRef = useRef(false);

    useEffect(() => {
        if (!call) return;
        const myGen = ++genRef.current;

        if (!shouldBeActive) {
            // Only leave if we ever reached a joined/joining state.
            if (joinedForRoomRef.current && JOINED_STATES.has(call.meetingState())) {
                void call.leave().catch(() => { /* ignore */ });
            }
            joinedForRoomRef.current = null;
            return;
        }

        const roomKey = currentRoomId!.toString();
        if (joinedForRoomRef.current === roomKey) return;
        if (joinInFlightRef.current) return;

        joinInFlightRef.current = true;

        (async () => {
            try {
                const room = `${roomKey}-game`;
                const username = playerName || myPlayer?.name || 'Player';
                const session = loadSession();
                const parsed = Number(roomKey);
                const playerAddress =
                    session && Number.isFinite(parsed) && session.roomId === parsed && Date.now() < session.expiresAt
                        ? session.mainWallet
                        : address || '';

                if (!playerAddress) return;

                const signed = await signRequest({
                    address: playerAddress,
                    roomId: Number(roomKey),
                    walletClient,
                    buildMessage: ({ nonce, timestamp }) => buildTokenMessage({
                        room,
                        username,
                        playerAddress,
                        nonce,
                        timestamp,
                        chainId,
                    }),
                });

                if (genRef.current !== myGen) return;

                const resp = await fetch('/api/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        room,
                        username,
                        playerAddress,
                        signerAddress: signed.signerAddress,
                        signature: signed.signature,
                        nonce: signed.nonce,
                        timestamp: signed.timestamp,
                        chainId,
                    }),
                });

                if (genRef.current !== myGen) return;
                if (!resp.ok) throw new Error(`token request failed: ${resp.status}`);

                const data = (await resp.json()) as TokenResponse;
                if (genRef.current !== myGen) return;

                await call.join({ url: data.roomUrl, token: data.token, userName: username });

                // Only mark joined if this generation is still current — otherwise
                // a newer effect already took over and will leave/rejoin as needed.
                if (genRef.current === myGen) {
                    joinedForRoomRef.current = roomKey;
                } else {
                    void call.leave().catch(() => {});
                }
            } catch (e) {
                if (genRef.current === myGen) {
                    console.warn('[GameVoiceProvider] join failed', e);
                    joinedForRoomRef.current = null;
                }
            } finally {
                if (genRef.current === myGen) {
                    joinInFlightRef.current = false;
                }
            }
        })();
    }, [call, shouldBeActive, currentRoomId, address, chainId, walletClient, playerName, myPlayer?.name]);

    return <DailyAudio />;
}

function GameSignalingBridge() {
    const { broadcast } = useGameSignaling();
    useEffect(() => {
        const handleSignal = (e: Event) => {
            const customEvent = e as CustomEvent<GameSignal>;
            broadcast(customEvent.detail);
        };
        window.addEventListener('send-game-signal', handleSignal);
        return () => window.removeEventListener('send-game-signal', handleSignal);
    }, [broadcast]);
    return null;
}

export function GameVoiceProvider({ children }: { children: React.ReactNode }) {
    const callObject = useCallObject({
        shouldCreateInstance: useCallback(() => typeof window !== 'undefined', []),
    });

    if (!callObject) return <>{children}</>;

    return (
        <DailyProvider callObject={callObject}>
            <VoiceJoiner />
            <GameSignalingBridge />
            {children}
        </DailyProvider>
    );
}
