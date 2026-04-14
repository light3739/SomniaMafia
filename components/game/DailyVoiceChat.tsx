"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import {
    DailyAudio,
    DailyProvider,
    useAppMessage,
    useDaily,
    useLocalSessionId,
    useMeetingState,
    useParticipantProperty,
} from '@daily-co/daily-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mic, MicOff, Users, Volume2, X } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import { signRequest } from '@/services/requestSigning';
import { buildTokenMessage } from '@/services/signingSchema';
import { loadSession } from '@/services/sessionKeyService';
import { useGameSignaling, type GameSignal } from '@/hooks/useGameSignaling';

interface DailyVoiceChatProps {
    roomId: string;
    userName?: string;
    isActive: boolean;
    label?: string;
    className?: string;
    onClose?: () => void;
    showTextChat?: boolean;
    /** Mount the GameContext signal bridge. Must be false when rendered outside <GameProvider>. */
    enableGameSignaling?: boolean;
}

interface TokenResponse {
    token: string;
    roomUrl: string;
    roomName: string;
}

function makeSessionIdentity(baseName: string): string {
    const safeBase = (baseName || 'Player').replace(/\s+/g, '-');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${safeBase}-${suffix}`;
}

interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    mine: boolean;
}

function SafeTextChat({ displayName }: { displayName: string }) {
    const call = useDaily();
    const meetingState = useMeetingState();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useAppMessage<{ type?: string; sender?: string; content?: string }>({
        onAppMessage: (ev) => {
            const data = ev?.data;
            if (!data || data.type !== 'voice-chat' || typeof data.content !== 'string') return;
            const content: string = data.content;
            setMessages((prev) => [
                ...prev,
                {
                    id: `${Date.now()}_${ev.fromId ?? 'unknown'}`,
                    sender: data.sender || ev.fromId || 'Player',
                    content,
                    mine: false,
                },
            ]);
        },
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = useCallback(async () => {
        const content = input.trim();
        if (!content || sending || !call) return;
        setSending(true);
        try {
            call.sendAppMessage({ type: 'voice-chat', sender: displayName, content, timestamp: Date.now() }, '*');
            setMessages((prev) => [
                ...prev,
                { id: `${Date.now()}_self`, sender: 'You', content, mine: true },
            ]);
            setInput('');
        } finally {
            setSending(false);
        }
    }, [call, displayName, input, sending]);

    return (
        <div className="mt-4 bg-purple-950/20 border border-purple-500/20 rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-2 border-b border-purple-500/20 bg-purple-950/30">
                <span className="text-purple-400 text-xs font-medium">Text Chat</span>
                {meetingState !== 'joined-meeting' && (
                    <span className="text-[10px] text-yellow-400/80 ml-auto">{String(meetingState)}</span>
                )}
            </div>

            <div className="h-[200px] overflow-y-auto p-2 space-y-2">
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
        </div>
    );
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

function MicToggle() {
    const call = useDaily();
    const localSessionId = useLocalSessionId();
    const audioState = useParticipantProperty(localSessionId ?? '', 'tracks.audio.state');
    const isOff = audioState === 'off' || audioState === 'blocked';
    const toggle = useCallback(() => {
        if (!call) return;
        call.setLocalAudio(isOff);
    }, [call, isOff]);
    return (
        <button
            onClick={toggle}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-white text-sm"
            aria-label={isOff ? 'Unmute microphone' : 'Mute microphone'}
        >
            {isOff ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isOff ? 'Unmute' : 'Mute'}</span>
        </button>
    );
}

interface InnerProps extends DailyVoiceChatProps {
    token: string;
    roomUrl: string;
    sessionIdentity: string;
}

function DailyVoiceChatInner({
    roomId,
    isActive,
    label = 'Voice Chat',
    className = '',
    onClose,
    showTextChat = false,
    userName = 'Player',
    enableGameSignaling = false,
    token,
    roomUrl,
    sessionIdentity,
}: InnerProps) {
    const call = useDaily();
    const meetingState = useMeetingState();
    const [isMinimized, setIsMinimized] = useState(false);
    const joinedRef = useRef(false);

    useEffect(() => {
        if (!call || joinedRef.current) return;
        joinedRef.current = true;
        void call.join({ url: roomUrl, token, userName: sessionIdentity });
        return () => {
            joinedRef.current = false;
            void call.leave();
        };
    }, [call, roomUrl, token, sessionIdentity]);

    if (!isActive) return null;

    const connected = meetingState === 'joined-meeting';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`bg-gray-900/95 border border-purple-500/30 rounded-lg shadow-2xl ${className}`}
            >
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
                            <span className="text-purple-400 text-sm">{isMinimized ? '▲' : '▼'}</span>
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

                {!isMinimized && (
                    <div className="p-4">
                        <DailyAudio />
                        <div className="flex items-center gap-3">
                            <MicToggle />
                            <span className="text-xs text-gray-400">{connected ? 'Connected' : String(meetingState)}</span>
                        </div>
                        {enableGameSignaling && <GameSignalingBridge />}
                        {showTextChat && <SafeTextChat displayName={userName} />}
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                            <Users className="w-3 h-3" />
                            <span>Voice room: {roomId}</span>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

export function DailyVoiceChat(props: DailyVoiceChatProps) {
    const { roomId, userName = 'Player', isActive } = props;
    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();
    const addressRef = useRef(address);
    const chainIdRef = useRef(chainId);
    const walletClientRef = useRef(walletClient);
    const userNameRef = useRef(userName);
    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { chainIdRef.current = chainId; }, [chainId]);
    useEffect(() => { walletClientRef.current = walletClient; }, [walletClient]);
    useEffect(() => { userNameRef.current = userName; }, [userName]);

    const [sessionIdentity] = useState(() => makeSessionIdentity(userName));
    const [token, setToken] = useState<string>('');
    const [roomUrl, setRoomUrl] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const callObject = useMemo<DailyCall | null>(() => {
        if (!isActive || typeof window === 'undefined') return null;
        return DailyIframe.createCallObject();
    }, [isActive]);

    useEffect(() => {
        return () => {
            if (callObject) {
                void callObject.destroy();
            }
        };
    }, [callObject]);

    useEffect(() => {
        if (!isActive || !roomId || !sessionIdentity) {
            setToken('');
            setRoomUrl('');
            setStatusMessage(null);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                setError(null);
                setStatusMessage('Connecting to voice...');

                const roomIdPrefix = roomId.split('-')[0];
                const parsedRoomId = Number(roomIdPrefix);

                let playerAddress = addressRef.current || '';
                if (Number.isFinite(parsedRoomId)) {
                    const session = loadSession();
                    if (session && session.roomId === parsedRoomId && Date.now() < session.expiresAt) {
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

                const resp = await fetch('/api/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                });

                if (cancelled) return;

                if (!resp.ok) {
                    throw new Error(`Failed to get token: ${resp.status}`);
                }
                const data = (await resp.json()) as TokenResponse;
                if (!data.token || !data.roomUrl) throw new Error('Invalid token response');

                if (!cancelled) {
                    setToken(data.token);
                    setRoomUrl(data.roomUrl);
                    setStatusMessage(null);
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('[DailyVoiceChat] Token fetch error:', e);
                    setError(e instanceof Error ? e.message : 'Failed to connect');
                    setStatusMessage(null);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [isActive, roomId, sessionIdentity, retryCount]);

    if (!isActive) return null;

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    onClick={() => setRetryCount((n) => n + 1)}
                    className="mt-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 text-sm transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!token || !roomUrl || !callObject) {
        return (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-gray-400 text-sm">{statusMessage || 'Connecting to voice...'}</p>
            </div>
        );
    }

    return (
        <DailyProvider callObject={callObject}>
            <DailyVoiceChatInner
                {...props}
                token={token}
                roomUrl={roomUrl}
                sessionIdentity={sessionIdentity}
            />
        </DailyProvider>
    );
}
