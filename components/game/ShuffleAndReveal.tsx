// components/game/ShuffleAndReveal.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { useAccount, useWalletClient, usePublicClient, useWriteContract } from 'wagmi';
import { GamePhase, Role } from '../../types';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { MAFIA_ABI } from '../../contracts/config';
import { RefreshCw } from 'lucide-react';

// Internal Components
import { ShufflePanel } from './shuffle/ShufflePanel';
import { RevealPanel } from './shuffle/RevealPanel';
import { SuspectRow } from './shuffle/SuspectRow';

// Services
import { 
    registerEciesPubkey, submitSraKeyToGm, fetchMyRoleFromGm 
} from '../../services/gmService';
import { loadOrCreateKeypair } from '../../services/eciesService';

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
    const SHUFFLE_COMMIT_KEY = `mafia_shuffle_commit_${currentRoomId}_${myPlayer?.address?.toLowerCase() || ''}`;

    // ── Shuffle State ──────────────────────────────────────────────────────────
    const [shuffleState, setShuffleState] = useState({
        currentShufflerIndex: 0,
        deck: [] as string[],
        isMyTurn: false,
        hasCommitted: false,
        hasRevealed: false,
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

    // ── Reveal State ───────────────────────────────────────────────────────────
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

    // ── Restore state ──
    useEffect(() => {
        const saved = localStorage.getItem(SHUFFLE_COMMIT_KEY);
        if (saved) {
            try {
                const { deck, salt, hasCommitted } = JSON.parse(saved);
                if (deck && salt) {
                    setPendingDeck(deck); setPendingSalt(salt);
                    if (hasCommitted) setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                    else {
                        if (publicClient && currentRoomId && myPlayer?.address) {
                            publicClient.readContract({
                                address: runtimeContractAddress, abi: MAFIA_ABI, functionName: 'getPlayerFlags',
                                args: [currentRoomId, myPlayer.address as `0x${string}`],
                            }).then((flags: any) => {
                                if (flags?.[3]) {
                                    localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({ deck, salt, hasCommitted: true }));
                                    setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                                } else setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                            }).catch(() => setShuffleState(prev => ({ ...prev, isMyTurn: true })));
                        } else setShuffleState(prev => ({ ...prev, isMyTurn: true }));
                    }
                }
            } catch (e) { console.error('Failed recovery', e); }
        }
        if (currentRoomId && myPlayer) {
            const svc = getShuffleService();
            if (!svc.hasKeys()) svc.loadKeys(currentRoomId.toString(), myPlayer.address);
        }
    }, [SHUFFLE_COMMIT_KEY]);

    useEffect(() => {
        if (myPlayer?.hasConfirmedRole && !revealState.hasConfirmed)
            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
    }, [myPlayer?.hasConfirmedRole, revealState.hasConfirmed]);

    useEffect(() => {
        if (!isTestMode || !myPlayer) return;
        if (gameState.phase === GamePhase.REVEAL) {
            setRevealState({ myRole: myPlayer.role, isRevealed: true, hasSharedKeys: true, eciesRegistered: true, hasConfirmed: myPlayer.hasConfirmedRole });
        } else setRevealState(prev => ({ ...prev, isRevealed: false, myRole: null, hasConfirmed: false }));
    }, [isTestMode, myPlayer, gameState.phase]);

    // ── Sync Logic ──
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
                currentIndex = Number(roomData[8]); deadline = Number(roomData[10]); revealedCount = Number(roomData[14]);
            } else if (roomData) {
                currentIndex = Number(roomData.currentShufflerIndex); deadline = Number(roomData.phaseDeadline); revealedCount = Number(roomData.revealedCount);
            }
            if (isNaN(currentIndex)) currentIndex = 0;

            if ((currentIndex > 0 || revealedCount > 0) && deck.length === 0) {
                try {
                    const logs = await publicClient.getContractEvents({
                        address: runtimeContractAddress, abi: MAFIA_ABI, eventName: 'DeckRevealed', args: { roomId: currentRoomId } as any, 
                        fromBlock: (await publicClient.getBlockNumber()) - 10000n
                    });
                    if (logs?.length > 0) deck = ((logs[logs.length - 1] as any).args as any).deck as string[];
                } catch { /* ignore */ }
            }

            const cur = gameState.players[currentIndex];
            let isMyTurnFromContract = cur && myPlayer ? cur.address.toLowerCase() === myPlayer.address.toLowerCase() : false;
            if (isMyTurnFromContract && currentIndex > 0 && deck.length === 0) isMyTurnFromContract = false;

            setShuffleState(prev => {
                const safeIdx = Math.max(prev.currentShufflerIndex, currentIndex);
                if (prev.hasRevealed || prev.hasCommitted) return { ...prev, currentShufflerIndex: safeIdx, deck: deck.length > 0 ? deck : prev.deck };
                return { ...prev, currentShufflerIndex: safeIdx, deck, isMyTurn: isMyTurnFromContract, phaseDeadline: deadline };
            });
        } catch (e) { console.error('Sync error', e); }
    }, [publicClient, currentRoomId, gameState.players, myPlayer, isTestMode]);

    const forceSync = useCallback(async () => {
        if (!currentRoomId) return;
        setIsSyncing(true);
        try { await fetchShuffleData(); await refreshPlayersList(currentRoomId); } finally { setIsSyncing(false); }
    }, [currentRoomId, fetchShuffleData, refreshPlayersList]);

    useEffect(() => {
        if (isReveal) return;
        fetchShuffleData();
        if (!isTestMode) {
            const iv = setInterval(fetchShuffleData, 3000);
            return () => clearInterval(iv);
        }
    }, [fetchShuffleData, isTestMode, isReveal]);

    // ── Actions ──
    const handleTimeoutKick = useCallback(async () => {
        if (!currentRoomId) return;
        setIsShuffleProcessing(true);
        try {
            const hash = await writeContractAsync({
                address: runtimeContractAddress, abi: MAFIA_ABI, functionName: 'forcePhaseTimeout', args: [currentRoomId]
            });
            addLog(`Kick tx: ${hash.substring(0, 10)}...`, 'info');
        } catch { addLog('Kick failed', 'danger'); } finally { setIsShuffleProcessing(false); }
    }, [currentRoomId, writeContractAsync, addLog]);

    const handleMyTurn = useCallback(async () => {
        if (!currentRoomId || !myPlayer || isShuffleProcessing || processRef.current) return;
        processRef.current = true; setIsShuffleProcessing(true);
        try {
            const svc = getShuffleService();
            const active = gameState.players.map((p, i) => p.isAlive ? i : -1).filter(i => i !== -1);
            const roomIdStr = currentRoomId.toString();
            const verifyDeck = ShuffleService.generateInitialDeck(gameState.players.length, roomIdStr, active.length);
            if (!svc.hasKeys()) svc.generateVerifiedKeys([...new Set(verifyDeck)]);

            let newDeck = (shuffleState.currentShufflerIndex === 0)
                ? svc.encryptDeck(ShuffleService.generateDistributedDeck(gameState.players.map(p => ({ isAlive: p.isAlive })), roomIdStr))
                : svc.encryptDeck(shuffleState.deck);

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
            setShuffleState(prev => ({ ...prev, hasRevealed: true, currentShufflerIndex: prev.currentShufflerIndex + 1 }));
        } catch (e: any) {
            addLog((e?.message || 'Shuffle failed').substring(0, 120), 'danger');
            setShuffleState(prev => ({ ...prev, retryCount: prev.retryCount + 1, lastErrorTime: Date.now(), isFailed: prev.retryCount >= 2 }));
        } finally { processRef.current = false; setIsShuffleProcessing(false); }
    }, [currentRoomId, myPlayer, isShuffleProcessing, shuffleState, gameState.players, SHUFFLE_COMMIT_KEY, commitDeckOnChain, revealDeckOnChain, addLog]);

    const handleRevealRecovery = useCallback(async () => {
        if (!currentRoomId || !pendingDeck || !pendingSalt || isShuffleProcessing) return;
        setIsShuffleProcessing(true);
        try {
            await revealDeckOnChain(pendingDeck, pendingSalt);
            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setShuffleState(prev => ({ ...prev, hasRevealed: true, currentShufflerIndex: prev.currentShufflerIndex + 1 }));
        } catch (e: any) { addLog(e.message || 'Reveal failed', 'danger'); } finally { setIsShuffleProcessing(false); }
    }, [currentRoomId, pendingDeck, pendingSalt, isShuffleProcessing, revealDeckOnChain, SHUFFLE_COMMIT_KEY, addLog]);

    // ── Reveal Flow ──
    const handleRegisterEcies = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || registerInFlightRef.current) return;
        const { isNew } = await loadOrCreateKeypair(currentRoomId.toString(), address);
        if (revealState.eciesRegistered && !isNew) return;
        registerInFlightRef.current = true;
        try {
            await registerEciesPubkey(currentRoomId.toString(), address, walletClient, chainId, false);
            setRevealState(prev => ({ ...prev, eciesRegistered: true }));
        } catch { /* silent */ } finally { registerInFlightRef.current = false; }
    }, [currentRoomId, address, walletClient, chainId, revealState.eciesRegistered]);

    const handleShareKey = useCallback(async () => {
        if (!currentRoomId || !address || !walletClient || revealState.hasSharedKeys || submitInFlightRef.current) return;
        submitInFlightRef.current = true; setIsRevealProcessing(true);
        try {
            const svc = getShuffleService();
            if (!svc.hasKeys() && !svc.loadKeys(currentRoomId.toString(), address)) return;
            await submitSraKeyToGm({ roomId: currentRoomId.toString(), address, sraKey: svc.getDecryptionKey(), walletClient, chainId });
            setRevealState(prev => ({ ...prev, hasSharedKeys: true }));
        } catch { /* silent */ } finally { setIsRevealProcessing(false); submitInFlightRef.current = false; }
    }, [currentRoomId, address, walletClient, chainId, revealState.hasSharedKeys]);

    const handleFetchRole = useCallback(async () => {
        if (isTestMode || !currentRoomId || !address || !walletClient || revealState.isRevealed || !revealState.hasSharedKeys || fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        try {
            const role = await fetchMyRoleFromGm({ roomId: currentRoomId.toString(), address, walletClient, chainId });
            if (role) {
                setRevealState(prev => ({ ...prev, myRole: role, isRevealed: true }));
                setGameState(prev => ({ ...prev, players: prev.players.map(p => p.address.toLowerCase() === address.toLowerCase() ? { ...p, role } : p) }));
            }
        } catch { /* silent */ } finally { fetchInFlightRef.current = false; }
    }, [currentRoomId, address, walletClient, chainId, revealState.isRevealed, revealState.hasSharedKeys, setGameState, isTestMode]);

    const handleConfirmRole = useCallback(async () => {
        if (!revealState.myRole || !address || revealState.hasConfirmed || isRevealProcessing || isTxPending) return;
        setIsRevealProcessing(true);
        try {
            const roleMap: Record<Role, number> = { [Role.MAFIA]: 1, [Role.DOCTOR]: 2, [Role.DETECTIVE]: 3, [Role.CIVILIAN]: 4, [Role.UNKNOWN]: 0 };
            const salt = localStorage.getItem(`role_salt_${currentRoomId}_${address.toLowerCase()}`) || ShuffleService.generateSalt();
            await commitAndConfirmRoleOnChain(roleMap[revealState.myRole] || 4, salt);
            localStorage.setItem(`role_salt_${currentRoomId}_${address.toLowerCase()}`, salt);
            setRevealState(prev => ({ ...prev, hasConfirmed: true }));
        } catch (e: any) { 
            if (e.message?.toLowerCase().includes('already')) setRevealState(prev => ({ ...prev, hasConfirmed: true })); 
        } finally { setIsRevealProcessing(false); }
    }, [revealState.myRole, revealState.hasConfirmed, isRevealProcessing, isTxPending, commitAndConfirmRoleOnChain, currentRoomId, address]);

    // ── Auto-unstick & Auto-flow ──
    useEffect(() => {
        if (!gameState.phaseDeadline) return;
        const iv = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            if (now > gameState.phaseDeadline + 5 && !isShuffleProcessing && !isRevealProcessing && !isTxPending) {
                // Stagger by player index to avoid simultaneous calls, but ANY player can kick
                const sorted = [...gameState.players].filter(p => p.isAlive).sort((a,b) => a.address.localeCompare(b.address));
                const myIndex = sorted.findIndex(p => p.address.toLowerCase() === address?.toLowerCase());
                const staggerDelay = myIndex >= 0 ? myIndex * 3 : 0; // 3s between each player's attempt
                if (myIndex >= 0 && now > gameState.phaseDeadline + 5 + staggerDelay) {
                    const marker = `${currentRoomId}:${gameState.phaseDeadline}`;
                    if (autoKickMarkerRef.current !== marker) {
                        autoKickMarkerRef.current = marker;
                        handleTimeoutKick().catch(() => autoKickMarkerRef.current = '');
                    }
                }
            }
        }, 3000);
        return () => clearInterval(iv);
    }, [gameState.phaseDeadline, gameState.players, address, currentRoomId, isShuffleProcessing, isRevealProcessing, isTxPending, handleTimeoutKick]);

    useEffect(() => {
        if (!isReveal) {
            if (shuffleState.isMyTurn && !shuffleState.hasCommitted && !isShuffleProcessing && !isTxPending && !shuffleState.hasRevealed && !shuffleState.isFailed) handleMyTurn();
            if (shuffleState.isMyTurn && shuffleState.hasCommitted && !shuffleState.hasRevealed && !isShuffleProcessing && !isTxPending && pendingDeck) handleRevealRecovery();
        } else {
            if (!revealState.eciesRegistered) handleRegisterEcies();
            else if (!revealState.hasSharedKeys) handleShareKey();
            else if (!revealState.isRevealed) handleFetchRole();
            else if (!revealState.hasConfirmed) handleConfirmRole();
        }
    }, [isReveal, shuffleState.isMyTurn, shuffleState.hasCommitted, isShuffleProcessing, isTxPending, revealState, handleMyTurn, handleRevealRecovery, handleRegisterEcies, handleShareKey, handleFetchRole, handleConfirmRole]);

    // ── UI Helpers ──
    const totalPlayers = gameState.players.length;
    const progress = Math.min((shuffleState.currentShufflerIndex / Math.max(totalPlayers, 1)) * 100, 100);
    const keysCollected = gameState.players.filter(p => p.hasConfirmedRole).length;

    return (
        <div className="w-full h-[100dvh] flex flex-col items-center justify-center overflow-hidden p-4 pointer-events-auto">
            <div className="w-full max-w-[820px] bg-[#09080b] rounded-sm border border-white/5 shadow-[0_45px_100px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] bg-[#0f0e10]">
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] tracking-[0.4em] text-white/30 uppercase">CASE FILE</span>
                        <span className="text-white/10">//</span>
                        <span className="font-mono text-[11px] tracking-[0.3em] text-[#c8a84b] uppercase font-bold">ROOM_{currentRoomId?.toString() || '???'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-1.5 h-1.5 bg-[#c8a84b] rounded-full animate-pulse" />
                            <span className="font-mono text-[11px] tracking-[0.3em] text-[#c8a84b] uppercase font-semibold">{isReveal ? 'ROLE REVEAL' : 'SHUFFLE PHASE'}</span>
                        </div>
                        {isReveal ? (
                            <span className="font-mono text-[11px] tracking-[0.2em] text-white/40"><span className="text-[#c8a84b]">{keysCollected}</span>/{totalPlayers} CONFIRMED</span>
                        ) : (
                            <button onClick={forceSync} disabled={isSyncing} className="text-white/20 hover:text-[#c8a84b] transition-colors"><RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} /></button>
                        )}
                    </div>
                </div>
                <div className="flex min-h-[460px] bg-[#09080a]">
                    <div className="w-[220px] shrink-0 border-r border-white/[0.05] flex flex-col bg-[#0f0e10]/50">
                        <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
                            <span className="font-mono text-[10px] tracking-[0.3em] text-white/30 uppercase">SUSPECTS</span>
                        </div>
                        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                            {gameState.players.map((player, index) => (
                                <SuspectRow key={player.address} player={player} index={index} isReveal={isReveal} isMe={player.address.toLowerCase() === address?.toLowerCase()} shuffleState={shuffleState} />
                            ))}
                        </div>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.div key={isReveal ? 'reveal' : 'shuffle'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex">
                            {isReveal ? (
                                <RevealPanel revealState={revealState} isProcessing={isRevealProcessing} isTxPending={isTxPending} onConfirm={handleConfirmRole} allConfirmed={keysCollected >= totalPlayers} isTestMode={isTestMode} />
                            ) : (
                                <ShufflePanel shuffleState={shuffleState} progress={progress} isProcessing={isShuffleProcessing} isTxPending={isTxPending} currentShufflerName={gameState.players[shuffleState.currentShufflerIndex]?.name} totalPlayers={totalPlayers} onRetry={() => { setShuffleState(p => ({ ...p, isFailed: false, retryCount: 0 })); handleMyTurn(); }} />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
                {/* Footer removed for branding cleanup */}
            </div>
        </div>
    );
});

ShuffleAndReveal.displayName = 'ShuffleAndReveal';
