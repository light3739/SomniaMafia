// components/game/ShuffleAndReveal.tsx
// Single unified window for SHUFFLING → REVEAL phases.
// The outer chrome (header, suspects sidebar, footer) persists across both phases.
// Only the RIGHT panel content swaps smoothly with AnimatePresence.

import React, {
    useEffect, useState, useCallback, useRef
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { useAccount, useWalletClient, usePublicClient, useWriteContract } from 'wagmi';
import { GamePhase, Role } from '../../types';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { MAFIA_ABI } from '../../contracts/config';
import {
    Check, RefreshCw, Users, Skull, Shield, Search, Loader2, EyeOff
} from 'lucide-react';
import { Button } from '../ui/Button';
import {
    registerEciesPubkey, submitSraKeyToGm, fetchMyRoleFromGm
} from '../../services/gmService';
import { loadOrCreateKeypair } from '../../services/eciesService';

// ─── Shared ────────────────────────────────────────────────────────────────────

const AsciiSpinner: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [frame, setFrame] = useState(0);
    const frames = ['|', '/', '-', '\\'];
    useEffect(() => {
        const iv = setInterval(() => setFrame(p => (p + 1) % frames.length), 120);
        return () => clearInterval(iv);
    }, []);
    return <span className={`font-mono font-bold inline-block ${className}`}>{frames[frame]}</span>;
};

// ─── Role config (Reveal) ──────────────────────────────────────────────────────

const RoleConfig: Record<Role, {
    icon: React.ReactNode;
    color: string; bgColor: string; borderColor: string; ringColor: string;
    description: string; label: string;
}> = {
    [Role.MAFIA]: {
        icon: <Skull className="w-20 h-20" />,
        color: 'text-[#8B0000]', bgColor: 'from-[#8B0000]/25 to-[#0A0705]/80',
        borderColor: 'border-[#8B0000]/30', ringColor: 'ring-[#8B0000]/10',
        label: 'MAFIA', description: 'Eliminate all civilians to win. Vote by day, kill by night.'
    },
    [Role.DOCTOR]: {
        icon: <Shield className="w-20 h-20" />,
        color: 'text-[#2D6A4F]', bgColor: 'from-[#1B4332]/30 to-[#0A0705]/80',
        borderColor: 'border-[#2D6A4F]/25', ringColor: 'ring-[#2D6A4F]/8',
        label: 'DOCTOR', description: 'Save one player each night from the mafia attack.'
    },
    [Role.DETECTIVE]: {
        icon: <Search className="w-20 h-20" />,
        color: 'text-[#94A3B8]', bgColor: 'from-[#1E293B]/30 to-[#0A0705]/80',
        borderColor: 'border-[#94A3B8]/20', ringColor: 'ring-[#94A3B8]/8',
        label: 'DETECTIVE', description: 'Investigate one player each night to reveal their alignment.'
    },
    [Role.CIVILIAN]: {
        icon: <Users className="w-20 h-20" />,
        color: 'text-[#78716C]', bgColor: 'from-[#292524]/40 to-[#0A0705]/80',
        borderColor: 'border-[#78716C]/20', ringColor: 'ring-[#78716C]/8',
        label: 'CIVILIAN', description: 'Find and vote out the mafia during the day to survive.'
    },
    [Role.UNKNOWN]: {
        icon: <EyeOff className="w-20 h-20" />,
        color: 'text-stone-600', bgColor: 'from-stone-950/50 to-[#0A0705]/80',
        borderColor: 'border-stone-700/20', ringColor: 'ring-stone-700/8',
        label: 'UNKNOWN', description: 'Role unknown'
    }
};

// ─── ShufflePanel (right content during SHUFFLING) ────────────────────────────

interface ShufflePanelProps {
    shuffleState: {
        currentShufflerIndex: number;
        deck: string[];
        isMyTurn: boolean;
        hasCommitted: boolean;
        hasRevealed: boolean;
        isFailed: boolean;
        phaseDeadline: number;
    };
    progress: number;
    isProcessing: boolean;
    isTxPending: boolean;
    currentShufflerName?: string;
    onRetry: () => void;
}

const ShufflePanel: React.FC<ShufflePanelProps> = ({
    shuffleState, progress, isProcessing, isTxPending, currentShufflerName, onRetry
}) => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        {/* Spinner */}
        <div className="w-14 h-14 flex items-center justify-center opacity-85">
            {shuffleState.hasRevealed ? (
                <span className="font-mono text-[#916A47] text-4xl">✓</span>
            ) : shuffleState.isFailed ? (
                <span className="font-mono text-[#8B0000] text-4xl">✗</span>
            ) : (
                <AsciiSpinner className="text-[#916A47] text-4xl" />
            )}
        </div>

        {/* Status */}
        <div className="text-center">
            <p className="font-mono text-[11px] tracking-[0.35em] text-white/50 uppercase mb-3">&gt; STATUS</p>
            <p className={`font-mono text-[19px] tracking-wide uppercase leading-tight ${
                shuffleState.isFailed ? 'text-[#8B0000]' :
                shuffleState.hasRevealed ? 'text-[#916A47]' :
                'text-white/85'
            }`}>
                {shuffleState.isFailed
                    ? '!! CONNECTION_LOST'
                    : shuffleState.hasRevealed
                        ? 'STANDBY // AWAITING_OPERATIVES'
                        : shuffleState.isMyTurn
                            ? (shuffleState.hasCommitted ? 'STEP_2 // SEALING_DOSSIER...' : 'STEP_1 // SCRAMBLING_DATA...')
                            : `STANDBY // ${currentShufflerName?.toUpperCase() || 'PLAYER'}`
                }
                {!shuffleState.hasRevealed && !shuffleState.isFailed && (
                    <span className="animate-pulse ml-1 text-[#916A47]">▌</span>
                )}
            </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-[320px]">
            <div className="flex justify-between font-mono text-[11px] tracking-wide mb-2.5">
                <span className="text-white/50 uppercase">PROGRESS</span>
                <span className="text-[#916A47]">{Math.floor(progress)}%</span>
            </div>
            <div className="h-[2px] bg-black/70 rounded-full overflow-hidden relative">
                <motion.div
                    className={`h-full rounded-full ${shuffleState.isFailed ? 'bg-[#8B0000]' : 'bg-[#916A47]'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                />
                {!shuffleState.isFailed && !shuffleState.hasRevealed && progress > 0 && (
                    <motion.div
                        className="absolute top-0 h-full w-6 bg-white/20 blur-[2px] rounded-full"
                        animate={{ left: `${Math.max(progress - 2, 0)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                )}
            </div>
            <div className="font-mono text-[11px] tracking-wide mt-2.5 text-white/45 uppercase">
                PLAYER {shuffleState.currentShufflerIndex + 1} / {Math.ceil(100 / Math.max(progress / shuffleState.currentShufflerIndex || 1, 1))} &bull; {shuffleState.deck.length} CARDS
            </div>
        </div>

        {shuffleState.isFailed && shuffleState.isMyTurn && (
            <Button
                variant="ghost"
                className="text-[11px] font-mono tracking-widest py-1 h-8 border-[#8B0000]/40 text-[#8B0000]/70 hover:bg-[#8B0000]/10 uppercase"
                onClick={onRetry}
            >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                RETRY
            </Button>
        )}
    </div>
);

// ─── RevealPanel (right content during REVEAL) ────────────────────────────────

interface RevealPanelProps {
    revealState: {
        myRole: Role | null;
        isRevealed: boolean;
        hasConfirmed: boolean;
        eciesRegistered: boolean;
        hasSharedKeys: boolean;
    };
    isProcessing: boolean;
    isTxPending: boolean;
    onConfirm: () => void;
}

const RevealPanel: React.FC<RevealPanelProps> = ({
    revealState, isProcessing, isTxPending, onConfirm
}) => {
    const roleConfig = revealState.myRole ? RoleConfig[revealState.myRole] : RoleConfig[Role.UNKNOWN];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <AnimatePresence mode="wait">
                {!revealState.isRevealed ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-6 text-center"
                    >
                        <div className="h-14 flex items-center justify-center opacity-85">
                            <AsciiSpinner className="text-[#916A47] text-4xl" />
                        </div>
                        <div>
                            <p className="font-mono text-[11px] tracking-[0.35em] text-white/50 uppercase mb-3">&gt; STATUS</p>
                            <p className="font-mono text-[19px] tracking-wide text-white/85 uppercase">
                                {!revealState.eciesRegistered ? 'SECURING_CHANNEL' :
                                    !revealState.hasSharedKeys ? 'DECRYPTING_DOSSIER' :
                                        'VERIFYING_IDENTITY'}
                                <span className="animate-pulse ml-1 text-[#916A47]">▌</span>
                            </p>
                        </div>
                        <div className="w-full max-w-[260px]">
                            <div className="h-[2px] bg-black/70 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-[#916A47] rounded-full"
                                    animate={{ width: revealState.hasSharedKeys ? '100%' : '50%' }}
                                    transition={{ duration: 0.6 }}
                                />
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="revealed"
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        transition={{ type: 'spring', duration: 0.8 }}
                        className={`bg-gradient-to-br ${roleConfig.bgColor} w-[270px] aspect-[3/4] rounded-sm border ${roleConfig.borderColor} ring-1 ${roleConfig.ringColor} p-7 shadow-[0_30px_60px_rgba(0,0,0,0.98)] relative overflow-hidden flex flex-col justify-between`}
                    >
                        {/* SVG noise */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
                            <filter id="noise-sar">
                                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
                                <feColorMatrix type="saturate" values="0" />
                            </filter>
                            <rect width="100%" height="100%" filter="url(#noise-sar)" />
                        </svg>

                        {/* Watermark */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 0.08, scale: 1 }}
                            transition={{ delay: 0.2, duration: 1 }}
                            className={`absolute top-4 right-4 ${roleConfig.color}`}
                        >
                            {roleConfig.icon}
                        </motion.div>

                        {/* CLASSIFIED stamp */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className={`absolute bottom-16 left-3 font-mono text-[8px] tracking-[0.3em] uppercase px-1.5 py-[2px] border ${roleConfig.borderColor} ${roleConfig.color} opacity-20 rotate-[-7deg] select-none pointer-events-none`}
                        >
                            CLASSIFIED
                        </motion.div>

                        {/* Pulsing border */}
                        <motion.div
                            className={`absolute inset-0 border ${roleConfig.borderColor}`}
                            animate={{ opacity: [0.2, 0.5, 0.2] }}
                            transition={{ duration: 4, repeat: Infinity }}
                        />

                        {/* Content */}
                        <div className="text-center flex-1 flex flex-col justify-center relative z-10">
                            <motion.p
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                                className="font-mono text-[8px] tracking-[0.3em] text-white/35 uppercase mb-4"
                            >
                                CASE FILE // ROLE
                            </motion.p>
                            <motion.h2
                                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                                className={`text-3xl font-['Cinzel'] mb-4 ${roleConfig.color}`}
                            >
                                {revealState.myRole}
                            </motion.h2>
                            <motion.div
                                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.45, duration: 0.5 }}
                                className="h-px w-12 mx-auto mb-4 opacity-30"
                                style={{ background: 'currentColor' }}
                            />
                            <motion.p
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                                className="text-white/45 text-[12px] font-mono leading-relaxed tracking-wide max-w-[195px] mx-auto"
                            >
                                {roleConfig.description}
                            </motion.p>
                        </div>

                        {/* Confirm button */}
                        <div className="relative z-10">
                            {!revealState.hasConfirmed ? (
                                <motion.button
                                    onClick={onConfirm}
                                    disabled={isProcessing || isTxPending}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`w-full py-3 px-4 rounded-sm border font-['Cinzel'] text-[10px] tracking-[0.25em] uppercase transition-all duration-300
                                        border-[#8B0000]/30 text-white/55
                                        bg-transparent hover:bg-[#8B0000]/12 hover:border-[#8B0000]/55 hover:text-white/85
                                        disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                                >
                                    {(isProcessing || isTxPending)
                                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming...</>
                                        : 'I Understand My Role'}
                                </motion.button>
                            ) : (
                                <div className={`flex items-center justify-center gap-2 ${roleConfig.color} py-3.5`}>
                                    <Check className="w-5 h-5" />
                                    <span className="font-['Cinzel'] text-[10px] tracking-[0.2em] uppercase">Confirmed</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const ShuffleAndReveal: React.FC = React.memo(() => {
    const {
        gameState, currentRoomId, myPlayer,
        commitAndConfirmRoleOnChain, addLog,
        isTxPending, setGameState,
        commitDeckOnChain, revealDeckOnChain,
        refreshPlayersList, runtimeContractAddress, isTestMode
    } = useGameContext();

    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    const isReveal = gameState.phase === GamePhase.REVEAL;

    // ── Shuffle state ──────────────────────────────────────────────────────────
    const SHUFFLE_COMMIT_KEY = `mafia_shuffle_commit_${currentRoomId}_${myPlayer?.address?.toLowerCase() || ''}`;

    const [shuffleState, setShuffleState] = useState({
        currentShufflerIndex: 0,
        deck: [] as string[],
        isMyTurn: false,
        hasCommitted: false,
        hasRevealed: false,
        pendingDeck: null as string[] | null,
        pendingSalt: null as string | null,
        phaseDeadline: 0,
        retryCount: 0,
        lastErrorTime: 0,
        isFailed: false
    });
    const [isShuffleProcessing, setIsShuffleProcessing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const [pendingDeck, setPendingDeck] = useState<string[] | null>(null);
    const [pendingSalt, setPendingSalt] = useState<string | null>(null);

    const processRef = useRef(false);
    const autoKickMarkerRef = useRef<string>('');

    // ── Reveal state ───────────────────────────────────────────────────────────
    const [revealState, setRevealState] = useState({
        myRole: null as Role | null,
        isRevealed: false,
        hasConfirmed: false,
        hasSharedKeys: false,
        eciesRegistered: false
    });
    const [isRevealProcessing, setIsRevealProcessing] = useState(false);

    const registerInFlightRef = useRef(false);
    const submitInFlightRef = useRef(false);
    const fetchInFlightRef = useRef(false);

    // ── Restore shuffle state ──────────────────────────────────────────────────
    useEffect(() => {
        const saved = localStorage.getItem(SHUFFLE_COMMIT_KEY);
        if (saved) {
            try {
                const { deck, salt, hasCommitted } = JSON.parse(saved);
                if (deck && salt) {
                    setPendingDeck(deck);
                    setPendingSalt(salt);
                    if (hasCommitted) {
                        setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                    } else {
                        if (publicClient && currentRoomId && myPlayer?.address) {
                            publicClient.readContract({
                                address: runtimeContractAddress,
                                abi: MAFIA_ABI,
                                functionName: 'getPlayerFlags',
                                args: [currentRoomId, myPlayer.address as `0x${string}`],
                            }).then((flags: any) => {
                                if (flags?.[3]) {
                                    localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({ deck, salt, hasCommitted: true }));
                                    setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                                } else {
                                    setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                                }
                            }).catch(() => setShuffleState(prev => ({ ...prev, isMyTurn: true })));
                        } else {
                            setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                        }
                    }
                }
            } catch (e) { console.error('Failed to recover pending deck', e); }
        }
        if (currentRoomId && myPlayer) {
            const svc = getShuffleService();
            if (!svc.hasKeys()) svc.loadKeys(currentRoomId.toString(), myPlayer.address);
        }
    }, [SHUFFLE_COMMIT_KEY]);

    // ── Sync reveal hasConfirmed from chain ────────────────────────────────────
    useEffect(() => {
        if (myPlayer?.hasConfirmedRole && !revealState.hasConfirmed)
            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
    }, [myPlayer?.hasConfirmedRole, revealState.hasConfirmed]);

    // ── Test mode simulation ───────────────────────────────────────────────────
    useEffect(() => {
        if (!isTestMode || !myPlayer) return;
        const hasStarted = gameState.revealedCount >= gameState.players.length;
        if (myPlayer.hasConfirmedRole) {
            setRevealState({ myRole: myPlayer.role, isRevealed: true, hasSharedKeys: true, eciesRegistered: true, hasConfirmed: true });
        } else if (hasStarted) {
            setRevealState({ myRole: myPlayer.role, isRevealed: true, hasSharedKeys: true, eciesRegistered: true, hasConfirmed: false });
        } else {
            setRevealState({ myRole: null, isRevealed: false, hasSharedKeys: true, eciesRegistered: true, hasConfirmed: false });
        }
    }, [isTestMode, myPlayer, gameState.revealedCount, gameState.players.length]);

    // ── Shuffle: fetch from contract ───────────────────────────────────────────
    const fetchShuffleData = useCallback(async () => {
        if (isTestMode) {
            const idx = gameState.players.findIndex(p => !p.hasDeckCommitted);
            const safeIdx = idx === -1 ? gameState.players.length : idx;
            if (shuffleState.currentShufflerIndex !== safeIdx)
                setShuffleState(prev => ({ ...prev, currentShufflerIndex: safeIdx, isMyTurn: false, hasCommitted: false }));
            return;
        }
        if (!publicClient || !currentRoomId || processRef.current) return;
        try {
            const results = await publicClient.multicall({
                contracts: [
                    { address: runtimeContractAddress, abi: MAFIA_ABI as any, functionName: 'getRoom', args: [currentRoomId] },
                    { address: runtimeContractAddress, abi: MAFIA_ABI as any, functionName: 'getDeck', args: [currentRoomId] }
                ],
                allowFailure: true
            });
            const roomData = results[0].status === 'success' ? (results[0].result as any) : null;
            let deck = results[1].status === 'success' ? (results[1].result as string[]) : [];

            let currentIndex = 0, deadline = 0, revealedCount = 0;
            if (Array.isArray(roomData)) {
                currentIndex = Number(roomData[8]);
                deadline = Number(roomData[10]);
                revealedCount = Number(roomData[14]);
            } else if (roomData) {
                currentIndex = Number(roomData.currentShufflerIndex);
                deadline = Number(roomData.phaseDeadline);
                revealedCount = Number(roomData.revealedCount);
            }
            if (isNaN(currentIndex)) currentIndex = 0;

            if ((currentIndex > 0 || revealedCount > 0) && deck.length === 0) {
                try {
                    const curBlock = await publicClient.getBlockNumber();
                    const fromBlock = curBlock > 10000n ? curBlock - 10000n : 0n;
                    const logs = await publicClient.getContractEvents({
                        address: runtimeContractAddress, abi: MAFIA_ABI,
                        eventName: 'DeckRevealed', args: { roomId: currentRoomId } as any, fromBlock
                    });
                    if (logs?.length > 0) deck = ((logs[logs.length - 1] as any).args as any).deck as string[];
                } catch { /* ignore */ }
            }

            const cur = gameState.players[currentIndex];
            let isMyTurnFromContract = cur && myPlayer
                ? cur.address.toLowerCase() === myPlayer.address.toLowerCase()
                : false;
            if (isMyTurnFromContract && currentIndex > 0 && deck.length === 0) isMyTurnFromContract = false;

            setShuffleState(prev => {
                const safeIdx = Math.max(prev.currentShufflerIndex, currentIndex);
                if (prev.hasRevealed || prev.hasCommitted)
                    return { ...prev, currentShufflerIndex: safeIdx, deck: deck.length > 0 ? deck : prev.deck };
                return { ...prev, currentShufflerIndex: safeIdx, deck, isMyTurn: isMyTurnFromContract, phaseDeadline: deadline };
            });
        } catch (e) { console.error('Shuffle sync error:', e); }
    }, [publicClient, currentRoomId, gameState.players, myPlayer, isTestMode]);

    const forceSync = useCallback(async () => {
        if (!currentRoomId) return;
        setIsSyncing(true);
        try { await fetchShuffleData(); await refreshPlayersList(currentRoomId); }
        finally { setIsSyncing(false); }
    }, [currentRoomId, fetchShuffleData, refreshPlayersList]);

    // Poll
    useEffect(() => {
        if (isReveal) return; // don't poll shuffle during reveal
        fetchShuffleData();
        if (isTestMode) return;
        const iv = setInterval(fetchShuffleData, 1500);
        return () => clearInterval(iv);
    }, [fetchShuffleData, isTestMode, isReveal]);

    // Visibility / online
    useEffect(() => {
        const onVis = () => { if (!document.hidden) { fetchShuffleData(); if (currentRoomId) refreshPlayersList(currentRoomId); } };
        const onOnline = () => { fetchShuffleData(); if (currentRoomId) refreshPlayersList(currentRoomId); };
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('online', onOnline);
        return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onOnline); };
    }, [fetchShuffleData, refreshPlayersList, currentRoomId]);

    // Beforeunload warning
    useEffect(() => {
        const shouldWarn = shuffleState.isMyTurn && !shuffleState.hasRevealed &&
            !gameState.players.some(p => p.address.toLowerCase() === myPlayer?.address?.toLowerCase() && !p.isAlive);
        if (!shouldWarn) return;
        const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = 'Shuffle in progress'; return e.returnValue; };
        window.addEventListener('beforeunload', fn);
        return () => window.removeEventListener('beforeunload', fn);
    }, [shuffleState.isMyTurn, shuffleState.hasRevealed, gameState.players, myPlayer?.address]);

    // Timeout kick
    const handleTimeoutKick = useCallback(async () => {
        if (!currentRoomId) return;
        setIsShuffleProcessing(true);
        try {
            const hash = await writeContractAsync({
                address: runtimeContractAddress, abi: MAFIA_ABI,
                functionName: 'forcePhaseTimeout', args: [currentRoomId]
            });
            addLog(`Timeout kick tx: ${hash.substring(0, 10)}...`, 'info');
        } catch (e) { addLog('Failed to kick player', 'danger'); }
        finally { setIsShuffleProcessing(false); }
    }, [currentRoomId, writeContractAsync, addLog]);

    // Auto-unstick
    useEffect(() => {
        if (!currentRoomId || !myPlayer || !shuffleState.phaseDeadline) return;
        const check = () => {
            if (processRef.current || isShuffleProcessing || isTxPending) return;
            const nowSec = Math.floor(Date.now() / 1000);
            if (nowSec <= shuffleState.phaseDeadline + 5) return;
            const sorted = [...gameState.players].filter(p => p.isAlive).sort((a, b) => a.address.localeCompare(b.address));
            if (!sorted.length || sorted[0].address.toLowerCase() !== myPlayer.address.toLowerCase()) return;
            const marker = `${currentRoomId}:${shuffleState.phaseDeadline}`;
            if (autoKickMarkerRef.current === marker) return;
            autoKickMarkerRef.current = marker;
            addLog('Shuffle timeout. Auto-kicking...', 'warning');
            handleTimeoutKick().catch(() => { autoKickMarkerRef.current = ''; });
        };
        check();
        const iv = setInterval(check, 2000);
        return () => clearInterval(iv);
    }, [currentRoomId, myPlayer, shuffleState.phaseDeadline, gameState.players, isShuffleProcessing, isTxPending, handleTimeoutKick, addLog]);

    // Handle my shuffle turn
    const handleMyTurn = useCallback(async () => {
        if (!currentRoomId || !myPlayer || isShuffleProcessing || processRef.current) return;
        processRef.current = true;
        setIsShuffleProcessing(true);
        try {
            const svc = getShuffleService();
            const activeIndices = gameState.players.map((p, i) => p.isAlive ? i : -1).filter(i => i !== -1);
            const roomIdStr = currentRoomId?.toString() || '0';
            const verifyDeck = ShuffleService.generateInitialDeck(gameState.players.length, roomIdStr, activeIndices.length);
            const uniqueVals = [...new Set(verifyDeck)];
            if (!svc.hasKeys()) svc.generateVerifiedKeys(uniqueVals);

            let newDeck: string[];
            if (shuffleState.currentShufflerIndex === 0) {
                const initial = ShuffleService.generateDistributedDeck(gameState.players.map(p => ({ isAlive: p.isAlive })), roomIdStr);
                newDeck = svc.encryptDeck(initial);
            } else {
                if (shuffleState.deck.length === 0) throw new Error('Deck is empty! Sync error.');
                newDeck = svc.encryptDeck(shuffleState.deck);
            }

            const salt = ShuffleService.generateSalt();
            const deckHash = ShuffleService.createDeckCommitHash(newDeck, salt);
            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({ deck: newDeck, salt, hasCommitted: false }));
            svc.saveKeys(currentRoomId.toString(), myPlayer.address);

            await commitDeckOnChain(deckHash);
            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({ deck: newDeck, salt, hasCommitted: true }));
            setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
            await new Promise(r => setTimeout(r, 500));
            await revealDeckOnChain(newDeck, salt);

            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setPendingDeck(null); setPendingSalt(null);
            setShuffleState(prev => ({ ...prev, hasRevealed: true, currentShufflerIndex: prev.currentShufflerIndex + 1 }));
            setTimeout(fetchShuffleData, 200);
        } catch (e: any) {
            addLog((e?.message || 'Shuffle failed').substring(0, 120), 'danger');
            const isRevert = (e?.message || '').match(/reverted|InvalidReveal|PhaseDeadlinePassed|revert|Out Of Gas/i);
            setShuffleState(prev => ({
                ...prev, retryCount: prev.retryCount + 1, lastErrorTime: Date.now(),
                isFailed: !!isRevert && prev.retryCount >= 2
            }));
        } finally {
            processRef.current = false;
            setIsShuffleProcessing(false);
        }
    }, [currentRoomId, myPlayer, isShuffleProcessing, shuffleState, gameState.players, SHUFFLE_COMMIT_KEY, commitDeckOnChain, revealDeckOnChain, addLog, fetchShuffleData]);

    // Recovery reveal
    const handleReveal = useCallback(async () => {
        if (!currentRoomId || !pendingDeck || !pendingSalt || isShuffleProcessing) return;
        setIsShuffleProcessing(true);
        try {
            await revealDeckOnChain(pendingDeck, pendingSalt);
            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setPendingDeck(null); setPendingSalt(null);
            setShuffleState(prev => ({ ...prev, hasRevealed: true, currentShufflerIndex: prev.currentShufflerIndex + 1 }));
            setTimeout(fetchShuffleData, 200);
        } catch (e: any) { addLog(e.message || 'Reveal failed', 'danger'); }
        finally { setIsShuffleProcessing(false); }
    }, [currentRoomId, pendingDeck, pendingSalt, isShuffleProcessing, revealDeckOnChain, SHUFFLE_COMMIT_KEY, fetchShuffleData, addLog]);

    // Auto-trigger shuffle
    useEffect(() => {
        if (processRef.current || isReveal) return;
        const canAuto = shuffleState.isMyTurn && !shuffleState.hasCommitted && !isShuffleProcessing &&
            !isTxPending && !shuffleState.hasRevealed && !shuffleState.isFailed && gameState.players.length > 0;
        if (!canAuto) return;
        if (shuffleState.retryCount > 0 && Date.now() - shuffleState.lastErrorTime < 10000) return;
        handleMyTurn();
    }, [shuffleState.isMyTurn, shuffleState.hasCommitted, shuffleState.hasRevealed,
        isShuffleProcessing, isTxPending, gameState.players.length, handleMyTurn, isReveal]);

    // Auto recovery reveal
    useEffect(() => {
        if (isReveal) return;
        const needs = shuffleState.isMyTurn && shuffleState.hasCommitted && !shuffleState.hasRevealed &&
            !isShuffleProcessing && !isTxPending && pendingDeck && pendingSalt;
        if (!needs) return;
        const t = setTimeout(handleReveal, 1000);
        return () => clearTimeout(t);
    }, [shuffleState.isMyTurn, shuffleState.hasCommitted, shuffleState.hasRevealed,
        isShuffleProcessing, isTxPending, pendingDeck, pendingSalt, handleReveal, isReveal]);

    // ── Reveal: ECIES registration ─────────────────────────────────────────────
    const handleRegisterEcies = useCallback(async (retryWithWallet = false) => {
        if (!currentRoomId || !address || !walletClient || registerInFlightRef.current) return;
        const { isNew } = await loadOrCreateKeypair(currentRoomId.toString(), address);
        if (revealState.eciesRegistered && !isNew && !retryWithWallet) return;
        registerInFlightRef.current = true;
        try {
            let registered = false, lastErr: any;
            for (let i = 0; i < 6; i++) {
                try {
                    await registerEciesPubkey(currentRoomId.toString(), address, walletClient, chainId, retryWithWallet || i >= 3);
                    registered = true; break;
                } catch (e) { lastErr = e; if (i < 5) await new Promise(r => setTimeout(r, 2000)); }
            }
            if (!registered) throw lastErr;
            setRevealState(prev => ({ ...prev, eciesRegistered: true, ...(isNew && { hasSharedKeys: false, isRevealed: false, myRole: null }) }));
        } catch (e: any) { addLog(e.message || 'ECIES registration failed', 'danger'); }
        finally { registerInFlightRef.current = false; }
    }, [currentRoomId, address, walletClient, chainId, revealState.eciesRegistered]);

    const handleShareKey = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || revealState.hasSharedKeys || submitInFlightRef.current) return;
        submitInFlightRef.current = true;
        setIsRevealProcessing(true);
        try {
            const svc = getShuffleService();
            if (!svc.hasKeys()) {
                const loaded = svc.loadKeys(currentRoomId.toString(), address);
                if (!loaded) { addLog('Session keys lost — rejoin room', 'danger'); return; }
            }
            await submitSraKeyToGm({ roomId: currentRoomId.toString(), address, sraKey: svc.getDecryptionKey(), walletClient, chainId });
            setRevealState(prev => ({ ...prev, hasSharedKeys: true }));
        } catch (e: any) {
            addLog(e.message || 'Failed to submit SRA key', 'danger');
            setTimeout(() => { submitInFlightRef.current = false; }, 3000);
            return;
        } finally {
            setIsRevealProcessing(false);
            if (revealState.hasSharedKeys) submitInFlightRef.current = false;
        }
    }, [currentRoomId, address, walletClient, chainId, revealState.hasSharedKeys, addLog]);

    const handleFetchRole = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || revealState.isRevealed || revealState.hasConfirmed || !revealState.hasSharedKeys || fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        try {
            const role = await fetchMyRoleFromGm({ roomId: currentRoomId.toString(), address, walletClient, chainId });
            if (role) {
                localStorage.setItem(`my_role_${currentRoomId}_${address.toLowerCase()}`, role);
                setRevealState(prev => ({ ...prev, myRole: role, isRevealed: true }));
                setGameState(prev => ({ ...prev, players: prev.players.map(p => p.address.toLowerCase() === address.toLowerCase() ? { ...p, role } : p) }));
                addLog(`Your role: ${role}`, 'success');
            }
        } catch { /* silent */ }
        finally { fetchInFlightRef.current = false; }
    }, [currentRoomId, address, walletClient, chainId, revealState.isRevealed, revealState.hasConfirmed, revealState.hasSharedKeys, addLog, setGameState]);

    const handleConfirmRole = useCallback(async () => {
        if (revealState.myRole === null || revealState.hasConfirmed || isRevealProcessing || isTxPending) return;
        setIsRevealProcessing(true);
        const roleMap: Record<Role, number> = {
            [Role.MAFIA]: 1, [Role.DOCTOR]: 2, [Role.DETECTIVE]: 3, [Role.CIVILIAN]: 4, [Role.UNKNOWN]: 0
        };
        const roleNum = roleMap[revealState.myRole] || 4;
        try {
            const existingSalt = (currentRoomId && address)
                ? localStorage.getItem(`role_salt_${currentRoomId}_${address.toLowerCase()}`) : null;
            const salt = existingSalt || ShuffleService.generateSalt();
            await commitAndConfirmRoleOnChain(roleNum, salt);
            if (currentRoomId && address) localStorage.setItem(`role_salt_${currentRoomId}_${address.toLowerCase()}`, salt);
            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
        } catch (e: any) {
            const msg = (e.message || '').toLowerCase();
            if (msg.includes('alreadyconfirmed') || msg.includes('alreadyrevealed')) {
                setRevealState(prev => ({ ...prev, hasConfirmed: true }));
            } else { addLog(e.message || 'Failed to confirm role', 'danger'); }
        } finally { setIsRevealProcessing(false); }
    }, [revealState.myRole, revealState.hasConfirmed, isRevealProcessing, isTxPending, commitAndConfirmRoleOnChain, currentRoomId, address, addLog]);

    // Auto-flow for reveal
    useEffect(() => {
        if (!isReveal) return;
        if (!revealState.eciesRegistered) { handleRegisterEcies(); return; }
        if (!revealState.hasSharedKeys) { handleShareKey(); return; }
        if (!revealState.isRevealed && !revealState.hasConfirmed) {
            const iv = setInterval(handleFetchRole, 2000);
            return () => clearInterval(iv);
        }
        if (!revealState.hasConfirmed && !isRevealProcessing && !isTxPending) {
            const t = setTimeout(handleConfirmRole, 4000);
            return () => clearTimeout(t);
        }
    }, [isReveal, revealState.eciesRegistered, revealState.hasSharedKeys, revealState.isRevealed,
        revealState.hasConfirmed, isRevealProcessing, isTxPending,
        handleRegisterEcies, handleShareKey, handleFetchRole, handleConfirmRole, walletClient]);

    // ── Derived for UI ─────────────────────────────────────────────────────────
    const currentShuffler = gameState.players[shuffleState.currentShufflerIndex];
    const totalPlayers = gameState.players.length;
    const progress = Math.min((shuffleState.currentShufflerIndex / Math.max(totalPlayers, 1)) * 100, 100);
    const keysCollected = gameState.players.filter(p => p.hasConfirmedRole).length;

    // ── Sidebar: players list (adapts to phase) ────────────────────────────────
    const SuspectRow = ({ player, index }: { player: typeof gameState.players[0]; index: number }) => {
        const isMe = player.address.toLowerCase() === address?.toLowerCase();

        if (isReveal) {
            // Reveal sidebar: highlight who has confirmed role
            const hasConfirmed = player.hasConfirmedRole;
            return (
                <div
                    className={`flex items-center justify-between px-5 py-3 border-b border-white/[0.03] transition-all ${
                        hasConfirmed ? 'bg-[#916A47]/[0.06]' : isMe ? 'bg-[#916A47]/5' : ''
                    }`}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`text-[13px] shrink-0 transition-colors ${
                            hasConfirmed ? 'text-[#916A47]' :
                            isMe ? 'text-[#916A47]/60 animate-pulse' :
                            'text-white/30'
                        }`}>●</span>
                        <span className={`font-mono text-[14px] truncate ${isMe ? 'text-[#916A47]' : hasConfirmed ? 'text-white/80' : 'text-white/55'}`}>
                            {player.name}{isMe ? '_YOU' : ''}
                        </span>
                    </div>
                    <span className={`font-mono text-[11px] tracking-wider shrink-0 ml-1 ${hasConfirmed ? 'text-[#916A47]' : 'text-white/30'}`}>
                        {hasConfirmed ? 'CONF' : 'WAIT_'}
                    </span>
                </div>
            );
        }

        // Shuffle sidebar
        const isDone = index < shuffleState.currentShufflerIndex || (isMe && shuffleState.hasRevealed);
        const isActive = index === shuffleState.currentShufflerIndex && !isDone;
        return (
            <motion.div
                layout
                className={`flex items-center justify-between px-5 py-3 border-b border-white/[0.03] transition-all ${
                    isActive ? 'bg-[#916A47]/[0.15]' : isDone ? 'bg-[#916A47]/[0.08]' : ''
                }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-[13px] shrink-0 transition-colors ${
                        isDone ? 'text-[#916A47]' :
                        isActive ? 'text-[#916A47] animate-pulse' :
                        'text-white/30'
                    }`}>●</span>
                    <span className={`font-mono text-[14px] truncate ${
                        isMe ? 'text-[#916A47]' :
                        isDone ? 'text-white/80' :
                        isActive ? 'text-white/90' :
                        'text-white/55'
                    }`}>
                        {player.name}{isMe ? '_YOU' : ''}
                    </span>
                </div>
                <span className={`font-mono text-[11px] tracking-wider shrink-0 ml-1 ${
                    isDone ? 'text-[#916A47]' :
                    isActive ? 'text-[#916A47]' :
                    'text-white/25'
                }`}>
                    {isDone ? 'DONE' : isActive ? (isShuffleProcessing ? '●●●' : 'ACTIVE') : 'WAIT_'}
                </span>
            </motion.div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="w-full h-[100dvh] flex flex-col items-center justify-center overflow-hidden p-4 pointer-events-auto">
            <div className="w-full max-w-[820px] bg-[#060403] rounded-sm border border-[#916A47]/20 shadow-[0_40px_80px_rgba(0,0,0,0.97)] flex flex-col overflow-hidden">

                {/* ── HEADER ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-[#916A47]/15 bg-black/50">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-[13px] tracking-[0.3em] text-[#916A47] uppercase">CASE FILE</span>
                        <span className="text-[#916A47]/50">//</span>
                        <span className="font-mono text-[13px] tracking-[0.2em] text-white/55 uppercase">
                            ROOM_{currentRoomId?.toString() || '???'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Phase label — smooth cross-fade */}
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                                key={isReveal ? 'reveal' : 'shuffle'}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.25 }}
                                className="font-mono text-[12px] tracking-[0.25em] text-white/45 uppercase"
                            >
                                {isReveal ? 'ROLE REVEAL' : 'SHUFFLE PHASE'}
                            </motion.span>
                        </AnimatePresence>

                        {/* Shuffle-only controls */}
                        {!isReveal && (
                            <>
                                {Date.now() / 1000 > shuffleState.phaseDeadline && shuffleState.phaseDeadline > 0 && (
                                    <button
                                        onClick={handleTimeoutKick}
                                        disabled={isShuffleProcessing}
                                        className="font-mono text-[9px] tracking-widest text-[#8B0000]/60 hover:text-[#8B0000] uppercase animate-pulse transition-colors"
                                    >
                                        KICK
                                    </button>
                                )}
                                <button
                                    onClick={forceSync}
                                    disabled={isSyncing}
                                    className="text-white/15 hover:text-[#916A47]/50 transition-colors"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                </button>
                            </>
                        )}

                        {/* Reveal-only counter */}
                        {isReveal && (
                            <span className="font-mono text-[12px] text-[#916A47]/70">
                                {keysCollected}/{totalPlayers}
                            </span>
                        )}
                    </div>
                </div>

                {/* ── BODY ───────────────────────────────────────────── */}
                <div className="flex min-h-[440px]">

                    {/* LEFT — Suspects */}
                    <div className="w-[230px] shrink-0 border-r border-[#916A47]/10 flex flex-col">
                        <div className="px-5 py-3.5 border-b border-[#916A47]/8 flex items-center justify-between">
                            <span className="font-mono text-[12px] tracking-[0.3em] text-white/55 uppercase">SUSPECTS</span>
                            {!isReveal && (
                                <span className="font-mono text-[11px] text-[#916A47]/60">
                                    {shuffleState.currentShufflerIndex}/{totalPlayers}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                            {gameState.players.map((player, index) => (
                                <SuspectRow key={player.address} player={player} index={index} />
                            ))}
                        </div>
                    </div>

                    {/* RIGHT — phase content (AnimatePresence prevents flash) */}
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={isReveal ? 'reveal-panel' : 'shuffle-panel'}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="flex-1 flex"
                        >
                            {isReveal ? (
                                <RevealPanel
                                    revealState={revealState}
                                    isProcessing={isRevealProcessing}
                                    isTxPending={isTxPending}
                                    onConfirm={handleConfirmRole}
                                />
                            ) : (
                                <ShufflePanel
                                    shuffleState={shuffleState}
                                    progress={progress}
                                    isProcessing={isShuffleProcessing}
                                    isTxPending={isTxPending}
                                    currentShufflerName={currentShuffler?.name}
                                    onRetry={() => {
                                        setShuffleState(prev => ({ ...prev, isFailed: false, retryCount: 0 }));
                                        handleMyTurn();
                                    }}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ── FOOTER ─────────────────────────────────────────── */}
                <div className="px-6 py-2.5 border-t border-[#916A47]/8 bg-black/30">
                    <span className="font-mono text-[8px] tracking-[0.3em] text-white/30 uppercase flex justify-center">
                        // SOMNIA NETWORK //
                    </span>
                </div>
            </div>
        </div>
    );
});

ShuffleAndReveal.displayName = 'ShuffleAndReveal';
