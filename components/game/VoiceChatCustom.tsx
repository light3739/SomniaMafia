// components/game/VoiceChatCustom.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Device, types } from 'mediasoup-client';
import { io, Socket } from 'socket.io-client';
import { Mic, MicOff, Volume2, VolumeX, Users, Loader2, AlertCircle, X, Minimize2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceChatProps {
    roomId: string;
    userName: string;
    isActive: boolean;
    label?: string;
}

interface Participant {
    id: string;
    name: string;
    isSpeaking: boolean;
    audioLevel: number;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export function VoiceChat({ roomId, userName, isActive, label = 'Voice Chat' }: VoiceChatProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [device, setDevice] = useState<Device | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [error, setError] = useState<string | null>(null);

    // Audio state
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [participants, setParticipants] = useState<Participant[]>([]);

    // Transport and producers/consumers
    const sendTransportRef = useRef<types.Transport | null>(null);
    const recvTransportRef = useRef<types.Transport | null>(null);
    const producerRef = useRef<types.Producer | null>(null);
    const consumersRef = useRef<Map<string, types.Consumer>>(new Map());
    const audioStreamRef = useRef<MediaStream | null>(null);

    // UI state
    const [isMinimized, setIsMinimized] = useState(false);

    const SFU_URL = process.env.NEXT_PUBLIC_SFU_URL || 'https://mafia-voice.serveminecraft.net';

    // Cleanup function
    const cleanup = useCallback(() => {
        console.log('[VoiceChat] Cleaning up...');

        // Stop all consumers
        consumersRef.current.forEach(consumer => {
            try {
                consumer.close();
            } catch (e) {
                console.warn('Failed to close consumer:', e);
            }
        });
        consumersRef.current.clear();

        // Close producer
        if (producerRef.current) {
            try {
                producerRef.current.close();
            } catch (e) {
                console.warn('Failed to close producer:', e);
            }
            producerRef.current = null;
        }

        // Close transports
        if (sendTransportRef.current) {
            try {
                sendTransportRef.current.close();
            } catch (e) {
                console.warn('Failed to close send transport:', e);
            }
            sendTransportRef.current = null;
        }

        if (recvTransportRef.current) {
            try {
                recvTransportRef.current.close();
            } catch (e) {
                console.warn('Failed to close recv transport:', e);
            }
            recvTransportRef.current = null;
        }

        // Stop audio tracks
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop());
            audioStreamRef.current = null;
        }

        // Disconnect socket
        if (socket) {
            socket.disconnect();
            setSocket(null);
        }

        setConnectionState('idle');
    }, [socket]);

    // Initialize connection
    useEffect(() => {
        if (!isActive || !roomId) {
            cleanup();
            return;
        }

        console.log('[VoiceChat] Initializing connection...', { roomId, userName, SFU_URL });
        setConnectionState('connecting');
        setError(null);

        const newSocket = io(SFU_URL, {
            transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
        });

        newSocket.on('connect', () => {
            console.log('[VoiceChat] Socket connected');

            // Join room
            newSocket.emit('join', {
                room_id: roomId,
                peer_name: userName,
                peer_audio: true,
                peer_video: false,
                peer_screen: false,
                peer_hand: false,
            }, (response: any) => {
                console.log('[VoiceChat] Join response:', response);
                if (response.error) {
                    setError(response.error);
                    setConnectionState('error');
                }
            });
        });

        newSocket.on('connect_error', (err) => {
            console.error('[VoiceChat] Connection error:', err);
            setError(`Connection failed: ${err.message}`);
            setConnectionState('error');
        });

        newSocket.on('disconnect', (reason) => {
            console.log('[VoiceChat] Disconnected:', reason);
            setConnectionState('idle');
        });

        // Get router RTP capabilities
        newSocket.on('routerCapabilities', async (rtpCapabilities: any) => {
            console.log('[VoiceChat] Received router capabilities');
            try {
                const newDevice = new Device();
                await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
                setDevice(newDevice);
                console.log('[VoiceChat] Device loaded');

                // Request to create send transport
                newSocket.emit('getRouterRtpCapabilities');
            } catch (err: any) {
                console.error('[VoiceChat] Failed to load device:', err);
                setError(`Device initialization failed: ${err.message}`);
                setConnectionState('error');
            }
        });

        newSocket.on('error', (error: any) => {
            console.error('[VoiceChat] Socket error:', error);
            setError(error.message || 'Unknown error');
            setConnectionState('error');
        });

        setSocket(newSocket);

        // Initial router capabilities request
        setTimeout(() => {
            newSocket.emit('getRouterRtpCapabilities');
        }, 1000);

        return () => {
            cleanup();
        };
    }, [isActive, roomId, userName, SFU_URL, cleanup]);

    // Start producing audio
    const startAudio = useCallback(async () => {
        if (!socket || !device || !roomId) {
            console.warn('[VoiceChat] Cannot start audio - missing dependencies');
            return;
        }

        try {
            console.log('[VoiceChat] Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: false,
            });

            audioStreamRef.current = stream;
            const audioTrack = stream.getAudioTracks()[0];
            console.log('[VoiceChat] Got audio track:', audioTrack.label);

            // Request send transport
            socket.emit('createWebRtcTransport', { producing: true }, async (params: any) => {
                console.log('[VoiceChat] Create send transport response:', params);

                if (params.error) {
                    setError(params.error);
                    return;
                }

                try {
                    const transport = device.createSendTransport(params);
                    sendTransportRef.current = transport;

                    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                        console.log('[VoiceChat] Send transport connecting...');
                        socket.emit('connectTransport', {
                            transport_id: transport.id,
                            dtlsParameters,
                        }, (response: any) => {
                            if (response.error) {
                                errback(new Error(response.error));
                            } else {
                                callback();
                            }
                        });
                    });

                    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
                        console.log('[VoiceChat] Producing...', kind);
                        socket.emit('produce', {
                            transport_id: transport.id,
                            kind,
                            rtpParameters,
                            appData,
                        }, (response: any) => {
                            if (response.error) {
                                errback(new Error(response.error));
                            } else {
                                callback({ id: response.producer_id });
                            }
                        });
                    });

                    transport.on('connectionstatechange', (state) => {
                        console.log('[VoiceChat] Send transport state:', state);
                        if (state === 'connected') {
                            setConnectionState('connected');
                        } else if (state === 'failed' || state === 'closed') {
                            setConnectionState('error');
                            setError('Connection failed');
                        }
                    });

                    // Start producing
                    const producer = await transport.produce({ track: audioTrack });
                    producerRef.current = producer;
                    console.log('[VoiceChat] Producer created:', producer.id);

                    setConnectionState('connected');
                } catch (err: any) {
                    console.error('[VoiceChat] Failed to create send transport:', err);
                    setError(err.message);
                    setConnectionState('error');
                }
            });
        } catch (err: any) {
            console.error('[VoiceChat] Failed to get user media:', err);
            setError(`Microphone access denied: ${err.message}`);
            setConnectionState('error');
        }
    }, [socket, device, roomId]);

    // Auto-start audio when device is ready
    useEffect(() => {
        if (device && connectionState === 'connecting') {
            startAudio();
        }
    }, [device, connectionState, startAudio]);

    // Handle new producers (other participants)
    useEffect(() => {
        if (!socket || !device) return;

        const handleNewProducer = async ({ producer_id, peer_id, peer_name }: any) => {
            console.log('[VoiceChat] New producer:', { producer_id, peer_id, peer_name });

            // Request recv transport if we don't have one
            if (!recvTransportRef.current) {
                socket.emit('createWebRtcTransport', { producing: false }, async (params: any) => {
                    if (params.error) {
                        console.error('[VoiceChat] Failed to create recv transport:', params.error);
                        return;
                    }

                    try {
                        const transport = device.createRecvTransport(params);
                        recvTransportRef.current = transport;

                        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
                            socket.emit('connectTransport', {
                                transport_id: transport.id,
                                dtlsParameters,
                            }, (response: any) => {
                                if (response.error) {
                                    errback(new Error(response.error));
                                } else {
                                    callback();
                                }
                            });
                        });

                        // Now consume the producer
                        consumeProducer(producer_id, peer_id, peer_name);
                    } catch (err) {
                        console.error('[VoiceChat] Failed to create recv transport:', err);
                    }
                });
            } else {
                // Already have recv transport, just consume
                consumeProducer(producer_id, peer_id, peer_name);
            }
        };

        const consumeProducer = (producer_id: string, peer_id: string, peer_name: string) => {
            if (!recvTransportRef.current) return;

            socket.emit('consume', {
                transport_id: recvTransportRef.current.id,
                producer_id,
                rtpCapabilities: device.rtpCapabilities,
            }, async (response: any) => {
                if (response.error) {
                    console.error('[VoiceChat] Failed to consume:', response.error);
                    return;
                }

                try {
                    const consumer = await recvTransportRef.current!.consume({
                        id: response.consumer_id,
                        producerId: producer_id,
                        kind: response.kind,
                        rtpParameters: response.rtpParameters,
                    });

                    consumersRef.current.set(consumer.id, consumer);

                    // Play audio
                    const audioElement = new Audio();
                    audioElement.srcObject = new MediaStream([consumer.track]);
                    audioElement.volume = volume;
                    audioElement.play().catch(err => {
                        console.error('[VoiceChat] Failed to play audio:', err);
                    });

                    // Add participant
                    setParticipants(prev => [...prev, {
                        id: peer_id,
                        name: peer_name,
                        isSpeaking: false,
                        audioLevel: 0,
                    }]);

                    console.log('[VoiceChat] Consumer created:', consumer.id);
                } catch (err) {
                    console.error('[VoiceChat] Failed to consume:', err);
                }
            });
        };

        socket.on('newProducer', handleNewProducer);

        return () => {
            socket.off('newProducer', handleNewProducer);
        };
    }, [socket, device, volume]);

    // Toggle mute
    const toggleMute = useCallback(() => {
        if (producerRef.current) {
            if (isMuted) {
                producerRef.current.resume();
            } else {
                producerRef.current.pause();
            }
            setIsMuted(!isMuted);
        }
    }, [isMuted]);

    // Handle volume change
    const handleVolumeChange = useCallback((newVolume: number) => {
        setVolume(newVolume);
        // Update all audio elements
        consumersRef.current.forEach(consumer => {
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                if (audio.srcObject) {
                    audio.volume = newVolume;
                }
            });
        });
    }, []);

    if (!isActive) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
        >
            <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-xl rounded-2xl border border-purple-500/20 shadow-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-purple-500/20 bg-black/20">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${connectionState === 'connected' ? 'bg-green-500/20' :
                            connectionState === 'connecting' ? 'bg-yellow-500/20' :
                                connectionState === 'error' ? 'bg-red-500/20' :
                                    'bg-gray-500/20'
                            }`}>
                            {connectionState === 'connecting' ? (
                                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                            ) : connectionState === 'error' ? (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                            ) : (
                                <Volume2 className="w-4 h-4 text-green-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">{label}</h3>
                            <p className="text-[10px] text-white/50">
                                {connectionState === 'connected' ? `${participants.length + 1} participants` :
                                    connectionState === 'connecting' ? 'Connecting...' :
                                        connectionState === 'error' ? 'Connection failed' :
                                            'Initializing...'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            {isMinimized ? (
                                <Maximize2 className="w-4 h-4 text-white/70" />
                            ) : (
                                <Minimize2 className="w-4 h-4 text-white/70" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <AnimatePresence>
                    {!isMinimized && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-4 space-y-3">
                                {/* Error message */}
                                {error && (
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                        <p className="text-xs text-red-300">{error}</p>
                                    </div>
                                )}

                                {/* Controls */}
                                <div className="flex items-center gap-2">
                                    {/* Mute button */}
                                    <button
                                        onClick={toggleMute}
                                        disabled={connectionState !== 'connected'}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isMuted
                                            ? 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30'
                                            : 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isMuted ? (
                                            <><MicOff className="w-4 h-4" /> Muted</>
                                        ) : (
                                            <><Mic className="w-4 h-4" /> Speaking</>
                                        )}
                                    </button>

                                    {/* Volume control */}
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-purple-500/20">
                                        {volume === 0 ? (
                                            <VolumeX className="w-4 h-4 text-white/50" />
                                        ) : (
                                            <Volume2 className="w-4 h-4 text-white/70" />
                                        )}
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={volume}
                                            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                            className="w-20 accent-purple-500"
                                        />
                                    </div>
                                </div>

                                {/* Participants list */}
                                {participants.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-white/50 text-xs">
                                            <Users className="w-3 h-3" />
                                            <span>Participants ({participants.length})</span>
                                        </div>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {participants.map(participant => (
                                                <div
                                                    key={participant.id}
                                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/20 border border-purple-500/10"
                                                >
                                                    <div className={`w-2 h-2 rounded-full ${participant.isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                                                        }`} />
                                                    <span className="text-xs text-white/70">{participant.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
