/**
 * useEventPoller — Smart block-based event polling.
 *
 * Handles:
 * - Block-scoped log fetching (chunked, max 500 blocks)
 * - Event parsing (PlayerJoined, GameStarted, DayStarted, VotingStarted,
 *   NightStarted, NightFinalized, PlayerEliminated, GameEnded, VoteCast, VotingFinalized)
 * - Deduplication via processedEvents set (with memory cap)
 * - Single debounced refresh per poll cycle
 * - Poll interval: 2s (optimized for Somnia's 100ms blocks)
 */
import { useCallback, useRef, useEffect } from 'react';
import { pad, toHex, parseEventLogs } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';
import { GamePhase, GameState, Role } from '../../types';
import type { GameRefs } from './useGameRefs';
import type { GameDataSync } from './useGameDataSync';
import type { LogEntry } from '../../types';
import React from 'react';

interface PollerDeps {
    refs: GameRefs;
    dataSync: GameDataSync;
    gameState: GameState;
    currentRoomId: bigint | null;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    setVoteMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setShowVotingResults: (v: boolean) => void;
    addLog: (message: string, type?: LogEntry['type'], eventType?: import('../../types').GameEventType, eventData?: import('../../types').GameEventData) => void;
}

export function useEventPoller(deps: PollerDeps) {
    const { refs, dataSync, gameState, currentRoomId, setGameState, setVoteMap, setShowVotingResults, addLog } = deps;

    const processedEventsRef = useRef<Set<string>>(new Set());
    const lastProcessedBlockRef = useRef<bigint | null>(null);
    const votingFinalizedTimerRef = refs.votingFinalizedTimerRef;

    // Initial block fetch
    useEffect(() => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        if (!pClient || !roomId || lastProcessedBlockRef.current) return;
        pClient.getBlockNumber().then((b: bigint) => {
            lastProcessedBlockRef.current = b;
            console.log(`[Smart Poller] 🚀 Started for Room ${roomId} @ Block ${b}`);
        });
    }, [refs]);

    // === POLL EVENTS ===
    const pollEvents = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        if (!pClient || !roomId || !lastProcessedBlockRef.current) return;

        try {
            const currentBlock = await pClient.getBlockNumber();
            if (currentBlock < lastProcessedBlockRef.current) return;

            const roomIdTopic = pad(toHex(roomId), { size: 32 });
            const MAX_BLOCK_RANGE = 500n;
            let allRawLogs: any[] = [];
            let chunkFrom = lastProcessedBlockRef.current!;

            while (chunkFrom <= currentBlock) {
                const chunkTo = chunkFrom + MAX_BLOCK_RANGE > currentBlock
                    ? currentBlock
                    : chunkFrom + MAX_BLOCK_RANGE;

                const chunk = await pClient.getLogs({
                    address: refs.contractAddressRef.current,
                    topics: [null, roomIdTopic],
                    fromBlock: chunkFrom,
                    toBlock: chunkTo
                } as any);

                allRawLogs = [...allRawLogs, ...chunk];
                chunkFrom = chunkTo + 1n;
            }

            const parsedLogs = parseEventLogs({ abi: MAFIA_ABI, logs: allRawLogs });

            let hasChanges = false;
            for (const log of parsedLogs) {
                const txHash = log.transactionHash;
                const logId = `${txHash}-${log.logIndex}`;

                if (processedEventsRef.current.has(logId)) continue;

                // Memory cap
                if (processedEventsRef.current.size > 2000) {
                    const iterator = processedEventsRef.current.values();
                    for (let i = 0; i < 500; i++) {
                        const val = iterator.next().value;
                        if (val !== undefined) processedEventsRef.current.delete(val);
                    }
                }

                processedEventsRef.current.add(logId);
                hasChanges = true;

                const eventName = (log as any).eventName;
                const args = (log as any).args;
                console.log(`[Event Received] ${eventName}`, args);

                switch (eventName) {
                    case 'PlayerJoined':
                        break;

                    case 'GameStarted':
                        addLog("Game has started!", "phase");
                        if (roomId) {
                            dataSync.fetchGameData(roomId);
                        }
                        break;

                    case 'DayStarted':
                        addLog(`Day ${args.dayNumber} has begun`, "phase");
                        break;

                    case 'VotingStarted':
                        addLog("Voting Phase Started", "phase", 'VOTING_STARTED');
                        break;

                    case 'NightStarted':
                        break;

                    case 'NightFinalized':
                        if (args.killed && args.killed !== '0x0000000000000000000000000000000000000000') {
                            const killedStr = (args.killed as string).toLowerCase();
                            const healedStr = args.healed ? (args.healed as string).toLowerCase() : '0x00';

                            if (killedStr === healedStr) {
                                addLog("Night Result: No one died last night.", "success", 'NIGHT_RESULT', { isSafe: true });
                            } else {
                                let killedPlayer = refs.playersRef.current.find(p => p.address.toLowerCase() === killedStr);
                                if (!killedPlayer) {
                                    console.warn("[NightFinalized] Killed player missing locally. Will refresh.");
                                }
                                const name = killedPlayer?.name || args.killed.slice(0, 6);
                                addLog(`Night Result: ${name} was killed by Mafia!`, "danger", 'NIGHT_RESULT', { isEliminated: true, playerName: name });
                            }
                        } else {
                            addLog("Night Result: No one died last night.", "success", 'NIGHT_RESULT', { isSafe: true });
                        }
                        break;

                    case 'PlayerEliminated': {
                        const elimStr = (args.player as string).toLowerCase();
                        const elimPlayer = refs.playersRef.current.find(p => p.address.toLowerCase() === elimStr);
                        const elimName = elimPlayer?.name || args.player?.slice(0, 6) || "Unknown";
                        if (args.reason !== 'Killed at night') {
                            addLog(`${elimName} eliminated: ${args.reason}`, "danger");
                        }
                        break;
                    }

                    case 'GameEnded': {
                        const winCondition = args.winCondition as string || '';
                        const lower = winCondition.toLowerCase();

                        const gameWinner: 'MAFIA' | 'TOWN' | 'DRAW' =
                            lower.includes('town') ? 'TOWN' :
                                lower.includes('mafia') ? 'MAFIA' :
                                    lower.includes('draw') ? 'DRAW' :
                                        'TOWN';

                        console.log(`[Event] GameEnded! Winner: ${gameWinner}, condition: ${winCondition}`);
                        addLog(`Game Over! ${gameWinner === 'MAFIA' ? '🔪 Mafia wins!' : '🏘️ Town wins!'}`, 'phase');
                        setGameState(prev => ({
                            ...prev,
                            phase: GamePhase.ENDED,
                            winner: gameWinner
                        }));
                        break;
                    }

                    case 'VoteCast':
                        try {
                            const voterStr = (args.voter as string).toLowerCase();
                            const targetStr = (args.target as string).toLowerCase();
                            const voter = refs.playersRef.current.find(p => p.address.toLowerCase() === voterStr);
                            const target = refs.playersRef.current.find(p => p.address.toLowerCase() === targetStr);
                            const voterName = voter?.name || args.voter.slice(0, 6);
                            const targetName = target?.name || args.target.slice(0, 6);

                            addLog(`${voterName} voted for ${targetName}`, "info", 'PLAYER_VOTED', { playerName: voterName, targetName });
                            setVoteMap(prev => ({ ...prev, [voterStr]: targetStr }));
                        } catch (e) {
                            console.error("[VoteCast] Error logging:", e);
                        }
                        break;

                    case 'VotingFinalized':
                        if (args.eliminated !== '0x0000000000000000000000000000000000000000') {
                            const elimStr = (args.eliminated as string).toLowerCase();
                            const elimPlayer = refs.playersRef.current.find(p => p.address.toLowerCase() === elimStr);
                            const elimName = elimPlayer?.name || (args.eliminated as string).slice(0, 6) || "Unknown";
                            addLog(`Voting Finalized: ${elimName} was eliminated!`, "danger", 'VOTING_RESULT', { isEliminated: true, playerName: elimName });
                        } else {
                            addLog(`Voting Finalized: No one was eliminated.`, "warning", 'VOTING_RESULT', { isSafe: true });
                        }

                        console.log("[VotingFinalized] Triggering 10s results phase...");
                        setShowVotingResults(true);

                        if (votingFinalizedTimerRef.current) clearTimeout(votingFinalizedTimerRef.current);
                        votingFinalizedTimerRef.current = setTimeout(() => {
                            console.log("[VotingFinalized] Results phase ended. Proceeding to Night.");
                            setShowVotingResults(false);
                            addLog("Night has fallen...", "night", 'NIGHT_FALLS');
                            setVoteMap({});
                            votingFinalizedTimerRef.current = null;
                        }, 10000);

                        break;
                }
            }

            if (hasChanges && roomId) {
                dataSync.refreshPlayersListDebounced(roomId);
            }

            lastProcessedBlockRef.current = currentBlock + 1n;
        } catch (e) {
            console.error("[Smart Poller] Error:", e);
        }
    }, [refs, dataSync, setGameState, setVoteMap, setShowVotingResults, addLog, votingFinalizedTimerRef]);

    // === POLL INTERVAL ===
    useEffect(() => {
        if (!refs.publicClientRef.current || !currentRoomId) return;
        // Only stop if game ENDED AND winner confirmed
        if (gameState.phase === GamePhase.ENDED && gameState.winner) return;

        const interval = setInterval(pollEvents, 2000);
        return () => clearInterval(interval);
    }, [pollEvents, gameState.phase, gameState.winner, refs, currentRoomId]);

    return {
        pollEvents,
    };
}

export type EventPoller = ReturnType<typeof useEventPoller>;
