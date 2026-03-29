// components/game/ShufflePhase.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { usePublicClient, useWriteContract } from 'wagmi';
import { MAFIA_ABI } from '../../contracts/config';
import { Check, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface ShuffleState {
    currentShufflerIndex: number;
    deck: string[];
    isMyTurn: boolean;
    hasCommitted: boolean;
    hasRevealed: boolean;
    pendingDeck: string[] | null;
    pendingSalt: string | null;
    phaseDeadline: number;
    retryCount: number;
    lastErrorTime: number;
    isFailed: boolean;
}
interface AsciiSpinnerProps {
    className?: string;
}

const AsciiSpinner: React.FC<AsciiSpinnerProps> = ({ className = '' }) => {
    const [frame, setFrame] = useState(0);
    const frames = ['|', '/', '-', '\\'];
    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(prev => (prev + 1) % frames.length);
        }, 120);
        return () => clearInterval(interval);
    }, []);
    return <span className={`font-mono font-bold inline-block ${className}`}>{frames[frame]}</span>;
};

export const ShufflePhase: React.FC = React.memo(() => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        commitDeckOnChain,
        revealDeckOnChain,
        addLog,
        isTxPending,
        refreshPlayersList,
        runtimeContractAddress,
        isTestMode
    } = useGameContext();

    const publicClient = usePublicClient();
    const [shuffleState, setShuffleState] = useState<ShuffleState>({
        currentShufflerIndex: 0,
        deck: [],
        isMyTurn: false,
        hasCommitted: false,
        hasRevealed: false,
        pendingDeck: null,
        pendingSalt: null,
        phaseDeadline: 0,
        retryCount: 0,
        lastErrorTime: 0,
        isFailed: false
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const processingRef = useRef(false);
    const autoKickMarkerRef = useRef<string>('');
    const lastLoggedDeckRef = useRef<{ length: number; index: number }>({ length: 0, index: -1 });

    const [pendingDeck, setPendingDeck] = useState<string[] | null>(null);
    const [pendingSalt, setPendingSalt] = useState<string | null>(null);

    const SHUFFLE_COMMIT_KEY = `mafia_shuffle_commit_${currentRoomId}_${myPlayer?.address?.toLowerCase() || ''}`;

    // Restore state from local storage on mount
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
                                const chainCommitted = flags?.[3];
                                if (chainCommitted) {
                                    console.log("[Shuffle Recovery] Chain confirms commit. Promoting to hasCommitted=true.");
                                    localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({ deck, salt, hasCommitted: true }));
                                    setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                                } else {
                                    console.log("Restored pending shuffle state (pre-commit, chain not committed yet)");
                                    setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                                }
                            }).catch(() => {
                                setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                                console.log("Restored pending shuffle state (chain check failed)");
                            });
                        } else {
                            setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                            console.log("Restored pending shuffle state (pre-commit)");
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to recover pending deck", e);
            }
        }

        if (currentRoomId && myPlayer) {
            const shuffleService = getShuffleService();
            if (!shuffleService.hasKeys()) {
                shuffleService.loadKeys(currentRoomId.toString(), myPlayer.address);
            }
        }
    }, [SHUFFLE_COMMIT_KEY]);

    // Fetch data from contract
    const fetchShuffleData = useCallback(async () => {
        if (isTestMode) {
            const shufflerIdx = gameState.players.findIndex(p => !p.hasDeckCommitted);
            const safeIndex = shufflerIdx === -1 ? gameState.players.length : shufflerIdx;
            if (shuffleState.currentShufflerIndex !== safeIndex) {
                setShuffleState(prev => ({
                    ...prev,
                    currentShufflerIndex: safeIndex,
                    isMyTurn: false,
                    hasCommitted: false,
                }));
            }
            return;
        }

        if (!publicClient || !currentRoomId) return;
        if (processingRef.current) return;

        try {
            const results = await publicClient.multicall({
                contracts: [
                    {
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI as any,
                        functionName: 'getRoom',
                        args: [currentRoomId],
                    },
                    {
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI as any,
                        functionName: 'getDeck',
                        args: [currentRoomId],
                    }
                ],
                allowFailure: true
            });

            const roomDataResult = results[0];
            const deckDataResult = results[1];

            const roomData = roomDataResult.status === 'success' ? (roomDataResult.result as any) : null;
            let deck = deckDataResult.status === 'success' ? (deckDataResult.result as string[]) : [];

            let currentIndex = 0;
            let revealedCount = 0;
            let deadline = 0;

            if (Array.isArray(roomData)) {
                currentIndex = Number(roomData[8]);
                deadline = Number(roomData[10]);
                revealedCount = Number(roomData[14]);
            } else if (roomData && typeof roomData === 'object') {
                currentIndex = Number(roomData.currentShufflerIndex);
                deadline = Number(roomData.phaseDeadline);
                revealedCount = Number(roomData.revealedCount);
            }

            if (isNaN(currentIndex)) currentIndex = 0;

            if (currentIndex > 0 || revealedCount > 0) {
                if (deck.length > 0) {
                    if (lastLoggedDeckRef.current.length !== deck.length || lastLoggedDeckRef.current.index !== currentIndex) {
                        console.log(`[Direct Sync] Loaded deck with ${deck.length} cards (idx=${currentIndex})`);
                        lastLoggedDeckRef.current = { length: deck.length, index: currentIndex };
                    }
                }

                if (deck.length === 0) {
                    try {
                        const currentBlock = await publicClient.getBlockNumber();
                        const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;

                        const logs = await publicClient.getContractEvents({
                            address: runtimeContractAddress,
                            abi: MAFIA_ABI,
                            eventName: 'DeckRevealed',
                            args: { roomId: currentRoomId } as any,
                            fromBlock: fromBlock
                        });

                        if (logs && logs.length > 0) {
                            const lastLog = logs[logs.length - 1];
                            deck = (lastLog.args as any).deck as string[];
                            console.log(`[Event Sync] Loaded deck with ${deck.length} cards from logs`);
                        }
                    } catch (err) {
                        console.warn("[Event Sync] Events not available either");
                    }
                }
            }

            const currentShuffler = gameState.players[currentIndex];
            let isMyTurnFromContract = false;
            if (currentShuffler && myPlayer) {
                isMyTurnFromContract = currentShuffler.address.toLowerCase() === myPlayer.address.toLowerCase();
            }

            if (isMyTurnFromContract || deck.length === 0) {
                console.log(`[Shuffle Sync] idx=${currentIndex}, deck=${deck.length} cards, isMyTurn=${isMyTurnFromContract}, shuffler=${currentShuffler?.name || '?'}`);
            }

            if (isMyTurnFromContract && currentIndex > 0 && deck.length === 0) {
                console.warn("[Shuffle Sync] ⚠️ My turn but deck is EMPTY! Blocking until deck syncs.");
                isMyTurnFromContract = false;
            }

            setShuffleState(prev => {
                const safeIndex = Math.max(prev.currentShufflerIndex, currentIndex);

                if (prev.hasRevealed) {
                    return { ...prev, currentShufflerIndex: safeIndex, deck: deck.length > 0 ? deck : prev.deck };
                }

                if (prev.hasCommitted) {
                    return { ...prev, currentShufflerIndex: safeIndex, deck: deck.length > 0 ? deck : prev.deck };
                }

                return {
                    ...prev,
                    currentShufflerIndex: safeIndex,
                    deck: deck,
                    isMyTurn: isMyTurnFromContract,
                    phaseDeadline: deadline
                };
            });
        } catch (error) {
            console.error("Shuffle sync error:", error);
        }
    }, [publicClient, currentRoomId, gameState.players, myPlayer]);

    // Force Sync Function
    const forceSync = useCallback(async () => {
        if (!currentRoomId) return;
        setIsSyncing(true);
        try {
            await fetchShuffleData();
            await refreshPlayersList(currentRoomId);
        } finally {
            setIsSyncing(false);
        }
    }, [currentRoomId, fetchShuffleData, refreshPlayersList]);

    const { writeContractAsync } = useWriteContract();

    const handleTimeoutKick = useCallback(async () => {
        if (!currentRoomId) return;
        setIsProcessing(true);
        try {
            const hash = await writeContractAsync({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'forcePhaseTimeout',
                args: [currentRoomId],
            });
            addLog(`Timeout kick tx sent: ${hash.substring(0, 10)}...`, 'info');
        } catch (err) {
            console.error("Kick failed", err);
            addLog("Failed to kick player", 'danger');
        } finally {
            setIsProcessing(false);
        }
    }, [currentRoomId, writeContractAsync, addLog]);

    // AUTO-UNSTICK
    useEffect(() => {
        if (!currentRoomId || !myPlayer || !shuffleState.phaseDeadline) return;

        const checkAndKick = () => {
            if (processingRef.current || isProcessing || isTxPending) return;

            const nowSec = Math.floor(Date.now() / 1000);
            const deadline = shuffleState.phaseDeadline;
            const GRACE_SECONDS = 5;

            if (nowSec <= deadline + GRACE_SECONDS) return;

            const aliveSorted = [...gameState.players]
                .filter((p) => p.isAlive)
                .sort((a, b) => a.address.localeCompare(b.address));

            const shouldTrigger =
                aliveSorted.length > 0 &&
                aliveSorted[0].address.toLowerCase() === myPlayer.address.toLowerCase();

            if (!shouldTrigger) return;

            const marker = `${currentRoomId.toString()}:${deadline}`;
            if (autoKickMarkerRef.current === marker) return;
            autoKickMarkerRef.current = marker;

            addLog('Shuffle timeout reached. Auto-kicking stalled turn...', 'warning');
            handleTimeoutKick().catch(() => {
                autoKickMarkerRef.current = '';
            });
        };

        checkAndKick();
        const timer = setInterval(checkAndKick, 2000);
        return () => clearInterval(timer);
    }, [
        currentRoomId,
        myPlayer,
        shuffleState.phaseDeadline,
        gameState.players,
        isProcessing,
        isTxPending,
        handleTimeoutKick,
        addLog,
    ]);

    // Polling interval
    useEffect(() => {
        if (isTestMode) {
            fetchShuffleData();
            return;
        }

        fetchShuffleData();
        const interval = setInterval(fetchShuffleData, 1500);
        return () => clearInterval(interval);
    }, [fetchShuffleData, isTestMode]);

    // Resync on visibility/online
    useEffect(() => {
        const handleVisibility = () => {
            if (!document.hidden) {
                fetchShuffleData();
                if (currentRoomId) refreshPlayersList(currentRoomId);
            }
        };

        const handleOnline = () => {
            fetchShuffleData();
            if (currentRoomId) refreshPlayersList(currentRoomId);
            addLog('Connection restored. Syncing shuffle state...', 'info');
        };

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
        };
    }, [fetchShuffleData, refreshPlayersList, currentRoomId, addLog]);

    // Warn before closing tab
    useEffect(() => {
        const shouldWarn =
            shuffleState.isMyTurn &&
            !shuffleState.hasRevealed &&
            !gameState.players.some((p) => p.address.toLowerCase() === myPlayer?.address?.toLowerCase() && !p.isAlive);

        if (!shouldWarn) return;

        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'Your shuffle turn is in progress. Leaving now may stall the game.';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [shuffleState.isMyTurn, shuffleState.hasRevealed, gameState.players, myPlayer?.address]);

    const handleMyTurn = useCallback(async () => {
        if (!currentRoomId || !myPlayer || isProcessing || processingRef.current) return;

        processingRef.current = true;
        setIsProcessing(true);
        try {
            const shuffleService = getShuffleService();
            const activeIndices = gameState.players
                .map((p, i) => p.isAlive ? i : -1)
                .filter(i => i !== -1);

            const roomIdStr = currentRoomId?.toString() || '0';
            const verifyDeck = ShuffleService.generateInitialDeck(
                gameState.players.length, roomIdStr, activeIndices.length
            );
            const uniqueCardValues = [...new Set(verifyDeck)];

            if (!shuffleService.hasKeys()) {
                shuffleService.generateVerifiedKeys(uniqueCardValues);
                console.log("[Shuffle] Generated fresh verified SRA keys");
            } else {
                console.log("[Shuffle] Reusing existing SRA keys");
            }

            let newDeck: string[];

            if (shuffleState.currentShufflerIndex === 0) {
                if (shuffleState.deck.length > 0) {
                    console.warn("Host sees existing deck, resetting...");
                }
                const initialDeck = ShuffleService.generateDistributedDeck(
                    gameState.players.map(p => ({ isAlive: p.isAlive })),
                    roomIdStr
                );
                newDeck = shuffleService.encryptDeck(initialDeck);
            } else {
                if (shuffleState.deck.length === 0) {
                    throw new Error("Deck is empty! Sync error.");
                }
                newDeck = shuffleService.encryptDeck(shuffleState.deck);
            }

            const salt = ShuffleService.generateSalt();
            const deckHash = ShuffleService.createDeckCommitHash(newDeck, salt);

            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({
                deck: newDeck, salt: salt, hasCommitted: false
            }));
            shuffleService.saveKeys(currentRoomId.toString(), myPlayer.address);

            console.log("[Shuffle] Step 1/2: Committing deck hash...");
            await commitDeckOnChain(deckHash);

            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({
                deck: newDeck, salt: salt, hasCommitted: true
            }));

            setShuffleState(prev => ({
                ...prev,
                hasCommitted: true,
                isMyTurn: true
            }));

            console.log("[Shuffle] Commit success! Waiting 500ms before reveal...");
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log("[Shuffle] Step 2/2: Revealing deck...");
            await revealDeckOnChain(newDeck, salt);

            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setPendingDeck(null);
            setPendingSalt(null);

            setShuffleState(prev => ({
                ...prev,
                hasRevealed: true,
                currentShufflerIndex: prev.currentShufflerIndex + 1
            }));

            console.log("[Shuffle] ✅ Commit+Reveal complete!");
            setTimeout(fetchShuffleData, 200);

        } catch (e: any) {
            console.error("[Shuffle] Failed:", e);
            const errMsg = e?.message || e?.toString() || '';
            addLog(errMsg.substring(0, 120) || "Shuffle failed", "danger");

            const isContractRevert = errMsg.includes('reverted') || errMsg.includes('InvalidReveal') ||
                errMsg.includes('PhaseDeadlinePassed') || errMsg.includes('revert') || errMsg.includes('Out Of Gas');

            setShuffleState(prev => ({
                ...prev,
                retryCount: prev.retryCount + 1,
                lastErrorTime: Date.now(),
                isFailed: isContractRevert && prev.retryCount >= 2
            }));

            if (isContractRevert) {
                console.warn("[Shuffle] Contract revert detected. Local state preserved for manual retry.");
            }
        } finally {
            processingRef.current = false;
            setIsProcessing(false);
        }
    }, [currentRoomId, myPlayer, isProcessing, shuffleState.currentShufflerIndex, shuffleState.deck, gameState.players.length, SHUFFLE_COMMIT_KEY, commitDeckOnChain, revealDeckOnChain, addLog, fetchShuffleData]);

    // Manual reveal recovery
    const handleReveal = useCallback(async () => {
        if (!currentRoomId || !pendingDeck || !pendingSalt || isProcessing) return;

        setIsProcessing(true);
        try {
            console.log("[Shuffle Recovery] Revealing deck from saved state...");
            await revealDeckOnChain(pendingDeck, pendingSalt);

            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setPendingDeck(null);
            setPendingSalt(null);

            setShuffleState(prev => ({
                ...prev,
                hasRevealed: true,
                currentShufflerIndex: prev.currentShufflerIndex + 1
            }));

            setTimeout(fetchShuffleData, 200);
        } catch (e: any) {
            console.error("Reveal failed:", e);
            addLog(e.message || "Reveal failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    }, [currentRoomId, pendingDeck, pendingSalt, isProcessing, revealDeckOnChain, SHUFFLE_COMMIT_KEY, fetchShuffleData, addLog]);

    const currentShuffler = gameState.players[shuffleState.currentShufflerIndex];
    const totalPlayers = gameState.players.length;
    const progress = Math.min((shuffleState.currentShufflerIndex / totalPlayers) * 100, 100);

    // Auto-trigger my turn
    useEffect(() => {
        if (processingRef.current) return;

        const canExecuteAuto =
            shuffleState.isMyTurn &&
            !shuffleState.hasCommitted &&
            !isProcessing &&
            !isTxPending &&
            !shuffleState.hasRevealed &&
            !shuffleState.isFailed &&
            gameState.players.length > 0;

        if (canExecuteAuto) {
            const timeSinceLastErr = Date.now() - shuffleState.lastErrorTime;
            const COOLDOWN_MS = 10000;

            if (shuffleState.retryCount > 0 && timeSinceLastErr < COOLDOWN_MS) {
                return;
            }

            console.log(`[Shuffle Auto] My turn detected (attempt ${shuffleState.retryCount + 1}), starting commit+reveal...`);
            handleMyTurn();
        }
    }, [shuffleState.isMyTurn, shuffleState.hasCommitted, shuffleState.hasRevealed, isProcessing, isTxPending, gameState.players.length, handleMyTurn]);

    // Auto-recovery reveal
    useEffect(() => {
        const needsRecoveryReveal =
            shuffleState.isMyTurn &&
            shuffleState.hasCommitted &&
            !shuffleState.hasRevealed &&
            !isProcessing &&
            !isTxPending &&
            pendingDeck &&
            pendingSalt;

        if (needsRecoveryReveal) {
            console.log("[Shuffle Recovery] Found pending commit without reveal, auto-revealing...");
            const timer = setTimeout(() => {
                handleReveal();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [shuffleState.isMyTurn, shuffleState.hasCommitted, shuffleState.hasRevealed, isProcessing, isTxPending, pendingDeck, pendingSalt, handleReveal]);

    // ─── VISUAL RETURN ────────────────────────────────────────────────────────
    return useMemo(() => (
        <div className="w-full h-[100dvh] flex flex-col items-center justify-center overflow-hidden p-4 pointer-events-auto">
            <div
                className="w-full max-w-[740px] bg-[#060403] rounded-sm border border-[#916A47]/20 shadow-[0_40px_80px_rgba(0,0,0,0.97)] flex flex-col overflow-hidden"
            >
                {/* ── HEADER ─────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#916A47]/15 bg-black/50">
                    <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[12px] tracking-[0.3em] text-[#916A47] uppercase">CASE FILE</span>
                        <span className="text-[#916A47]/50">//</span>
                        <span className="font-mono text-[12px] tracking-[0.2em] text-white/55 uppercase">
                            ROOM_{currentRoomId?.toString() || '???'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] tracking-[0.25em] text-white/45 uppercase">SHUFFLE PHASE</span>
                        {Date.now() / 1000 > shuffleState.phaseDeadline && shuffleState.phaseDeadline > 0 && (
                            <button
                                onClick={handleTimeoutKick}
                                disabled={isProcessing}
                                className="font-mono text-[8px] tracking-widest text-[#8B0000]/60 hover:text-[#8B0000] uppercase animate-pulse transition-colors"
                            >
                                KICK
                            </button>
                        )}
                        <button
                            onClick={forceSync}
                            disabled={isSyncing}
                            className="text-white/15 hover:text-[#916A47]/50 transition-colors"
                        >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* ── BODY ───────────────────────────────────────────── */}
                <div className="flex min-h-[340px]">

                    {/* LEFT — Suspects roster */}
                    <div className="w-[210px] shrink-0 border-r border-[#916A47]/10 flex flex-col">
                        <div className="px-4 py-3 border-b border-[#916A47]/8">
                            <span className="font-mono text-[11px] tracking-[0.3em] text-white/55 uppercase">SUSPECTS</span>
                        </div>
                        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                            {gameState.players.map((player, index) => {
                                const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                                let isDone = index < shuffleState.currentShufflerIndex;
                                if (isMe && shuffleState.hasRevealed) isDone = true;
                                const isCurrentTurn = index === shuffleState.currentShufflerIndex && !isDone;
                                return (
                                    <motion.div
                                        key={player.address}
                                        layout
                                        className={`flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] transition-all ${isCurrentTurn ? 'bg-[#916A47]/8' : ''}`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`text-[11px] shrink-0 transition-colors ${isDone ? 'text-[#916A47]' :
                                                isCurrentTurn ? 'text-[#916A47] animate-pulse' :
                                                    'text-white/35'
                                                }`}>●</span>
                                            <span className={`font-mono text-[13px] truncate ${isMe ? 'text-[#916A47]' : 'text-white/70'}`}>
                                                {player.name}{isMe ? '_YOU' : ''}
                                            </span>
                                        </div>
                                        <span className={`font-mono text-[10px] tracking-wider shrink-0 ml-1 ${isDone ? 'text-[#916A47]' :
                                            isCurrentTurn ? 'text-[#916A47]' :
                                                'text-white/30'
                                            }`}>
                                            {isDone ? 'DONE' :
                                                isCurrentTurn ? (isProcessing ? '●●●' : 'ACTIVE') :
                                                    'WAIT_'}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT — Shuffle status */}
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-7">
                        {/* Shuffle ASCII Spinner */}
                        <div className="w-10 h-10 flex items-center justify-center opacity-80">
                            {shuffleState.hasRevealed ? (
                                <span className="font-mono text-[#916A47] text-2xl">✓</span>
                            ) : shuffleState.isFailed ? (
                                <span className="font-mono text-[#8B0000] text-2xl">✗</span>
                            ) : (
                                <AsciiSpinner className="text-[#916A47] text-3xl" />
                            )}
                        </div>

                        {/* Status */}
                        <div className="text-center">
                            <p className="font-mono text-[10px] tracking-[0.35em] text-white/50 uppercase mb-2">&gt; STATUS</p>
                            <p className={`font-mono text-[16px] tracking-wide uppercase ${shuffleState.isFailed ? 'text-[#8B0000]' :
                                shuffleState.hasRevealed ? 'text-[#916A47]' :
                                    'text-white/80'
                                }`}>
                                {shuffleState.isFailed
                                    ? '!! CONNECTION_LOST'
                                    : shuffleState.hasRevealed
                                        ? 'STANDBY // AWAITING_OPERATIVES'
                                        : shuffleState.isMyTurn
                                            ? (shuffleState.hasCommitted ? 'STEP_2 // SEALING_DOSSIER...' : 'STEP_1 // SCRAMBLING_DATA...')
                                            : `STANDBY // ${currentShuffler?.name?.toUpperCase() || 'PLAYER'}`
                                }
                                {!shuffleState.hasRevealed && !shuffleState.isFailed && (
                                    <span className="animate-pulse ml-1 text-[#916A47]">▌</span>
                                )}
                            </p>
                        </div>

                        {/* Fuse progress bar */}
                        <div className="w-full max-w-[280px]">
                            <div className="flex justify-between font-mono text-[10px] tracking-wide mb-2">
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
                                        className="absolute top-0 h-full w-4 bg-white/20 blur-[2px] rounded-full"
                                        animate={{ left: `${Math.max(progress - 2, 0)}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                    />
                                )}
                            </div>
                            <div className="font-mono text-[10px] tracking-wide mt-2 text-white/45 uppercase">
                                PLAYER {shuffleState.currentShufflerIndex + 1} / {gameState.players.length} &bull; {shuffleState.deck.length} CARDS
                            </div>
                        </div>

                        {shuffleState.isFailed && shuffleState.isMyTurn && (
                            <Button
                                variant="ghost"
                                className="text-[10px] font-mono tracking-widest py-1 h-7 border-[#8B0000]/40 text-[#8B0000]/70 hover:bg-[#8B0000]/10 uppercase"
                                onClick={() => {
                                    setShuffleState(prev => ({ ...prev, isFailed: false, retryCount: 0 }));
                                    handleMyTurn();
                                }}
                            >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                RETRY
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── FOOTER ─────────────────────────────────────────── */}
                <div className="px-5 py-2 border-t border-[#916A47]/8 bg-black/30">
                    <span className="font-mono text-[7px] tracking-[0.3em] text-white/30 uppercase flex justify-center">
                        // SOMNIA NETWORK //
                    </span>
                </div>
            </div>
        </div>
    ), [shuffleState, gameState.players, myPlayer, isProcessing, isTxPending, isSyncing, forceSync, handleMyTurn, handleReveal, handleTimeoutKick, currentShuffler?.name, progress, currentRoomId]);
});

ShufflePhase.displayName = 'ShufflePhase';
