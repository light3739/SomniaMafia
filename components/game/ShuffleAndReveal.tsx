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
    registerEciesPubkey, submitSraKeyToGm, fetchMyRoleFromGm, registerSessionOnGm
} from '../../services/gmService';
import { loadOrCreateKeypair } from '../../services/eciesService';
import { loadSession } from '../../services/sessionKeyService'; // Add this too

// ─── TypewriterText (ERASE & TYPE EFFECT) ────────────────────────────────────

const TypewriterText: React.FC<{ text: string; delay?: number; speed?: number }> = ({ text, delay = 0, speed = 45 }) => {
    const [displayText, setDisplayText] = useState(text);
    const [isAnimating, setIsAnimating] = useState(false);
    const targetTextRef = useRef(text);

    useEffect(() => {
        if (text === targetTextRef.current) return;
        
        setIsAnimating(true);
        targetTextRef.current = text;
        
        // Phase 1: Erase
        let currentText = displayText;
        const eraseInterval = setInterval(() => {
            if (currentText.length > 0) {
                currentText = currentText.slice(0, -1);
                setDisplayText(currentText);
            } else {
                clearInterval(eraseInterval);
                // Phase 2: Type new text
                let i = 0;
                const typeInterval = setInterval(() => {
                    if (i < text.length) {
                        setDisplayText(text.slice(0, i + 1));
                        i++;
                    } else {
                        clearInterval(typeInterval);
                        setIsAnimating(false);
                    }
                }, speed);
            }
        }, speed / 1.5);

        return () => {
            clearInterval(eraseInterval);
        };
    }, [text, speed]);

    return <span>{displayText}</span>;
};

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

const RoleConfig: Record<Role, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string; ringColor: string; description: string; label: string }> = {
    [Role.MAFIA]: {
        icon: <Skull className="w-16 h-16" />,
        color: 'text-[#8B0000]',
        bgColor: 'from-[#8B0000]/25 to-[#0A0705]/80',
        borderColor: 'border-[#8B0000]/30',
        ringColor: 'ring-[#8B0000]/10',
        label: 'MAFIA',
        description: 'Eliminate all civilians to win. Vote by day, kill by night.'
    },
    [Role.DOCTOR]: {
        icon: <Shield className="w-16 h-16" />,
        color: 'text-[#0D9488]',
        bgColor: 'from-[#0D9488]/25 to-[#0A0705]/80',
        borderColor: 'border-[#0D9488]/30',
        ringColor: 'ring-[#0D9488]/10',
        label: 'DOCTOR',
        description: 'Save one player each night from the mafia attack.'
    },
    [Role.DETECTIVE]: {
        icon: <Search className="w-16 h-16" />,
        color: 'text-[#A85832]',
        bgColor: 'from-[#A85832]/25 to-[#0A0705]/80',
        borderColor: 'border-[#A85832]/30',
        ringColor: 'ring-[#A85832]/10',
        label: 'DETECTIVE',
        description: 'Investigate one player each night to reveal their alignment.'
    },
    [Role.CIVILIAN]: {
        icon: <Users className="w-16 h-16" />,
        color: 'text-[#6B5A4A]',
        bgColor: 'from-[#6B5A4A]/25 to-[#0A0705]/80',
        borderColor: 'border-[#6B5A4A]/20',
        ringColor: 'ring-[#6B5A4A]/8',
        label: 'CIVILIAN',
        description: 'Find and vote out the mafia during the day to survive.'
    },
    [Role.UNKNOWN]: {
        icon: <EyeOff className="w-16 h-16" />,
        color: 'text-stone-600',
        bgColor: 'from-stone-950/50 to-[#0A0705]/80',
        borderColor: 'border-stone-700/20',
        ringColor: 'ring-stone-700/8',
        label: 'UNKNOWN',
        description: 'Role unknown'
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
    totalPlayers: number;
    onRetry: () => void;
}

const ShufflePanel: React.FC<ShufflePanelProps> = ({
    shuffleState, progress, isProcessing, isTxPending, currentShufflerName, totalPlayers, onRetry
}) => {
    const dealtCardsCount = Math.floor(progress / 100 * totalPlayers); 

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-12">
            {/* Status Section */}

            {/* Status */}
            <div className="text-center">
                <p className="font-mono text-[10px] tracking-[0.35em] text-white/35 uppercase mb-3.5">&gt; STATUS</p>
                <div className="flex items-center justify-center gap-1.5">
                    <p className={`font-mono text-[16px] tracking-widest uppercase leading-tight ${
                        shuffleState.isFailed ? 'text-[#8B0000]' :
                        shuffleState.hasRevealed ? 'text-[#c8a84b]' :
                        'text-white/85'
                    }`}>
                        {(() => {
                            const fullText = shuffleState.isFailed
                                ? 'TX_FAILED_PRESS_RETRY'
                                : shuffleState.hasRevealed
                                    ? 'PENDING // ALL_OPERATIVES'
                                    : shuffleState.isMyTurn
                                        ? (shuffleState.hasCommitted ? 'STEP_2 // SEALING_DOSSIER' : 'STEP_1 // SCRAMBLING_DATA')
                                        : `PENDING // ${currentShufflerName?.toUpperCase() || 'PLAYER'}`;
                            
                            const parts = fullText.split(' // ');
                            if (parts.length > 1) {
                                return (
                                    <>
                                        <span className="opacity-40">{parts[0]} // </span>
                                        <TypewriterText text={parts[1]} />
                                    </>
                                );
                            }
                            return <TypewriterText text={fullText} />;
                        })()}
                    </p>
                    {!shuffleState.hasRevealed && !shuffleState.isFailed && (
                        <motion.div
                            className="w-2 h-4 bg-[#c8a84b]"
                            animate={{ opacity: [1, 1, 0, 0, 1] }}
                            transition={{ 
                                duration: 1, 
                                repeat: Infinity, 
                                times: [0, 0.5, 0.51, 0.99, 1],
                                ease: "linear"
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Hero Progress — Enlarged Cards */}
            <div className="w-full">
                <div className="flex gap-3 justify-center">
                    {[...Array(totalPlayers)].map((_, i) => {
                        const isDone = i < shuffleState.currentShufflerIndex;
                        const isActive = i === shuffleState.currentShufflerIndex && !shuffleState.hasRevealed && !shuffleState.isFailed;
                        return (
                            <div
                                key={i}
                                className={`w-8 h-11 border text-[12px] flex items-center justify-center rounded-[2px] transition-all duration-500 overflow-hidden relative ${
                                    isDone 
                                        ? 'border-[#c8a84b] text-[#c8a84b] bg-[#c8a84b]/20 shadow-[0_0_12px_rgba(200,168,75,0.25)]'
                                        : isActive
                                            ? 'border-[#c8a84b] text-[#c8a84b] bg-[#c8a84b]/5 animate-pulse'
                                            : 'border-white/10 text-white/10 bg-[#13120f]/50'
                                }`}
                            >
                                {(isDone || isActive) && <div className={`absolute top-0 left-0 right-0 h-[3px] bg-[#c8a84b] ${isActive ? 'animate-pulse' : ''}`} />}
                                <span className="font-mono">?</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {shuffleState.isFailed && shuffleState.isMyTurn && (
                <Button
                    variant="ghost"
                    className="text-[10px] font-mono tracking-[0.3em] h-10 px-8 border-[#8B0000]/40 text-[#8B0000] hover:bg-[#8B0000]/10 uppercase rounded-sm"
                    onClick={onRetry}
                >
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    RETRY OPERATION
                </Button>
            )}
        </div>
    );
};

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
    allConfirmed: boolean;
    isTestMode: boolean;
}

const RevealPanel: React.FC<RevealPanelProps> = ({
    revealState, isProcessing, isTxPending, onConfirm, allConfirmed, isTestMode
}) => {
    const roleConfig = revealState.myRole ? RoleConfig[revealState.myRole] : RoleConfig[Role.UNKNOWN];

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
            <AnimatePresence mode="wait">
                {(!revealState.isRevealed && !isTestMode) ? (
                    // Loading state
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-5 text-center"
                    >
                        {/* ASCII Spinner */}
                        <div className="h-14 flex items-center justify-center mb-6">
                            <div className="relative w-14 h-14 flex items-center justify-center border border-white/5 bg-[#0f0e10] rounded-sm">
                                <AsciiSpinner className="text-[#c8a84b] text-2xl" />
                            </div>
                        </div>
                        <div>
                            <p className="font-mono text-[10px] tracking-[0.35em] text-white/50 uppercase mb-2">&gt; STATUS</p>
                            <p className="font-mono text-[16px] tracking-wide text-white/80 uppercase">
                                <TypewriterText 
                                    text={!revealState.eciesRegistered ? 'SECURING_CHANNEL' :
                                        !revealState.hasSharedKeys ? 'DECRYPTING_DOSSIER' :
                                            'VERIFYING_IDENTITY'} 
                                />
                                <motion.span
                                    className="ml-1 text-[#c8a84b]"
                                    animate={{ opacity: [1, 1, 0, 0, 1] }}
                                    transition={{ 
                                        duration: 1, 
                                        repeat: Infinity, 
                                        times: [0, 0.5, 0.51, 0.99, 1],
                                        ease: "linear"
                                    }}
                                >
                                    ▌
                                </motion.span>
                            </p>
                        </div>
                        <div className="w-full max-w-[220px]">
                            <div className="h-[2px] bg-black/70 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-[#c8a84b] rounded-full"
                                    animate={{ width: revealState.hasSharedKeys ? '100%' : '50%' }}
                                    transition={{ duration: 0.6 }}
                                />
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    // Role card (Original Design)
                    <motion.div
                        key="revealed"
                        initial={{ opacity: 0, rotateY: 90 }}
                        animate={{ opacity: 1, rotateY: 0 }}
                        transition={{ type: "spring", duration: 0.8 }}
                        className={`bg-gradient-to-br ${roleConfig.bgColor} w-[240px] aspect-[3/4] rounded-sm border ${roleConfig.borderColor} ring-1 ${roleConfig.ringColor} p-6 shadow-[0_30px_60px_rgba(0,0,0,0.98)] relative overflow-hidden flex flex-col justify-between`}
                    >
                        {/* SVG Noise */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
                            <filter id="noise-original">
                                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
                                <feColorMatrix type="saturate" values="0" />
                            </filter>
                            <rect width="100%" height="100%" filter="url(#noise-original)" />
                        </svg>

                        {/* Watermark icon */}
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
                            className={`absolute top-7 left-4 font-mono text-[10px] tracking-[0.3em] uppercase px-2 py-[3px] border ${roleConfig.borderColor} ${roleConfig.color} opacity-20 rotate-[-12deg] select-none pointer-events-none`}
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
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.15 }}
                                className="font-mono text-[7px] tracking-[0.3em] text-white/35 uppercase mb-3"
                            >
                                CASE FILE // ROLE
                            </motion.p>
                            <motion.h2
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className={`text-[24px] font-[Cinzel] font-semibold tracking-[0.2em] mb-3 ${roleConfig.color}`}
                            >
                                {revealState.myRole}
                            </motion.h2>
                            <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ delay: 0.45, duration: 0.5 }}
                                className="h-px w-10 mx-auto mb-3 opacity-30"
                                style={{ background: 'currentColor' }}
                            />
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.55 }}
                                className="text-white/40 text-[10px] font-mono leading-relaxed tracking-wide max-w-[170px] mx-auto"
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
                                    whileTap={{ scale: 0.98 }}
                                    className={`w-full py-2.5 px-4 rounded-sm border font-[Cinzel] text-[9px] tracking-[0.25em] uppercase transition-all duration-300
                                        border-white/10 text-white/50
                                        bg-transparent hover:bg-white/[0.05] hover:border-white/30 hover:text-white/80
                                        disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                                >
                                    {(isProcessing || isTxPending)
                                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Confirming...</>
                                        : 'I Understand My Role'}
                                </motion.button>
                            ) : (
                                <div className={`flex items-center justify-center gap-2 ${roleConfig.color} py-3`}>
                                    {allConfirmed ? <Check className="w-4 h-4" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span className="font-['Montserrat'] text-[9px] tracking-[0.2em] uppercase font-bold opacity-80">
                                        {allConfirmed ? 'Confirmed' : 'Awaiting Others...'}
                                    </span>
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
        refreshPlayersList, runtimeContractAddress, isTestMode, runtimeChain
    } = useGameContext();

    const { address, chainId: wagmiChainId } = useAccount();
    const chainId = runtimeChain?.id || wagmiChainId;
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
        const isRevealPhase = gameState.phase === GamePhase.REVEAL;
        
        if (isRevealPhase) {
            console.log('[ShuffleAndReveal] TestMode: Setting revealState to visible for role:', myPlayer.role);
            if (myPlayer.hasConfirmedRole) {
                setRevealState({ myRole: myPlayer.role, isRevealed: true, hasSharedKeys: true, eciesRegistered: true, hasConfirmed: true });
            } else {
                setRevealState({ myRole: myPlayer.role, isRevealed: true, hasSharedKeys: true, eciesRegistered: true, hasConfirmed: false });
            }
        } else {
            // Reset for shuffle phase
            setRevealState(prev => ({ ...prev, isRevealed: false, myRole: null, hasConfirmed: false }));
        }
    }, [isTestMode, myPlayer, gameState.phase, gameState.revealedCount, gameState.players.length]);

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
                allowFailure: true,
                blockTag: 'pending'
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
        const iv = setInterval(fetchShuffleData, 3000);
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
    // Auto-unstick (handles both SHUFFLE and REVEAL hangs)
    useEffect(() => {
        const globalDeadline = gameState.phaseDeadline;
        if (!currentRoomId || !myPlayer || !globalDeadline) return;

        const check = () => {
            if (processRef.current || isShuffleProcessing || isRevealProcessing || isTxPending) return;
            const nowSec = Math.floor(Date.now() / 1000);
            
            // Allow a small buffer after deadline
            if (nowSec <= globalDeadline + 5) return;

            // Simple deterministic arbitrator: the first alive player in the list handles the kick
            const sorted = [...gameState.players].filter(p => p.isAlive).sort((a, b) => a.address.localeCompare(b.address));
            if (!sorted.length || sorted[0].address.toLowerCase() !== myPlayer.address.toLowerCase()) return;

            const marker = `${currentRoomId}:${globalDeadline}`;
            if (autoKickMarkerRef.current === marker) return;
            autoKickMarkerRef.current = marker;

            addLog('Phase timeout detected. Auto-unsticking game...', 'warning');
            handleTimeoutKick().catch(() => { autoKickMarkerRef.current = ''; });
        };
        check();
        const iv = setInterval(check, 3000);
        return () => clearInterval(iv);
    }, [currentRoomId, myPlayer, gameState.phaseDeadline, gameState.players, isShuffleProcessing, isRevealProcessing, isTxPending, handleTimeoutKick, addLog]);

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
            const isRevert = (e?.message || '').match(/reverted|InvalidReveal|PhaseDeadlinePassed|revert|Out Of Gas|fetch|network/i);
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
            // DELETED: Proactive Session Sync (it requested an annoying Main Wallet signature, ignoring the UX of session keys)


            let registered = false, lastErr: any;
            for (let i = 0; i < 15; i++) { // Increased attempts
                try {
                    // Only fallback to Main Wallet (forceWallet) after 12 failed attempts
                    await registerEciesPubkey(currentRoomId.toString(), address, walletClient, chainId, retryWithWallet || i >= 12);
                    registered = true; break;
                } catch (e) { lastErr = e; if (i < 14) await new Promise(r => setTimeout(r, 2000)); }
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
            
            let submitted = false;
            let lastErr: any;
            for (let i = 0; i < 10; i++) {
                try {
                    await submitSraKeyToGm({ 
                        roomId: currentRoomId.toString(), 
                        address, 
                        sraKey: svc.getDecryptionKey(), 
                        walletClient, 
                        chainId 
                    });
                    submitted = true;
                    break;
                } catch (err: any) {
                    lastErr = err;
                    const msg = err.message?.toLowerCase() || '';
                    // Retry on common RPC lag and generic network errors (fetch failed, 502, 504, etc)
                    if (msg.includes('400') || msg.includes('phase') || msg.includes('fetch') || msg.includes('network') || msg.includes('bad gateway') || msg.includes('502') || msg.includes('504')) {
                        console.warn(`[Reveal] SRA submission attempt ${i + 1} failed (transient err: ${msg}), retrying...`);
                        await new Promise(r => setTimeout(r, 1500));
                    } else {
                        // For authenticauth / unrecoverable errors, we can try to wait but throw eventually
                        console.warn(`[Reveal] SRA submission attempt ${i + 1} failed with unhandled err: ${msg}, retrying anyway...`);
                        await new Promise(r => setTimeout(r, 1500));
                    }
                }
            }
            if (!submitted) throw lastErr;

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
        if (isTestMode || !currentRoomId || !address || !walletClient || revealState.isRevealed || revealState.hasConfirmed || !revealState.hasSharedKeys || fetchInFlightRef.current) return;
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
            const hasConfirmed = player.hasConfirmedRole;
            return (
                <div
                    className={`flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] transition-all hover:bg-white/[0.02] ${
                        hasConfirmed ? 'bg-[#c8a84b]/[0.05]' : isMe ? 'bg-[#c8a84b]/[0.03]' : ''
                    }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasConfirmed ? 'bg-[#c8a84b]' : 'bg-[#3a3838]'}`} />
                        <span className={`font-mono text-[13px] tracking-wide truncate ${isMe ? 'text-[#e8c86a]' : hasConfirmed ? 'text-white/80' : 'text-white/40'}`}>
                            {player.name}{isMe ? ' (YOU)' : ''}
                        </span>
                    </div>
                    <div className={`text-[9px] tracking-[0.2em] font-mono px-1.5 py-0.5 rounded-[1px] border ${
                        hasConfirmed 
                            ? 'border-[#4a8a5a]/30 text-[#4a8a5a] bg-[#4a8a5a]/[0.05]' 
                            : 'border-white/10 text-white/20'
                    }`}>
                        CONF
                    </div>
                </div>
            );
        }

        const isDone = index < shuffleState.currentShufflerIndex || (isMe && shuffleState.hasRevealed);
        const isActive = index === shuffleState.currentShufflerIndex && !isDone;
        return (
            <motion.div
                layout
                className={`flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] transition-all hover:bg-white/[0.02] ${
                    isActive ? 'bg-[#c8a84b]/[0.08]' : isDone ? 'bg-[#c8a84b]/[0.04]' : ''
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive || isDone ? 'bg-[#c8a84b]' : 'bg-[#3a3838]'}`} />
                    <span className={`font-mono text-[13px] tracking-wide truncate ${
                        isMe ? 'text-[#e8c86a]' :
                        isDone ? 'text-white/80' :
                        isActive ? 'text-white/90' :
                        'text-white/40'
                    }`}>
                        {player.name}{isMe ? ' (YOU)' : ''}
                    </span>
                </div>
                <div className={`text-[9px] tracking-[0.2em] font-mono px-1.5 py-0.5 rounded-[1px] border ${
                    isDone 
                        ? 'border-[#c8a84b]/30 text-[#c8a84b] bg-[#c8a84b]/[0.05]' 
                        : isActive 
                            ? 'border-[#c8a84b]/60 text-[#c8a84b] bg-[#c8a84b]/[0.1] shadow-[0_0_5px_rgba(200,168,75,0.2)]'
                            : 'border-white/10 text-white/10'
                }`}>
                    {isDone ? 'DONE' : isActive ? 'ACTIVE' : 'WAIT'}
                </div>
            </motion.div>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="w-full h-[100dvh] flex flex-col items-center justify-center overflow-hidden p-4 pointer-events-auto">
            <div className="w-full max-w-[820px] bg-[#09080b] rounded-sm border border-white/5 shadow-[0_45px_100px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden">

                {/* ── HEADER ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] bg-[#0f0e10]">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] tracking-[0.4em] text-white/30 uppercase">CASE FILE</span>
                        <span className="text-white/10">//</span>
                        <span className="font-mono text-[11px] tracking-[0.3em] text-[#c8a84b] uppercase font-bold">
                            ROOM_{currentRoomId?.toString() || '???'}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={isReveal ? 'reveal' : 'shuffle'}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex items-center gap-2.5"
                            >
                                <div className="w-1.5 h-1.5 bg-[#c8a84b] rounded-full animate-pulse" />
                                <span className="font-mono text-[11px] tracking-[0.3em] text-[#c8a84b] uppercase font-semibold">
                                    {isReveal ? 'ROLE REVEAL' : 'SHUFFLE PHASE'}
                                </span>
                            </motion.div>
                        </AnimatePresence>

                        {isReveal ? (
                            <div className="h-4 w-[1px] bg-white/10" />
                        ) : null}

                        {isReveal ? (
                            <span className="font-mono text-[11px] tracking-[0.2em] text-white/40">
                                <span className="text-[#c8a84b]">{keysCollected}</span>/{totalPlayers} CONFIRMED
                            </span>
                        ) : (
                            <div className="flex items-center gap-3">
                                {Date.now() / 1000 > shuffleState.phaseDeadline && shuffleState.phaseDeadline > 0 && (
                                    <button
                                        onClick={handleTimeoutKick}
                                        disabled={isShuffleProcessing}
                                        className="font-mono text-[9px] tracking-widest text-[#8B0000] hover:brightness-125 uppercase transition-all"
                                    >
                                        [FORCE_KICK]
                                    </button>
                                )}
                                <button
                                    onClick={forceSync}
                                    disabled={isSyncing}
                                    className="text-white/20 hover:text-[#c8a84b] transition-colors"
                                >
                                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── BODY ───────────────────────────────────────────── */}
                <div className="flex min-h-[460px] bg-[#09080a]">

                    {/* LEFT — Suspects */}
                    <div className="w-[220px] shrink-0 border-r border-white/[0.05] flex flex-col bg-[#0f0e10]/50">
                        <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
                            <span className="font-mono text-[10px] tracking-[0.3em] text-white/30 uppercase">SUSPECTS</span>
                            {!isReveal && (
                                <span className="font-mono text-[10px] text-[#c8a84b]/60">
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

                    {/* RIGHT — content */}
                    <AnimatePresence>
                        <motion.div
                            key={isReveal ? 'reveal-panel' : 'shuffle-panel'}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 flex"
                        >
                            {isTestMode && isReveal && (
                                <div className="absolute top-2 right-2 z-50 text-[8px] font-mono text-white/20">
                                    DEBUG: isRevealed={revealState.isRevealed ? 'YES' : 'NO'}
                                </div>
                            )}
                            {isReveal ? (
                                <RevealPanel
                                    revealState={revealState}
                                    isProcessing={isRevealProcessing}
                                    isTxPending={isTxPending}
                                    onConfirm={handleConfirmRole}
                                    allConfirmed={keysCollected >= totalPlayers}
                                    isTestMode={isTestMode}
                                />
                            ) : (
                                <ShufflePanel
                                    shuffleState={shuffleState}
                                    progress={progress}
                                    isProcessing={isShuffleProcessing}
                                    isTxPending={isTxPending}
                                    currentShufflerName={currentShuffler?.name}
                                    totalPlayers={totalPlayers}
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
                <div className="px-6 py-3 border-t border-white/[0.05] bg-[#0f0e10]">
                    <span className="font-mono text-[9px] tracking-[0.4em] text-white/20 uppercase flex justify-center">
                        // SOMNIA PROTOCOL // SECURE CHANNEL ACTIVE //
                    </span>
                </div>
            </div>
        </div>
    );
});

ShuffleAndReveal.displayName = 'ShuffleAndReveal';
