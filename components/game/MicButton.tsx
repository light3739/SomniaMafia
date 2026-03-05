"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Room, RoomEvent, Track, LocalAudioTrack, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import { signRequest } from '@/services/requestSigning';
import { buildTokenMessage } from '@/services/signingSchema';

interface MicButtonProps {
    roomId: string;
    userName?: string;
    isMyTurn: boolean;
    freeTalk?: boolean; // When true, all players can talk freely (e.g. voting phase)
    className?: string;
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

    const roomRef = useRef<Room | null>(null);
    const audioTrackRef = useRef<LocalAudioTrack | null>(null);
    const audioContainerRef = useRef<HTMLDivElement | null>(null);

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
                const playerAddress = address || '';
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
                            walletClient,
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
                        chainId, // CRITICAL: Send current chainId to server
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
                        setIsConnected(false);
                        setParticipantCount(0);
                        console.log('[MicButton] Disconnected from room');
                    }
                });

                room.on(RoomEvent.Connected, () => {
                    if (!cancelled) {
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

                // Connect to room (timeout after 15s)
                const connectPromise = room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, data.token);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 15000));

                await Promise.race([connectPromise, timeoutPromise]);

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
                const isCleanDisconnect = e?.message?.includes('Client initiated disconnect');
                if (!cancelled && !isCleanDisconnect) {
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
    }, [roomId, address, walletClient, chainId, retryCount]);

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
