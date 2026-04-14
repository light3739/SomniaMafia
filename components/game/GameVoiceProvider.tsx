"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { DailyAudio, DailyProvider, useDaily, useMeetingState } from '@daily-co/daily-react';
import { useAccount, useWalletClient } from 'wagmi';
import { useGameContext } from '../../contexts/GameContext';
import { GamePhase } from '../../types';
import { signRequest } from '../../services/requestSigning';
import { buildTokenMessage } from '../../services/signingSchema';
import { loadSession } from '../../services/sessionKeyService';

interface TokenResponse {
    token: string;
    roomUrl: string;
    roomName: string;
}

function VoiceJoiner() {
    const call = useDaily();
    const meetingState = useMeetingState();
    const { currentRoomId, gameState, myPlayer, playerName } = useGameContext();
    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();

    const phase = gameState.phase;
    const shouldBeActive =
        currentRoomId != null &&
        (phase === GamePhase.DAY || phase === GamePhase.VOTING || phase === GamePhase.NIGHT);

    const joinedForRoomRef = useRef<string | null>(null);

    useEffect(() => {
        if (!call) return;
        if (!shouldBeActive) {
            if (joinedForRoomRef.current) {
                void call.leave();
                joinedForRoomRef.current = null;
            }
            return;
        }
        const roomKey = currentRoomId!.toString();
        if (joinedForRoomRef.current === roomKey) return;
        if (meetingState !== 'new' && meetingState !== 'left-meeting' && meetingState !== 'error') return;

        let cancelled = false;

        (async () => {
            try {
                const room = `${roomKey}-game`;
                const username = playerName || myPlayer?.name || 'Player';
                const playerAddress = (() => {
                    const session = loadSession();
                    const parsed = Number(roomKey);
                    if (session && Number.isFinite(parsed) && session.roomId === parsed && Date.now() < session.expiresAt) {
                        return session.mainWallet;
                    }
                    return address || '';
                })();

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

                if (cancelled) return;

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

                if (!resp.ok) throw new Error(`token request failed: ${resp.status}`);
                const data = (await resp.json()) as TokenResponse;
                if (cancelled) return;
                joinedForRoomRef.current = roomKey;
                await call.join({ url: data.roomUrl, token: data.token, userName: username });
            } catch (e) {
                if (!cancelled) console.warn('[GameVoiceProvider] join failed', e);
                joinedForRoomRef.current = null;
            }
        })();

        return () => { cancelled = true; };
    }, [call, shouldBeActive, currentRoomId, meetingState, address, chainId, walletClient, playerName, myPlayer?.name]);

    return <DailyAudio />;
}

export function GameVoiceProvider({ children }: { children: React.ReactNode }) {
    const [callObject, setCallObject] = useState<DailyCall | null>(null);

    const factory = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return DailyIframe.createCallObject();
    }, []);

    useEffect(() => {
        if (!factory) return;
        setCallObject(factory);
        return () => {
            try { void factory.destroy(); } catch { /* ignore */ }
        };
    }, [factory]);

    if (!callObject) return <>{children}</>;

    return (
        <DailyProvider callObject={callObject}>
            <VoiceJoiner />
            {children}
        </DailyProvider>
    );
}
