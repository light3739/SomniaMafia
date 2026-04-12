/**
 * useMafiaChat — Mafia team encrypted chat.
 *
 * Handles:
 * - Chat key derivation (keccak256 of room + salt + sorted mafia)
 * - Message encryption (AES-GCM)
 * - Message decryption (from chain and from LiveKit signals)
 * - Send message on-chain + broadcast via signal bus
 * - Polling for new messages
 */
import { useCallback, useRef, useEffect } from 'react';
import { keccak256, encodePacked } from 'viem';
import { GamePhase, GameState, Role, MafiaChatMessage } from '../../types';
import { signRequest } from '../../services/requestSigning';
import { buildMafiaMembersMessage } from '../../services/signingSchema';
import { gmWs } from '../../services/gmWebSocket';
import type { GameRefs } from './useGameRefs';
import type { WalletManager } from './useWalletManager';
import type { TransactionEngine } from './useTransactionEngine';
import type { LogEntry } from '../../types';
import { MAFIA_ABI } from '../../contracts/config';
import React from 'react';

interface ChatDeps {
    refs: GameRefs;
    wallet: WalletManager;
    txEngine: TransactionEngine;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    addLog: (message: string, type?: LogEntry['type']) => void;
    currentRoomId: bigint | null;
}

export function useMafiaChat(deps: ChatDeps) {
    const { refs, wallet, txEngine, gameState, setGameState, addLog, currentRoomId } = deps;

    const mafiaKeyRef = useRef<CryptoKey | null>(null);
    const mafiaKeyVerifyingRef = useRef(false);

    // === GET MAFIA CHAT KEY ===
    const getMafiaChatKey = useCallback(async (roomId: bigint): Promise<CryptoKey | null> => {
        if (mafiaKeyRef.current) return mafiaKeyRef.current;
        if (mafiaKeyVerifyingRef.current) return null;

        const roomIdStr = roomId.toString();
        const myAddr = refs.addressRef.current;
        if (!myAddr) return null;

        try {
            mafiaKeyVerifyingRef.current = true;

            const chainId = refs.runtimeChainRef.current.id;
            const { client: activeWalletClient } = await wallet.getActiveWalletClient();
            const meta = await signRequest({
                address: myAddr,
                roomId: Number(roomId),
                walletClient: activeWalletClient,
                buildMessage: (inp) => buildMafiaMembersMessage({ roomId: roomIdStr, chainId, ...inp })
            });

            const queryParams = new URLSearchParams({
                roomId: roomIdStr,
                chainId: String(chainId),
                playerAddress: myAddr,
                signerAddress: meta.signerAddress,
                signature: meta.signature,
                nonce: meta.nonce,
                timestamp: meta.timestamp.toString(),
            });

            const res = await fetch(`/api/game/mafia-members?${queryParams.toString()}`);
            if (!res.ok) {
                const err = await res.json();
                console.warn('[MafiaChat] Failed to fetch teammates:', err.error);
                return null;
            }

            // GM server returns { members: string[] } — keep the local
            // alias `mafia` so the rest of the function reads naturally.
            // Without this rename the destructure used to silently return
            // undefined, the AES key was never derived, and teammates
            // couldn't decrypt each other's chat at all.
            const { members: mafia } = await res.json() as { members: string[] };
            if (!mafia || mafia.length === 0) return null;

            const sortedMafia = [...mafia].map(a => a.toLowerCase()).sort();
            // Key derivation inputs MUST be deterministic across all mafia clients
            // or AES-GCM decrypt fails with "The operation failed for an
            // operation-specific reason" (auth tag mismatch). The previous impl
            // read a per-client random salt from localStorage — every client got
            // a different salt, so every client derived a different key, and no
            // mafia could decrypt another mafia's LiveKit signals. Mafia chat was
            // silently broken whenever more than one mafia was on the team.
            //
            // Salt adds no real security here: sortedMafia is already secret
            // (the /mafia-members endpoint is role-gated, non-mafia never see
            // the list), and roomId gives per-room uniqueness. Drop the salt,
            // derive the key from (roomId, sortedMafia) only — this is stable
            // across clients because both inputs are identical per room.
            const inputHash = keccak256(encodePacked(
                ['uint256', 'address[]'],
                [roomId, sortedMafia as `0x${string}`[]]
            ));

            const keyBytes = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                keyBytes[i] = parseInt(inputHash.slice(2 + i * 2, 4 + i * 2), 16);
            }

            const key = await crypto.subtle.importKey(
                'raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']
            );

            mafiaKeyRef.current = key;

            // Mark teammates as MAFIA in local state so PlayerSpot/MobilePlayerList
            // can render them with the mafia-visible styling at night. Client-local
            // only — non-mafia clients never hit this code path because GM gates
            // /mafia-members on requester role.
            const mafiaSet = new Set(sortedMafia);
            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p =>
                    mafiaSet.has(p.address.toLowerCase()) && p.role !== Role.MAFIA
                        ? { ...p, role: Role.MAFIA }
                        : p
                ),
            }));

            return key;
        } catch (e) {
            console.error('[MafiaChat] Key derivation error:', e);
            return null;
        } finally {
            mafiaKeyVerifyingRef.current = false;
        }
    }, [refs, wallet, setGameState]);

    // === FETCH MAFIA CHAT ===
    const fetchMafiaChat = useCallback(async (roomId: bigint) => {
        const pClient = refs.publicClientRef.current;
        if (!pClient) return;
        try {
            // getMafiaChat is no longer in the ABI, we rely on LiveKit signals for real-time mafia chat
            // and we can potentially use getContractEvents if we need historical messages.
            const messages: any[] = [];

            const formattedMessages: MafiaChatMessage[] = await Promise.all(messages.map(async (msg: any, index: number) => {
                const hexContent = msg.encryptedMessage as string;
                let content = { type: 'text' as const, text: '' };

                try {
                    const myAddr = refs.addressRef.current;
                    const isMafia = refs.playersRef.current.some(p => p.address.toLowerCase() === myAddr?.toLowerCase() && p.role === Role.MAFIA);

                    let decryptedStr = '';
                    if (isMafia && hexContent.length > 24) {
                        const key = await getMafiaChatKey(roomId);
                        if (key) {
                            try {
                                const fullBytes = new Uint8Array(
                                    hexContent.startsWith('0x') ?
                                        hexContent.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)) :
                                        hexContent.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
                                );

                                const iv = fullBytes.slice(-12);
                                const ciphertext = fullBytes.slice(0, -12);

                                const decrypted = await crypto.subtle.decrypt(
                                    { name: 'AES-GCM', iv }, key, ciphertext
                                );
                                decryptedStr = new TextDecoder().decode(decrypted);
                            } catch (decError) {
                                console.debug('[MafiaChat] Decryption failed (old message?):', decError);
                            }
                        }
                    }

                    let str = '';
                    if (decryptedStr) {
                        str = decryptedStr;
                    } else if (hexContent.startsWith('0x')) {
                        const hex = hexContent.slice(2);
                        for (let i = 0; i < hex.length; i += 2) {
                            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
                        }
                    } else {
                        str = hexContent;
                    }

                    if (str.trim().startsWith('{')) {
                        content = JSON.parse(str);
                    } else {
                        content = { type: 'text', text: str };
                    }
                } catch (e) {
                    content = { type: 'text', text: hexContent };
                }

                const senderPlayer = refs.playersRef.current.find(p => p.address.toLowerCase() === msg.sender.toLowerCase());
                const playerName = senderPlayer?.name || msg.sender.slice(0, 6);

                return {
                    id: `${index}-${msg.timestamp}`,
                    sender: msg.sender,
                    playerName,
                    content,
                    timestamp: Number(msg.timestamp) * 1000
                };
            }));

            setGameState(prev => ({ ...prev, mafiaMessages: formattedMessages }));
        } catch (e) {
            console.error("Error fetching mafia chat:", e);
        }
    }, [refs, getMafiaChatKey, setGameState]);

    // === SEND MAFIA MESSAGE ===
    const sendMafiaMessageOnChain = useCallback(async (content: MafiaChatMessage['content']) => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        if (!roomId) return;

        const myPlayer = refs.playersRef.current.find(p => p.address.toLowerCase() === myAddr?.toLowerCase());
        const isMafia = myPlayer?.role === Role.MAFIA;

        let hexData = '0x' as `0x${string}`;

        if (isMafia) {
            const key = await getMafiaChatKey(roomId);
            if (key) {
                try {
                    const jsonStr = JSON.stringify(content);
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const encrypted = await crypto.subtle.encrypt(
                        { name: 'AES-GCM', iv }, key, new TextEncoder().encode(jsonStr)
                    );

                    const encryptedBytes = new Uint8Array(encrypted);
                    const fullBytes = new Uint8Array(encryptedBytes.length + iv.length);
                    fullBytes.set(encryptedBytes);
                    fullBytes.set(iv, encryptedBytes.length);

                    hexData = ('0x' + Array.from(fullBytes)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('')) as `0x${string}`;
                } catch (encErr) {
                    console.error('[MafiaChat] Encryption failed, falling back to plaintext:', encErr);
                }
            }
        }

        if (hexData === '0x') {
            const jsonStr = JSON.stringify(content);
            for (let i = 0; i < jsonStr.length; i++) {
                hexData += jsonStr.charCodeAt(i).toString(16).padStart(2, '0');
            }
        }

        // Relay encrypted chat via GM WebSocket (available in all phases, no LiveKit dependency)
        if (myAddr && roomId) {
            gmWs.relay({
                type: 'mafia-chat',
                data: { sender: myAddr, encryptedData: hexData },
            });
        }

        // Optimistically append the message to local state so the sender sees it instantly.
        if (myAddr) {
            const playerForMatch = refs.playersRef.current.find(p => p.address.toLowerCase() === myAddr.toLowerCase());
            setGameState(prev => ({
                ...prev,
                mafiaMessages: [...prev.mafiaMessages, {
                    id: `optimistic-${Date.now()}`,
                    sender: myAddr,
                    playerName: playerForMatch?.name || myAddr.slice(0, 6),
                    content,
                    timestamp: Date.now(),
                }]
            }));
        }
    }, [refs, getMafiaChatKey, setGameState]);

    // === HANDLE INCOMING SIGNAL ===
    const handleIncomingMafiaSignal = useCallback(async (sender: string, encryptedHex: string) => {
        const roomId = refs.currentRoomIdRef.current;
        if (!roomId) return;
        try {
            const key = await getMafiaChatKey(roomId);
            if (!key) return;
            const fullBytes = new Uint8Array(
                encryptedHex.startsWith('0x') ?
                    encryptedHex.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)) :
                    encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
            );
            const iv = fullBytes.slice(-12);
            const ciphertext = fullBytes.slice(0, -12);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            const decryptedStr = new TextDecoder().decode(decrypted);
            if (decryptedStr.trim().startsWith('{')) {
                const content = JSON.parse(decryptedStr);
                const senderPlayer = refs.playersRef.current.find(p => p.address.toLowerCase() === sender.toLowerCase());
                setGameState(prev => {
                    const signalId = `signal-${sender}-${Date.now()}`;
                    const isDuplicate = prev.mafiaMessages.slice(-5).some(m =>
                        m.sender.toLowerCase() === sender.toLowerCase() &&
                        JSON.stringify(m.content) === JSON.stringify(content)
                    );
                    if (isDuplicate) return prev;
                    return {
                        ...prev,
                        mafiaMessages: [...prev.mafiaMessages, {
                            id: signalId,
                            sender,
                            playerName: senderPlayer?.name || sender.slice(0, 6),
                            content,
                            timestamp: Date.now(),
                        }]
                    };
                });
            }
        } catch (e) {
            console.warn('[MafiaSignaling] Failed to decrypt signal:', e);
        }
    }, [refs, getMafiaChatKey, setGameState]);

    // === POLLING ===
    const isMafiaRef = useRef(false);
    const gamePhaseRef = useRef(gameState.phase);
    useEffect(() => {
        const myAddr = refs.stableAddress?.toLowerCase();
        isMafiaRef.current = refs.playersRef.current.some(
            p => p.address.toLowerCase() === myAddr && p.role === Role.MAFIA
        );
        gamePhaseRef.current = gameState.phase;
    }, [gameState.players, gameState.phase, refs.stableAddress]);

    useEffect(() => {
        if (!currentRoomId || !refs.publicClientRef.current) return;

        const CHECK_INTERVAL = 3000;
        const roomIdForChat = currentRoomId;

        const interval = setInterval(() => {
            if (isMafiaRef.current && gamePhaseRef.current >= GamePhase.DAY) {
                fetchMafiaChat(roomIdForChat);
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [fetchMafiaChat, refs, currentRoomId]);

    // Proactively derive the mafia chat key (and mark teammates red in the UI)
    // as soon as we enter NIGHT. /mafia-members is gated to NIGHT/ENDED on the
    // GM server, so any earlier call would fail — we wait for the transition.
    useEffect(() => {
        if (!currentRoomId) return;
        if (gameState.phase !== GamePhase.NIGHT) return;
        const myAddr = refs.stableAddress?.toLowerCase();
        const amMafia = gameState.players.some(
            p => p.address.toLowerCase() === myAddr && p.role === Role.MAFIA
        );
        if (!amMafia) return;
        getMafiaChatKey(currentRoomId).catch(() => { /* logged inside */ });
    }, [gameState.phase, gameState.players, currentRoomId, refs.stableAddress, getMafiaChatKey]);

    return {
        getMafiaChatKey,
        fetchMafiaChat,
        sendMafiaMessageOnChain,
        handleIncomingMafiaSignal,
    };
}

export type MafiaChat = ReturnType<typeof useMafiaChat>;
