"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Room, RoomEvent, Track, LocalAudioTrack, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import { signRequest } from '@/services/requestSigning';
import { buildTokenMessage } from '@/services/signingSchema';

const LIVEKIT_CONNECT_TIMEOUT_MS = (() => {
    const raw = process.env.NEXT_PUBLIC_LIVEKIT_CONNECT_TIMEOUT_MS;
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed >= 10000) {
        return parsed;
    }
    return 35000;
})();

const SHORT_ICE_CONNECTION_MS = 20000;

interface MicButtonProps {
    roomId: string;
    userName?: string;
    isMyTurn: boolean;
    freeTalk?: boolean; // When true, all players can talk freely (e.g. voting phase)
    className?: string;
}

function normalizeLiveKitWsUrl(rawUrl?: string): string {
    if (!rawUrl) return 'wss://livekit.mafiaonchain.live';
    if (rawUrl.startsWith('wss://') || rawUrl.startsWith('ws://')) return rawUrl;
    if (rawUrl.startsWith('https://')) return rawUrl.replace('https://', 'wss://');
    if (rawUrl.startsWith('http://')) return rawUrl.replace('http://', 'ws://');
    return `wss://${rawUrl}`;
}

async function connectRoomWithTimeout(
    room: Room,
    serverUrl: string,
    token: string,
    options: { autoSubscribe: boolean; rtcConfig?: RTCConfiguration },
    timeoutMs: number,
): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error('Connection timeout'));
        }, timeoutMs);

        room.connect(serverUrl, token, options)
            .then(() => {
                clearTimeout(timeoutId);
                resolve();
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

export function MicButton({
    roomId,
    userName = 'Player',
    isMyTurn,
    freeTalk = false,
    className = '',
}: MicButtonProps) {
    const { address } = useAccount();
    const chainId = useChainId();
    const { data: walletClient } = useWalletClient();
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [participantCount, setParticipantCount] = useState(0);
    const [preferRelay, setPreferRelay] = useState(false);
    const livekitServerUrl = normalizeLiveKitWsUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL);

    const addressRef = useRef(address);
    const chainIdRef = useRef(chainId);
    const walletClientRef = useRef(walletClient);

    const roomRef = useRef<Room | null>(null);
    const audioTrackRef = useRef<LocalAudioTrack | null>(null);
    const audioContainerRef = useRef<HTMLDivElement | null>(null);
    const connectedAtRef = useRef(0);

    useEffect(() => {
        addressRef.current = address;
    }, [address]);

    useEffect(() => {
        chainIdRef.current = chainId;
    }, [chainId]);

    useEffect(() => {
        walletClientRef.current = walletClient;
    }, [walletClient]);

    // Function to attach remote audio track to DOM for playback
    const attachRemoteAudio = useCallback((track: RemoteTrack, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Audio) return;

        const audioElement = track.attach();
        audioElement.id = `audio-${participant.identity}`;
        audioElement.setAttribute('data-participant', participant.identity);

        // Add to container (or body if no container)
        if (audioContainerRef.current) {
            audioContainerRef.current.appendChild(audioElement);
        } else {
            document.body.appendChild(audioElement);
        }

        console.log(`[MicButton] Attached audio from ${participant.identity}`);
    }, []);

    // Function to detach remote audio track
    const detachRemoteAudio = useCallback((track: RemoteTrack, participant: RemoteParticipant) => {
        if (track.kind !== Track.Kind.Audio) return;

        const elements = track.detach();
        elements.forEach(el => el.remove());

        console.log(`[MicButton] Detached audio from ${participant.identity}`);
    }, []);

    // Use refs for callbacks to avoid dependency issues
    const attachRemoteAudioRef = useRef(attachRemoteAudio);
    const detachRemoteAudioRef = useRef(detachRemoteAudio);

    // Update refs when callbacks change
    useEffect(() => {
        attachRemoteAudioRef.current = attachRemoteAudio;
        detachRemoteAudioRef.current = detachRemoteAudio;
    }, [attachRemoteAudio, detachRemoteAudio]);

    // Store userName in ref to avoid dependency issues
    const userNameRef = useRef(userName);
    useEffect(() => {
        userNameRef.current = userName;
    }, [userName]);

    useEffect(() => {
        setPreferRelay(false);
        connectedAtRef.current = 0;
    }, [roomId, userName]);

    // Connect to LiveKit room on mount or retry
    useEffect(() => {
        if (!roomId) return;

        // Skip if already connected
        if (roomRef.current) {
            console.log('[MicButton] Already have room instance, skipping connect');
            return;
        }

        let cancelled = false;

        const connect = async () => {
            console.log(`[MicButton] Starting connection to ${roomId} (attempt ${retryCount + 1})...`);
            setIsConnecting(true);
            setError(null);

            try {
                const playerAddress = addressRef.current || '';
                let signature: `0x${string}` | undefined;
                let signerAddress: string | undefined;
                let nonce: string | undefined;
                let timestamp: number | undefined;

                if (playerAddress) {
                    const roomIdPrefix = roomId.split('-')[0];
                    const parsedRoomId = Number(roomIdPrefix);
                    if (Number.isFinite(parsedRoomId)) {
                        const signed = await signRequest({
                            address: playerAddress,
                            roomId: parsedRoomId,
                            walletClient: walletClientRef.current,
                            buildMessage: ({ nonce, timestamp }) => buildTokenMessage({
                                room: roomId,
                                username: userNameRef.current,
                                playerAddress,
                                nonce,
                                timestamp,
                            }),
                        });
                        signature = signed.signature;
                        signerAddress = signed.signerAddress;
                        nonce = signed.nonce;
                        timestamp = signed.timestamp;
                    }
                }

                if (cancelled) return;

                // Get token from API with chainId support
                const resp = await fetch("/api/token", {
                    method: "POST",
                    body: JSON.stringify({
                        room: roomId,
                        username: userNameRef.current,
                        playerAddress,
                        signerAddress,
                        signature,
                        nonce,
                        timestamp,
                        chainId: chainIdRef.current, // CRITICAL: Send current chainId to server
                    }),
                    headers: { "Content-Type": "application/json" },
                });

                if (!resp.ok) {
                    const errorText = await resp.clone().text();
                    try {
                        const errJson = JSON.parse(errorText);
                        throw new Error(errJson.error || `Server error ${resp.status}`);
                    } catch {
                        throw new Error(`Failed to get token: ${resp.status}`);
                    }
                }

                const data = await resp.json();
                if (data.error) throw new Error(data.error);

                if (cancelled) return;

                // Create and connect room
                const room = new Room({
                    adaptiveStream: true,
                    dynacast: true,
                });
                roomRef.current = room;

                // Setup event listeners
                room.on(RoomEvent.Disconnected, () => {
                    if (!cancelled) {
                        const connectedForMs = connectedAtRef.current > 0
                            ? Date.now() - connectedAtRef.current
                            : 0;
                        connectedAtRef.current = 0;
                        setIsConnected(false);
                        setParticipantCount(0);
                        console.log('[MicButton] Disconnected from room');
                        if (!preferRelay && connectedForMs > 0 && connectedForMs < SHORT_ICE_CONNECTION_MS) {
                            console.warn('[MicButton] Short ICE connection, retrying in relay-only mode');
                            setPreferRelay(true);
                            setRetryCount((prev) => prev + 1);
                        }
                    }
                });

                room.on(RoomEvent.Connected, () => {
                    if (!cancelled) {
                        connectedAtRef.current = Date.now();
                        setIsConnected(true);
                        setParticipantCount(room.remoteParticipants.size + 1);
                        console.log('[MicButton] Connected to room');
                    }
                });

                // Handle remote tracks
                room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                    if (!cancelled) attachRemoteAudioRef.current(track, participant);
                });

                room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                    if (!cancelled) detachRemoteAudioRef.current(track, participant);
                });

                // Connect with natural ICE negotiation — also add TURNS:443/tcp
                // ICE server for VPN/firewall users (credentials from token API)
                const extraIceServers: RTCIceServer[] = Array.isArray(data.turnServers) ? data.turnServers : [];
                const defaultConnectOptions: { autoSubscribe: boolean; rtcConfig?: RTCConfiguration } = {
                    autoSubscribe: true,
                    ...((extraIceServers.length > 0 || preferRelay) ? {
                        rtcConfig: {
                            ...(extraIceServers.length > 0 ? {
                                iceServers: extraIceServers,
                            } : {}),
                            ...(preferRelay ? {
                                iceTransportPolicy: 'relay' as RTCIceTransportPolicy,
                            } : {}),
                        },
                    } : {}),
                };
                await connectRoomWithTimeout(
                    room,
                    livekitServerUrl,
                    data.token,
                    defaultConnectOptions,
                    LIVEKIT_CONNECT_TIMEOUT_MS,
                );

                if (cancelled) {
                    room.disconnect();
                    return;
                }

                // Attach any existing remote audio tracks
                room.remoteParticipants.forEach((participant) => {
                    participant.audioTrackPublications.forEach((publication) => {
                        if (publication.track) attachRemoteAudioRef.current(publication.track, participant);
                    });
                });

                // Create local audio track (muted by default)
                try {
                    const audioTracks = await room.localParticipant.createTracks({ audio: true, video: false });
                    const localAudioTrack = audioTracks.find(t => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;

                    if (localAudioTrack && !cancelled) {
                        audioTrackRef.current = localAudioTrack;
                        await localAudioTrack.mute();
                        setIsMuted(true);
                        await room.localParticipant.publishTrack(localAudioTrack);
                    }
                } catch (mediaErr) {
                    console.warn('[MicButton] Mic access denied or not found:', mediaErr);
                    // We stay connected (to hear others) even if we can't speak
                }

                if (!cancelled) setIsConnecting(false);
            } catch (e: any) {
                // Suppress ONLY clean user-initiated disconnects (component unmount etc.)
                // Do NOT suppress timeouts or connection errors — user needs to retry
                const message = String(e?.message || '');
                const isCleanDisconnect =
                    message.includes('Client initiated disconnect') ||
                    message.includes('UnexpectedConnectionState') ||
                    message.includes('PC manager is closed');
                if (!cancelled && !isCleanDisconnect) {
                    const normalizedMessage = message.toLowerCase();
                    if (!preferRelay && normalizedMessage.includes('could not establish pc connection')) {
                        console.warn('[MicButton] PC connection failed, retrying in relay-only mode');
                        setPreferRelay(true);
                        setRetryCount((prev) => prev + 1);
                        return;
                    }
                    console.error('[MicButton] Connection error:', e);
                    setError(e instanceof Error ? e.message : 'Failed to connect');
                } else if (isCleanDisconnect) {
                    console.log('[MicButton] Connection cleanly closed (expected).');
                }

                // Always clean up room ref on error so retry can reconnect
                if (roomRef.current) {
                    try { roomRef.current.disconnect(); } catch { }
                    roomRef.current = null;
                }

                if (!cancelled) {
                    setIsConnecting(false);
                }
            }
        };

        connect();

        return () => {
            cancelled = true;
            if (roomRef.current) {
                roomRef.current.disconnect();
                roomRef.current = null;
            }
            audioTrackRef.current = null;
            if (audioContainerRef.current) audioContainerRef.current.innerHTML = '';
        };
    }, [roomId, retryCount, livekitServerUrl]);

    const toggleMic = useCallback(async () => {
        if (error) {
            setRetryCount(prev => prev + 1);
            return;
        }
        if (!isConnected) return;

        // Try to create audio track if we don't have one (e.g., initial permission was denied or ignored)
        if (!audioTrackRef.current && roomRef.current) {
            setIsConnecting(true);
            try {
                const audioTracks = await roomRef.current.localParticipant.createTracks({ audio: true, video: false });
                const localAudioTrack = audioTracks.find(t => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;

                if (localAudioTrack) {
                    audioTrackRef.current = localAudioTrack;
                    await localAudioTrack.unmute();
                    setIsMuted(false);
                    await roomRef.current.localParticipant.publishTrack(localAudioTrack);
                }
            } catch (mediaErr) {
                console.warn('[MicButton] Mic access still denied:', mediaErr);
                setError('Mic access denied');
            } finally {
                setIsConnecting(false);
            }
            return;
        }

        if (!audioTrackRef.current) return;

        try {
            if (isMuted) {
                await audioTrackRef.current.unmute();
                setIsMuted(false);
            } else {
                await audioTrackRef.current.mute();
                setIsMuted(true);
            }
        } catch (e) {
            console.error('[MicButton] Toggle mic error:', e);
        }
    }, [isMuted, isConnected, error]);

    const handleRetry = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setRetryCount(prev => prev + 1);
    }, []);

    // Auto-mute when turn ends
    useEffect(() => {
        if (!freeTalk && !isMyTurn && !isMuted && audioTrackRef.current) {
            audioTrackRef.current.mute();
            setIsMuted(true);
        }
    }, [isMyTurn, isMuted, freeTalk]);

    const canSpeak = freeTalk || isMyTurn;
    const isDisabled = !canSpeak || isConnecting || (!isConnected && !error);

    return (
        <div className={`relative ${className}`}>
            <motion.button
                onClick={toggleMic}
                disabled={isDisabled}
                className={`
                    relative w-14 h-14 rounded-full flex items-center justify-center
                    transition-all duration-300 shadow-lg
                    ${isDisabled
                        ? 'bg-gray-800/50 border border-gray-600/30 cursor-not-allowed opacity-50'
                        : error
                            ? 'bg-red-900/40 border-2 border-red-500/50 hover:bg-red-800/60'
                            : isMuted
                                ? 'bg-gray-800/80 border-2 border-gray-500/50 hover:border-[#916A47]/70 hover:bg-gray-700/80'
                                : 'bg-green-600 border-2 border-green-400/70 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                    }
                `}
                whileHover={!isDisabled ? { scale: 1.05 } : {}}
                whileTap={!isDisabled ? { scale: 0.95 } : {}}
                title={
                    error ? `${error} (Click to retry)` :
                        !isConnected ? 'Connecting...' :
                            !canSpeak ? 'Not your turn' :
                                isMuted ? 'Click to speak' : 'Speaking (click to mute)'
                }
            >
                {/* Connection ring animation */}
                <AnimatePresence>
                    {isConnecting && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 rounded-full border-2 border-[#916A47]/50 animate-ping"
                        />
                    )}
                </AnimatePresence>

                {/* Speaking pulse animation */}
                <AnimatePresence>
                    {!isMuted && canSpeak && isConnected && (
                        <motion.div
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                            className="absolute inset-0 rounded-full bg-green-500"
                        />
                    )}
                </AnimatePresence>

                {/* Icon */}
                {isConnecting ? (
                    <Loader2 className="w-6 h-6 text-[#916A47] animate-spin" />
                ) : error ? (
                    <div className="flex flex-col items-center justify-center">
                        <MicOff className="w-5 h-5 text-red-500" />
                        <span className="text-[8px] text-red-400 font-bold">RETRY</span>
                    </div>
                ) : isMuted ? (
                    <MicOff className={`w-6 h-6 ${isDisabled ? 'text-gray-500' : 'text-gray-300'}`} />
                ) : (
                    <Mic className="w-6 h-6 text-white" />
                )}
            </motion.button>

            {/* Hidden audio container for remote participants */}
            <div
                ref={audioContainerRef}
                className="hidden"
                aria-hidden="true"
            />
        </div>
    );
}
