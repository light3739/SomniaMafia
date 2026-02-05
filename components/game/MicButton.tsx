"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Room, RoomEvent, Track, LocalAudioTrack, RemoteTrack, RemoteTrackPublication, RemoteParticipant } from 'livekit-client';

interface MicButtonProps {
    roomId: string;
    userName?: string;
    isMyTurn: boolean;
    className?: string;
}

export function MicButton({
    roomId,
    userName = 'Player',
    isMyTurn,
    className = '',
}: MicButtonProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [error, setError] = useState<string | null>(null);
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

    // Connect to LiveKit room on mount
    useEffect(() => {
        if (!roomId) return;

        // Skip if already connected
        if (roomRef.current) {
            console.log('[MicButton] Already have room instance, skipping connect');
            return;
        }

        let cancelled = false;

        const connect = async () => {
            console.log('[MicButton] Starting connection...');
            setIsConnecting(true);
            setError(null);

            try {
                // Get token from API
                const resp = await fetch("/api/token", {
                    method: "POST",
                    body: JSON.stringify({ room: roomId, username: userNameRef.current }),
                    headers: { "Content-Type": "application/json" },
                });

                if (!resp.ok) {
                    throw new Error(`Failed to get token: ${resp.status}`);
                }

                const data = await resp.json();
                if (data.error) {
                    throw new Error(data.error);
                }

                if (cancelled) return;

                // Create and connect room
                const room = new Room({
                    // Auto-subscribe to audio tracks
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

                // Handle remote tracks - SUBSCRIBE TO AUDIO (use ref to avoid stale closure)
                room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                    if (!cancelled) {
                        attachRemoteAudioRef.current(track, participant);
                    }
                });

                room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                    if (!cancelled) {
                        detachRemoteAudioRef.current(track, participant);
                    }
                });

                // Track participant count
                room.on(RoomEvent.ParticipantConnected, () => {
                    setParticipantCount(room.remoteParticipants.size + 1);
                });

                room.on(RoomEvent.ParticipantDisconnected, () => {
                    setParticipantCount(room.remoteParticipants.size + 1);
                });

                // Connect to room
                await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, data.token);

                if (cancelled) {
                    room.disconnect();
                    return;
                }

                // Attach any existing remote audio tracks (use ref)
                room.remoteParticipants.forEach((participant) => {
                    participant.audioTrackPublications.forEach((publication) => {
                        if (publication.track) {
                            attachRemoteAudioRef.current(publication.track, participant);
                        }
                    });
                });

                // Create local audio track (muted by default)
                const audioTrack = await room.localParticipant.createTracks({
                    audio: true,
                    video: false,
                });

                const localAudioTrack = audioTrack.find(t => t.kind === Track.Kind.Audio) as LocalAudioTrack | undefined;

                if (localAudioTrack) {
                    audioTrackRef.current = localAudioTrack;
                    // Start muted
                    await localAudioTrack.mute();
                    setIsMuted(true);

                    // Publish the track
                    await room.localParticipant.publishTrack(localAudioTrack);
                }

                setIsConnecting(false);
            } catch (e) {
                console.error('[MicButton] Connection error:', e);
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Failed to connect');
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

            // Clean up any remaining audio elements
            if (audioContainerRef.current) {
                audioContainerRef.current.innerHTML = '';
            }
        };
    }, [roomId]); // Only reconnect if roomId changes (userName stored in ref)

    // Toggle microphone
    const toggleMic = useCallback(async () => {
        if (!audioTrackRef.current || !isConnected) return;

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
    }, [isMuted, isConnected]);

    // Auto-mute when turn ends
    useEffect(() => {
        if (!isMyTurn && !isMuted && audioTrackRef.current) {
            audioTrackRef.current.mute();
            setIsMuted(true);
        }
    }, [isMyTurn, isMuted]);

    const isDisabled = !isMyTurn || isConnecting || !isConnected || !!error;

    return (
        <>
            <motion.button
                onClick={toggleMic}
                disabled={isDisabled}
                className={`
                relative w-14 h-14 rounded-full flex items-center justify-center
                transition-all duration-300 shadow-lg
                ${isDisabled
                        ? 'bg-gray-800/50 border border-gray-600/30 cursor-not-allowed opacity-50'
                        : isMuted
                            ? 'bg-gray-800/80 border-2 border-gray-500/50 hover:border-[#916A47]/70 hover:bg-gray-700/80'
                            : 'bg-green-600 border-2 border-green-400/70 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                    }
                ${className}
            `}
                whileHover={!isDisabled ? { scale: 1.05 } : {}}
                whileTap={!isDisabled ? { scale: 0.95 } : {}}
                title={
                    error ? error :
                        !isConnected ? 'Connecting...' :
                            !isMyTurn ? 'Not your turn' :
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
                    {!isMuted && isMyTurn && (
                        <motion.div
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 1.5, opacity: 0 }}
                            transition={{
                                repeat: Infinity,
                                duration: 1.5,
                                ease: "easeOut"
                            }}
                            className="absolute inset-0 rounded-full bg-green-500"
                        />
                    )}
                </AnimatePresence>

                {/* Icon */}
                {isConnecting ? (
                    <Loader2 className="w-6 h-6 text-[#916A47] animate-spin" />
                ) : isMuted ? (
                    <MicOff className={`w-6 h-6 ${isDisabled ? 'text-gray-500' : 'text-gray-300'}`} />
                ) : (
                    <Mic className="w-6 h-6 text-white" />
                )}

                {/* Your turn indicator */}
                {isMyTurn && isConnected && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-[#916A47] rounded-full flex items-center justify-center"
                    >
                        <div className="w-2 h-2 bg-white rounded-full" />
                    </motion.div>
                )}

                {/* Error indicator */}
                {error && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full"
                    />
                )}

                {/* Participant count badge */}
                {isConnected && participantCount > 1 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-1 -left-1 min-w-[18px] h-[18px] px-1 bg-blue-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                    >
                        {participantCount}
                    </motion.div>
                )}
            </motion.button>

            {/* Hidden audio container for remote participants */}
            <div
                ref={audioContainerRef}
                className="hidden"
                aria-hidden="true"
            />
        </>
    );
}
