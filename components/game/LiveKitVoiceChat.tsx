"use client";

import { LiveKitRoom, RoomAudioRenderer, ControlBar, useRoomContext } from "@livekit/components-react";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, X, Loader2, Users } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import { signRequest } from '@/services/requestSigning';
import { buildTokenMessage } from '@/services/signingSchema';
import { loadSession } from '@/services/sessionKeyService';
import { ConnectionState, RoomEvent } from 'livekit-client';
import { useGameSignaling, type GameSignal } from '@/hooks/useGameSignaling';

interface VoiceChatMessage {
    id: string;
    sender: string;
    content: string;
    mine: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function normalizeLiveKitWsUrl(rawUrl?: string): string | undefined {
    if (!rawUrl) return undefined;
    if (rawUrl.startsWith('wss://') || rawUrl.startsWith('ws://')) return rawUrl;
    if (rawUrl.startsWith('https://')) return rawUrl.replace('https://', 'wss://');
    if (rawUrl.startsWith('http://')) return rawUrl.replace('http://', 'ws://');
    return `wss://${rawUrl}`;
}

/**
 * Mounted INSIDE <LiveKitRoom> — bridges LiveKit DataChannel to GameContext.
 * Uses the global Signal Bus (Event Bus pattern) to send outgoing signals.
 */
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

function shouldPreferSameOriginLiveKit(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /firefox/i.test(navigator.userAgent);
}

function buildLiveKitServerUrls(rawUrl?: string): string[] {
    const urls: string[] = [];
    const primary = normalizeLiveKitWsUrl(rawUrl) || 'wss://livekit.mafiaonchain.live';
    const sameOrigin = typeof window !== 'undefined'
        ? normalizeLiveKitWsUrl(`${window.location.origin}/livekit`)
        : undefined;

    if (shouldPreferSameOriginLiveKit() && sameOrigin) {
        urls.push(sameOrigin);
    }
    urls.push(primary);
    if (!shouldPreferSameOriginLiveKit() && sameOrigin) {
        urls.push(sameOrigin);
    }

    return Array.from(new Set(urls.filter(Boolean))) as string[];
}

function SafeTextChat({ displayName }: { displayName: string }) {
    const room = useRoomContext();
    const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>(room.state);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleConnectionStateChanged = (state: ConnectionState) => {
            setConnectionState(state);
            if (state === ConnectionState.Connected) {
                setChatError(null);
            }
        };

        room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
        return () => {
            room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
        };
    }, [room]);

    useEffect(() => {
        const handleData = (payload: Uint8Array, participant?: any) => {
            try {
                const text = decoder.decode(payload);
                const data = JSON.parse(text);
                if (data?.type !== 'chat' || typeof data?.content !== 'string') return;

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `${Date.now()}_${participant?.identity || 'unknown'}`,
                        sender: data.sender || participant?.identity || 'Player',
                        content: data.content,
                        mine: false,
                    },
                ]);
            } catch {
                // Ignore non-chat payloads
            }
        };

        room.on(RoomEvent.DataReceived, handleData);
        return () => {
            room.off(RoomEvent.DataReceived, handleData);
        };
    }, [room]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = useCallback(async () => {
        const content = input.trim();
        if (!content || sending) return;

        setSending(true);
        setChatError(null);
        try {
            const payload = encoder.encode(JSON.stringify({
                type: 'chat',
                sender: displayName || room.localParticipant?.identity || 'Player',
                content,
                timestamp: Date.now(),
            }));

            await room.localParticipant.publishData(payload, { reliable: true });

            setMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}_self`,
                    sender: 'You',
                    content,
                    mine: true,
                },
            ]);
            setInput('');
        } catch (error: any) {
            const message = String(error?.message || '');
            if (
                message.includes('UnexpectedConnectionState') ||
                message.includes('PC manager is closed') ||
                message.includes('Client initiated disconnect')
            ) {
                setChatError('Connection closed. Rejoin room to continue chat.');
                return;
            }
            setChatError('Failed to send message');
        } finally {
            setSending(false);
        }
    }, [displayName, input, room, sending]);

    return (
        <div className="mt-4 bg-purple-950/20 border border-purple-500/20 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-2 border-b border-purple-500/20 bg-purple-950/30">
                <span className="text-purple-400 text-xs font-medium">Text Chat</span>
                {connectionState !== ConnectionState.Connected && (
                    <span className="text-[10px] text-yellow-400/80 ml-auto">{String(connectionState).toLowerCase()}...</span>
                )}
            </div>

            <div className="h-[200px] overflow-y-auto p-2 space-y-2 livekit-chat-custom">
                {messages.length === 0 && (
                    <p className="text-xs text-white/40 text-center mt-16">No messages yet</p>
                )}
                {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs ${message.mine ? 'bg-purple-700/40 text-white' : 'bg-white/10 text-white/90'}`}>
                            <p className="text-[10px] text-purple-300 mb-1">{message.sender}</p>
                            <p>{message.content}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-2 border-t border-purple-500/20 flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                        }
                    }}
                    placeholder="Type a message"
                    className="flex-1 bg-black/40 border border-purple-500/30 rounded-lg text-white px-3 py-2 text-xs focus:outline-none"
                    maxLength={300}
                />
                <button
                    onClick={() => void sendMessage()}
                    disabled={sending || !input.trim()}
                    className="px-3 py-2 rounded-lg text-xs bg-purple-600/50 text-white disabled:opacity-40"
                >
                    Send
                </button>
            </div>
            {chatError && <p className="px-3 pb-2 text-[10px] text-red-300">{chatError}</p>}
        </div>
    );
}

interface LiveKitVoiceChatProps {
    roomId: string;
    userName?: string;
    isActive: boolean;
    label?: string;
    className?: string;
    onClose?: () => void;
    showTextChat?: boolean; // Show text chat alongside voice
}


/** Stable session identity — created once per userName, survives reconnects */
function makeSessionIdentity(baseName: string): string {
    const safeBase = (baseName || 'Player').replace(/\s+/g, '-');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${safeBase}-${suffix}`;
}

/** Minimum delay (ms) between automatic reconnect attempts */
const RECONNECT_COOLDOWN_MS = 5000;
/** Maximum number of automatic reconnect attempts before requiring manual action */
const MAX_AUTO_RECONNECTS = 5;
/** If a connection dies shortly after connect, force relay-only on next attempt */
const SHORT_ICE_CONNECTION_MS = 20000;

export function LiveKitVoiceChat({
    roomId,
    userName = 'Player',
    isActive,
    label = 'Voice Chat',
    className = '',
    onClose,
    showTextChat = false,
}: LiveKitVoiceChatProps) {
    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();
    const addressRef = useRef(address);
    const chainIdRef = useRef(chainId);
    const walletClientRef = useRef(walletClient);
    const userNameRef = useRef(userName);
    const [token, setToken] = useState("");
    const [turnServers, setTurnServers] = useState<RTCIceServer[]>([]);
    const [relayOnly, setRelayOnly] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [sessionIdentity] = useState(() => makeSessionIdentity(userName));
    const [connectAttempt, setConnectAttempt] = useState(0);
    const [serverUrlIndex, setServerUrlIndex] = useState(0);
    const [roomState, setRoomState] = useState<ConnectionState>(ConnectionState.Disconnected);
    const livekitServerUrls = useMemo(() => buildLiveKitServerUrls(process.env.NEXT_PUBLIC_LIVEKIT_URL), []);
    const livekitServerUrl = livekitServerUrls[Math.min(serverUrlIndex, livekitServerUrls.length - 1)] || 'wss://livekit.mafiaonchain.live';

    // Reconnect tracking refs (not state — avoids render cascades)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoReconnectCountRef = useRef(0);
    const lastReconnectAtRef = useRef(0);
    const isReconnectingRef = useRef(false);
    const connectedAtRef = useRef(0);

    // connectOptions: include TURNS:443/tcp ICE server for VPN/firewall users.
    // livekit-client APPENDS these to the server-provided ICE servers.
    const connectOptions = useMemo(() => ({
        autoSubscribe: true,
        rtcConfig: (turnServers.length > 0 || relayOnly) ? {
            ...(turnServers.length > 0 ? {
                iceServers: turnServers,
            } : {}),
            ...(relayOnly ? {
                iceTransportPolicy: 'relay' as RTCIceTransportPolicy,
            } : {}),
        } : undefined,
    }), [relayOnly, turnServers]);

    const switchToRelayOnly = useCallback((reason: string) => {
        setRelayOnly((prev) => {
            if (prev) return prev;
            console.warn('[LiveKitVoiceChat] Switching to relay-only mode:', reason);
            setStatusMessage('Switching to strict relay mode...');
            setError(null);
            return true;
        });
    }, []);

    const switchServerUrl = useCallback((reason: string) => {
        let switched = false;
        setServerUrlIndex((prev) => {
            if (prev >= livekitServerUrls.length - 1) return prev;
            switched = true;
            return prev + 1;
        });
        if (switched) {
            console.warn('[LiveKitVoiceChat] Switching signaling endpoint:', reason);
            setStatusMessage('Switching voice endpoint...');
            setError(null);
        }
        return switched;
    }, [livekitServerUrls.length]);

    /**
     * Schedule a reconnect with cooldown enforcement.
     * Manual reconnects bypass the auto-reconnect counter.
     */
    const scheduleReconnect = useCallback((manual = false) => {
        // Prevent overlapping reconnects
        if (isReconnectingRef.current && !manual) return;

        // Enforce auto-reconnect limit
        if (!manual && autoReconnectCountRef.current >= MAX_AUTO_RECONNECTS) {
            console.warn('[LiveKitVoiceChat] Auto-reconnect limit reached, waiting for manual retry');
            setError('Connection lost. Please reconnect manually.');
            setStatusMessage(null);
            return;
        }

        // Enforce cooldown
        const now = Date.now();
        const elapsed = now - lastReconnectAtRef.current;
        const delay = manual ? 300 : Math.max(RECONNECT_COOLDOWN_MS - elapsed, 500);

        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
        }

        isReconnectingRef.current = true;
        setStatusMessage('Reconnecting to voice...');
        setError(null);

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            lastReconnectAtRef.current = Date.now();
            if (manual) {
                autoReconnectCountRef.current = 0;
            } else {
                autoReconnectCountRef.current += 1;
            }
            isReconnectingRef.current = false;
            setToken('');
            setConnectAttempt((prev) => prev + 1);
        }, delay);
    }, []);

    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { chainIdRef.current = chainId; }, [chainId]);
    useEffect(() => { walletClientRef.current = walletClient; }, [walletClient]);
    useEffect(() => { userNameRef.current = userName; }, [userName]);

    useEffect(() => {
        setRelayOnly(false);
        setServerUrlIndex(0);
        connectedAtRef.current = 0;
        autoReconnectCountRef.current = 0;
        lastReconnectAtRef.current = 0;
        isReconnectingRef.current = false;
    }, [roomId, sessionIdentity]);

    useEffect(() => {
        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
        };
    }, []);

    // Token fetch effect — runs on mount and on connectAttempt bump
    useEffect(() => {
        if (!isActive || !roomId || !sessionIdentity) {
            setToken("");
            setTurnServers([]);
            setRelayOnly(false);
            setServerUrlIndex(0);
            setStatusMessage(null);
            setRoomState(ConnectionState.Disconnected);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                setError(null);
                setStatusMessage('Connecting to voice...');
                // Prefer the session row's mainWallet over wagmi's address.
                // See MicButton for the rationale: useAccount() races during
                // navigation / cold-start and can return a wallet that doesn't
                // own the session — signRequest then falls back to
                // walletClient.signMessage and Privy embedded mounts its
                // confirmation modal as an unwanted "register" popup.
                const roomIdPrefix = roomId.split('-')[0];
                const parsedRoomId = Number(roomIdPrefix);

                let playerAddress = addressRef.current || '';
                if (Number.isFinite(parsedRoomId)) {
                    const session = loadSession();
                    if (
                        session &&
                        session.roomId === parsedRoomId &&
                        Date.now() < session.expiresAt
                    ) {
                        playerAddress = session.mainWallet;
                    }
                }

                let signature: `0x${string}` | undefined;
                let signerAddress: string | undefined;
                let nonce: string | undefined;
                let timestamp: number | undefined;

                if (playerAddress && Number.isFinite(parsedRoomId)) {
                    const signed = await signRequest({
                        address: playerAddress,
                        roomId: parsedRoomId,
                        walletClient: walletClientRef.current,
                        buildMessage: ({ nonce: n, timestamp: t }) => buildTokenMessage({
                            room: roomId,
                            username: userNameRef.current,
                            playerAddress,
                            nonce: n,
                            timestamp: t,
                            chainId: chainIdRef.current,
                        }),
                    });
                    signature = signed.signature;
                    signerAddress = signed.signerAddress;
                    nonce = signed.nonce;
                    timestamp = signed.timestamp;
                }

                if (cancelled) return;

                const resp = await fetch("/api/token", {
                    method: "POST",
                    body: JSON.stringify({
                        room: roomId,
                        username: sessionIdentity,
                        playerAddress,
                        signerAddress,
                        signature,
                        nonce,
                        timestamp,
                        chainId: chainIdRef.current,
                    }),
                    headers: { "Content-Type": "application/json" },
                });

                if (cancelled) return;

                if (!resp.ok) {
                    throw new Error(`Failed to get token: ${resp.status}`);
                }

                const data = await resp.json();
                if (data.error) throw new Error(data.error);

                if (!cancelled) {
                    setToken(data.token);
                    if (Array.isArray(data.turnServers)) {
                        setTurnServers(data.turnServers);
                    }
                    setRoomState(ConnectionState.Connecting);
                    setStatusMessage('Connecting to voice...');
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('[LiveKitVoiceChat] Token fetch error:', e);
                    setError(e instanceof Error ? e.message : 'Failed to connect');
                    setStatusMessage(null);
                    setRoomState(ConnectionState.Disconnected);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [isActive, roomId, sessionIdentity, connectAttempt]);

    if (!isActive) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`bg-gray-900/95 border border-purple-500/30 rounded-lg shadow-2xl ${className}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20">
                    <div className="flex items-center gap-2">
                        <Volume2 className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-white">{label}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                            title={isMinimized ? 'Expand' : 'Minimize'}
                        >
                            <span className="text-purple-400 text-sm">
                                {isMinimized ? '▲' : '▼'}
                            </span>
                        </button>

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                title="Close"
                            >
                                <X className="w-4 h-4 text-red-400" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {!isMinimized && (
                    <div className="p-4">
                        {!token && !error && (
                            <div className="flex flex-col items-center justify-center py-8 gap-3">
                                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                                <p className="text-gray-400 text-sm">{statusMessage || 'Connecting to voice...'}</p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                                <p className="text-red-400 text-sm">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="mt-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 text-sm transition-colors"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {token && !error && (
                            <div className="relative">
                                <LiveKitRoom
                                    key={`${roomId}-${sessionIdentity}-${connectAttempt}-${serverUrlIndex}`}
                                    video={false}
                                    audio={true}
                                    token={token}
                                    serverUrl={livekitServerUrl}
                                    connectOptions={connectOptions}
                                    onConnected={() => {
                                        connectedAtRef.current = Date.now();
                                        setRoomState(ConnectionState.Connected);
                                        setError(null);
                                        setStatusMessage(null);
                                        autoReconnectCountRef.current = 0;
                                    }}
                                    onDisconnected={() => {
                                        const connectedForMs = connectedAtRef.current > 0
                                            ? Date.now() - connectedAtRef.current
                                            : 0;
                                        connectedAtRef.current = 0;
                                        setRoomState(ConnectionState.Disconnected);
                                        if (!isActive) return;
                                        if (
                                            connectedForMs === 0 &&
                                            switchServerUrl('signaling closed before ICE established')
                                        ) {
                                            scheduleReconnect(true);
                                            return;
                                        }
                                        if (
                                            !relayOnly &&
                                            turnServers.length > 0 &&
                                            connectedForMs > 0 &&
                                            connectedForMs < SHORT_ICE_CONNECTION_MS
                                        ) {
                                            switchToRelayOnly(`short ICE connection (${connectedForMs}ms)`);
                                            scheduleReconnect(true);
                                            return;
                                        }
                                        console.log('[LiveKitVoiceChat] Disconnected, scheduling auto-reconnect');
                                        scheduleReconnect(false);
                                    }}
                                    onError={(eventError: Error) => {
                                        const msg = String(eventError?.message || '').toLowerCase();
                                        // Transient errors during reconnect — ignore silently
                                        if (
                                            msg.includes('client initiated disconnect') ||
                                            msg.includes('websocket is closed before') ||
                                            msg.includes('unexpectedconnectionstate') ||
                                            msg.includes('pc manager is closed')
                                        ) {
                                            if (msg.includes('websocket is closed before') && switchServerUrl('websocket closed before established')) {
                                                scheduleReconnect(true);
                                                return;
                                            }
                                            console.log('[LiveKitVoiceChat] Transient error (ignored):', msg.slice(0, 80));
                                            return;
                                        }
                                        if (
                                            !relayOnly &&
                                            turnServers.length > 0 &&
                                            msg.includes('could not establish pc connection')
                                        ) {
                                            switchToRelayOnly('pc connection failed before stable ICE');
                                            setRoomState(ConnectionState.Disconnected);
                                            scheduleReconnect(true);
                                            return;
                                        }
                                        // Real connection failure — schedule reconnect
                                        console.error('[LiveKitVoiceChat] Connection error:', msg.slice(0, 120));
                                        setRoomState(ConnectionState.Disconnected);
                                        scheduleReconnect(false);
                                    }}
                                    data-lk-theme="default"
                                    style={{
                                        minHeight: '200px',
                                        background: 'transparent',
                                    }}
                                    className="livekit-room-custom"
                                >
                                    <RoomAudioRenderer />
                                    <ControlBar
                                        controls={{
                                            camera: false,
                                            screenShare: false,
                                            chat: false,
                                        }}
                                        className="bg-gray-800/50 rounded-lg"
                                    />
                                    {/* Game signaling bridge — listens for DataReceived and updates GameContext */}
                                    <GameSignalingBridge />

                                    {showTextChat && <SafeTextChat displayName={userName} />}
                                </LiveKitRoom>

                                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                                    <Users className="w-3 h-3" />
                                    <span>Voice room: {roomId}</span>
                                    {relayOnly && (
                                        <span className="rounded border border-amber-500/40 px-2 py-1 text-[10px] text-amber-300">
                                            relay-only
                                        </span>
                                    )}
                                    {roomState !== ConnectionState.Connected && (
                                        <button
                                            onClick={() => scheduleReconnect(true)}
                                            className="ml-2 px-2 py-1 rounded border border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                                        >
                                            Reconnect
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Custom Styles for Chat */}
                {showTextChat && (
                    <style jsx global>{`
                        .livekit-chat-custom {
                            font-family: inherit;
                        }
                        
                        .livekit-chat-custom input {
                            background: rgba(0, 0, 0, 0.4) !important;
                            border: 1px solid rgba(168, 85, 247, 0.3) !important;
                            border-radius: 8px !important;
                            color: white !important;
                            padding: 8px 12px !important;
                            font-size: 13px !important;
                        }
                        
                        .livekit-chat-custom input::placeholder {
                            color: rgba(255, 255, 255, 0.3) !important;
                        }
                        
                        .livekit-chat-custom input:focus {
                            outline: none !important;
                            border-color: rgba(168, 85, 247, 0.5) !important;
                        }
                        
                        .livekit-chat-custom button {
                            background: rgba(168, 85, 247, 0.3) !important;
                            border-radius: 8px !important;
                            color: rgba(168, 85, 247, 1) !important;
                            transition: all 0.2s !important;
                        }
                        
                        .livekit-chat-custom button:hover {
                            background: rgba(168, 85, 247, 0.4) !important;
                        }
                        
                        .livekit-chat-custom [data-lk-message] {
                            padding: 6px 12px !important;
                            margin: 4px 0 !important;
                            border-radius: 8px !important;
                            background: rgba(168, 85, 247, 0.05) !important;
                            font-size: 13px !important;
                        }
                        
                        .livekit-chat-custom [data-lk-message-body] {
                            color: rgba(255, 255, 255, 0.9) !important;
                        }
                        
                        .livekit-chat-custom [data-lk-message-sender] {
                            color: rgba(168, 85, 247, 0.8) !important;
                            font-weight: 600 !important;
                            font-size: 12px !important;
                        }
                    `}</style>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
