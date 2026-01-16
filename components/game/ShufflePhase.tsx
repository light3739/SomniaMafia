// components/game/ShufflePhase.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { usePublicClient, useWriteContract } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { Loader2, Check, Clock, Shuffle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface ShuffleState {
    currentShufflerIndex: number;
    deck: string[];
    isMyTurn: boolean;
    hasCommitted: boolean;
    hasRevealed: boolean;
    pendingDeck: string[] | null;
    pendingSalt: string | null;
    phaseDeadline: number; // For timeout handling
}

export const ShufflePhase: React.FC = () => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        commitDeckOnChain,
        revealDeckOnChain,
        addLog,
        isTxPending,
        refreshPlayersList
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
        phaseDeadline: 0
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Состояние для pending deck и salt (для reveal фазы)
    const [pendingDeck, setPendingDeck] = useState<string[] | null>(null);
    const [pendingSalt, setPendingSalt] = useState<string | null>(null);

    const SHUFFLE_COMMIT_KEY = `mafia_shuffle_commit_${currentRoomId}_${myPlayer?.address}`;

    // Restore state from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem(SHUFFLE_COMMIT_KEY);
        if (saved) {
            try {
                const { deck, salt, hasCommitted } = JSON.parse(saved);
                if (deck && salt) {
                    setPendingDeck(deck);
                    setPendingSalt(salt);
                    setShuffleState(prev => ({ ...prev, hasCommitted: true, isMyTurn: true }));
                }
            } catch (e) {
                console.error("Failed to recover pending deck", e);
            }
        }
    }, [SHUFFLE_COMMIT_KEY]);

    // Force Sync Function
    const forceSync = async () => {
        if (!currentRoomId) return;
        setIsSyncing(true);
        try {
            await fetchShuffleData();
            await refreshPlayersList(currentRoomId);
        } finally {
            setIsSyncing(false);
        }
    };

    // Fetch data from contract
    const fetchShuffleData = useCallback(async () => {
        if (!publicClient || !currentRoomId) return;

        try {
            const roomData = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getRoom',
                args: [currentRoomId],
            }) as any;

            const deck = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getDeck',
                args: [currentRoomId],
            }) as string[];

            // DEBUG: Log raw data to debug index alignment (0 vs 1)
            // HMR FORCE UPDATE 1
            console.log('[Shuffle Raw] RoomData:', roomData);

            // ROBUST PARSING
            let currentIndex = 0;
            let deadline = 0;
            if (Array.isArray(roomData)) {
                currentIndex = Number(roomData[8]); // index 8 is currentShufflerIndex
                deadline = Number(roomData[10]);    // index 10 is phaseDeadline
            } else if (roomData && typeof roomData === 'object') {
                currentIndex = Number(roomData.currentShufflerIndex);
                deadline = Number(roomData.phaseDeadline);
            }
            if (isNaN(currentIndex)) currentIndex = 0;

            // Check if it is my turn
            // Note: Use gameState.players to map index to address
            const currentShuffler = gameState.players[currentIndex];
            let isMyTurnFromContract = false;

            if (currentShuffler && myPlayer) {
                isMyTurnFromContract = currentShuffler.address.toLowerCase() === myPlayer.address.toLowerCase();
            }

            // CRITICAL FIX: If contract index is stuck (e.g. at 0), we CALCULATE the real index
            // by checking who has already revealed.
            let realIndex = currentIndex;

            // Optimization: Only check if we suspect lag (e.g. deck is empty but index > 0, OR index is 0 but we know P1 revealed)
            // But since contract is broken, we MUST check.
            try {
                // We check players starting from currentIndex up to end
                // We can't check everyone due to RPC limits, but let's check next 3 players
                for (let i = currentIndex; i < gameState.players.length; i++) {
                    const p = gameState.players[i];
                    if (!p) continue;

                    const commitData = await publicClient.readContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'deckCommits',
                        args: [currentRoomId, p.address],
                    }) as any; // [hash, revealed]

                    // If this player HAS revealed, then the turn belongs to the NEXT player
                    // In array return: [0] is hash, [1] is revealed boolean
                    const isRevealed = Array.isArray(commitData) ? commitData[1] : commitData.revealed;

                    if (isRevealed) {
                        console.log(`[Shuffle Fix] Player ${i} (${p.name}) has revealed. Moving index forward.`);
                        realIndex = i + 1;
                    } else {
                        // This player has NOT revealed. So it is TRULY their turn.
                        realIndex = i;
                        break;
                    }
                }
            } catch (err) {
                console.warn("[Shuffle Fix] Failed to calculate real index", err);
            }

            console.log(`[Shuffle Fix] Contract Index: ${currentIndex}, Real Index: ${realIndex}`);
            currentIndex = realIndex;

            // CRITICAL FIX: If I am Player > 0, but the deck is empty, I cannot start yet.
            // RPC hasn't synced the previous player's reveal.
            if (isMyTurnFromContract && currentIndex > 0 && deck.length === 0) {
                console.warn("My turn, but deck is empty. Waiting for sync...");
                isMyTurnFromContract = false; // Block UI until deck arrives
            }

            setShuffleState(prev => {
                // Keep local 'revealed' state to prevent flickering back to 'commit'
                if (prev.hasRevealed) {
                    // STICKY MAX: Never allow index to go backwards if we've already revealed
                    const safeIndex = Math.max(prev.currentShufflerIndex, currentIndex);
                    return { ...prev, currentShufflerIndex: safeIndex, deck };
                }
                // Keep local 'committed' state
                if (prev.hasCommitted && !prev.hasRevealed) {
                    return { ...prev, currentShufflerIndex: currentIndex, deck };
                }

                // STICKY MAX check for general case as well (optional but safer)
                const safeIndex = prev.hasRevealed ? Math.max(prev.currentShufflerIndex, currentIndex) : currentIndex;

                return {
                    ...prev,
                    currentShufflerIndex: safeIndex,
                    deck: deck,
                    isMyTurn: isMyTurnFromContract,
                    phaseDeadline: deadline
                };
            });
        } catch (error) {
            console.error("Error fetching shuffle data:", error);
        }
    }, [publicClient, currentRoomId, gameState.players, myPlayer]);

    // Handle Timeout Kick
    const { writeContractAsync } = useWriteContract();

    const handleTimeoutKick = async () => {
        if (!currentRoomId) return;
        setIsProcessing(true);
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'forcePhaseTimeout',
                args: [currentRoomId],
            });
            addLog(`Timeout kick tx sent: ${hash.substring(0, 10)}...`, 'info');
        } catch (err) {
            console.error("Kick failed", err);
            addLog("Failed to kick player", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // Polling
    useEffect(() => {
        fetchShuffleData();
        const interval = setInterval(fetchShuffleData, 3000);
        return () => clearInterval(interval);
    }, [fetchShuffleData]);

    const handleMyTurn = async () => {
        if (!currentRoomId || !myPlayer || isProcessing) return;

        setIsProcessing(true);
        try {
            const shuffleService = getShuffleService();
            shuffleService.generateKeys(); // Generate my E/D keys

            let newDeck: string[];

            if (shuffleState.currentShufflerIndex === 0) {
                // I am the host (first player) - Generate fresh deck
                if (shuffleState.deck.length > 0) {
                    console.warn("Host sees existing deck, resetting...");
                }
                addLog("Generating initial deck...", "info");
                const initialDeck = ShuffleService.generateInitialDeck(gameState.players.length);
                const shuffled = shuffleService.shuffleArray(initialDeck);
                newDeck = shuffleService.encryptDeck(shuffled);
            } else {
                // I am a subsequent player - Shuffle existing deck
                if (shuffleState.deck.length === 0) {
                    throw new Error("Deck is empty! Sync error.");
                }
                addLog("Shuffling and re-encrypting deck...", "info");
                const shuffled = shuffleService.shuffleArray(shuffleState.deck);
                newDeck = shuffleService.encryptDeck(shuffled);
            }

            const salt = ShuffleService.generateSalt();
            const deckHash = ShuffleService.createDeckCommitHash(newDeck, salt);

            addLog("Committing deck hash...", "info");
            await commitDeckOnChain(deckHash);

            localStorage.setItem(SHUFFLE_COMMIT_KEY, JSON.stringify({
                deck: newDeck,
                salt: salt,
                hasCommitted: true
            }));

            setPendingDeck(newDeck);
            setPendingSalt(salt);

            setShuffleState(prev => ({
                ...prev,
                hasCommitted: true,
                isMyTurn: true
            }));

            addLog("Commit successful! Click Reveal to complete.", "success");

        } catch (e: any) {
            console.error("Commit failed:", e);
            addLog(e.message || "Commit failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReveal = async () => {
        if (!currentRoomId || !pendingDeck || !pendingSalt || isProcessing) return;

        setIsProcessing(true);
        try {
            addLog("Revealing deck...", "info");
            await revealDeckOnChain(pendingDeck, pendingSalt);

            localStorage.removeItem(SHUFFLE_COMMIT_KEY);
            setPendingDeck(null);
            setPendingSalt(null);

            setShuffleState(prev => ({
                ...prev,
                hasRevealed: true,
                currentShufflerIndex: prev.currentShufflerIndex + 1
            }));

            addLog("Deck revealed successfully!", "success");
            setTimeout(fetchShuffleData, 1000); // Trigger immediate update

        } catch (e: any) {
            console.error("Reveal failed:", e);
            addLog(e.message || "Reveal failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    const currentShuffler = gameState.players[shuffleState.currentShufflerIndex];
    const totalPlayers = gameState.players.length;
    const progress = Math.min((shuffleState.currentShufflerIndex / totalPlayers) * 100, 100);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg w-full bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl relative"
            >
                {/* Sync Button */}
                <div className="flex items-center gap-4">
                    {/* Timeline display */}
                    <div className="text-sm text-gray-400">
                        Player {shuffleState.currentShufflerIndex + 1} of {gameState.players.length}
                    </div>

                    {/* Timeout Kick Button */}
                    {Date.now() / 1000 > shuffleState.phaseDeadline && shuffleState.phaseDeadline > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleTimeoutKick}
                            disabled={isProcessing}
                            className="animate-pulse"
                        >
                            <Clock className="w-4 h-4 mr-2" />
                            Kick Timeout
                        </Button>
                    )}

                    <Button variant="ghost" size="icon" onClick={forceSync} disabled={isSyncing}>
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>     <div className="text-center mb-8">
                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                        Shuffling Deck
                    </h2>
                    <p className="text-white/50 text-sm">
                        {shuffleState.deck.length} cards in deck • Player {shuffleState.currentShufflerIndex + 1}'s turn
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-xs text-white/40 mb-2">
                        <span>Progress</span>
                        <span>{shuffleState.currentShufflerIndex} / {totalPlayers}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-[#916A47] to-[#c9a227]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>

                <div className="space-y-2 mb-8 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {gameState.players.map((player, index) => {
                        const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();

                        // Logic: A player is "Done" if their index is less than current shuffler
                        // OR if it's me and I've revealed locally
                        let isDone = index < shuffleState.currentShufflerIndex;
                        if (isMe && shuffleState.hasRevealed) isDone = true;

                        const isCurrentTurn = index === shuffleState.currentShufflerIndex && !isDone;

                        return (
                            <motion.div
                                key={player.address}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`
                                    flex items-center justify-between p-3 rounded-xl border transition-all
                                    ${isCurrentTurn
                                        ? 'bg-[#916A47]/20 border-[#916A47]/50'
                                        : isDone
                                            ? 'bg-green-900/20 border-green-500/30'
                                            : 'bg-white/5 border-white/10'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                        ${isCurrentTurn ? 'bg-[#916A47] text-black' : isDone ? 'bg-green-600 text-white' : 'bg-white/10 text-white/40'}
                                    `}>
                                        {isDone ? <Check className="w-4 h-4" /> : index + 1}
                                    </div>
                                    <span className={`font-medium ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                        {player.name} {isMe && '(You)'}
                                    </span>
                                </div>
                                <div className="text-xs">
                                    {isDone && <span className="text-green-400">Done</span>}
                                    {isCurrentTurn && (
                                        <span className="text-[#916A47] flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Turn
                                        </span>
                                    )}
                                    {!isDone && !isCurrentTurn && <span className="text-white/30">Waiting</span>}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <AnimatePresence mode="wait">
                    {shuffleState.isMyTurn && !shuffleState.hasCommitted ? (
                        <motion.div
                            key="my-turn"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <Button
                                onClick={handleMyTurn}
                                isLoading={isProcessing || isTxPending}
                                disabled={isProcessing || isTxPending}
                                className="w-full h-14 text-lg"
                            >
                                {isProcessing ? 'Encrypting...' : 'Shuffle & Encrypt Deck'}
                            </Button>
                        </motion.div>
                    ) : shuffleState.hasCommitted && !shuffleState.hasRevealed ? (
                        <motion.div
                            key="reveal"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <Button
                                onClick={handleReveal}
                                isLoading={isProcessing || isTxPending}
                                disabled={isProcessing || isTxPending}
                                className="w-full h-14 text-lg"
                            >
                                {isProcessing ? 'Revealing...' : 'Reveal Deck'}
                            </Button>
                        </motion.div>
                    ) : shuffleState.hasRevealed ? (
                        <div className="text-center py-4">
                            <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                                <Check className="w-5 h-5" />
                                <span className="font-medium">Shuffle Complete!</span>
                            </div>
                            <p className="text-white/40 text-sm">Waiting for others...</p>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <div className="flex items-center justify-center gap-2 text-white/50 mb-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Waiting for {currentShuffler?.name || 'player'}...</span>
                            </div>
                            {shuffleState.currentShufflerIndex > 0 && shuffleState.deck.length === 0 && (
                                <p className="text-amber-500/50 text-xs mt-1">
                                    Syncing deck from previous player...
                                </p>
                            )}
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
