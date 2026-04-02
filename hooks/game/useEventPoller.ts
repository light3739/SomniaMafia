/**
 * useEventPoller — Smart block-based event polling.
 *
 * Architecture (after server-log migration):
 * - pollServerLogs() → fetches text logs from GM server every 2s
 *   The server (LogListener) is the SINGLE SOURCE OF TRUTH for text logs.
 *   It resolves nicknames via an in-memory cache built from PlayerJoined events.
 *   Logs have stable ids (txHash-logIndex) so addLogs() deduplicates correctly.
 *
 * - pollEvents() → reads blockchain events for REACTIVE STATE ONLY:
 *   setShowVotingResults, setVoteMap, setGameState (phase/winner/players)
 *   Does NOT call addLog() — text is handled by the server.
 *
 * - Poll interval: 2s (optimized for Somnia's 100ms blocks)
 */
import { useCallback, useRef, useEffect } from 'react';
import { pad, toHex, parseEventLogs } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';
import { GamePhase, GameState } from '../../types';
import type { GameRefs } from './useGameRefs';
import type { GameDataSync } from './useGameDataSync';
import type { LogEntry } from '../../types';
import React from 'react';
import { GM_SERVER_URL } from '../../contracts/config';

interface PollerDeps {
    refs: GameRefs;
    dataSync: GameDataSync;
    gameState: GameState;
    currentRoomId: bigint | null;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    setVoteMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setShowVotingResults: (v: boolean) => void;
    addLog: (message: string, type?: LogEntry['type'], eventType?: import('../../types').GameEventType, eventData?: import('../../types').GameEventData, id?: string) => void;
    addLogs: (logs: LogEntry[]) => void;
}

export function useEventPoller(deps: PollerDeps) {
    const { refs, dataSync, gameState, currentRoomId, setGameState, setVoteMap, setShowVotingResults, addLog, addLogs } = deps;

    const processedEventsRef = useRef<Set<string>>(new Set());
    const lastProcessedBlockRef = useRef<bigint | null>(null);
    const liveStartBlockRef = useRef<bigint | null>(null);
    const votingFinalizedTimerRef = refs.votingFinalizedTimerRef;

    // --- Poller Definition ---

    const isPollingRef = useRef(false);

    // === POLL SERVER LOGS ===
    // The server is the single source of truth for all text logs.
    // It resolves player nicknames from on-chain PlayerJoined events and stores
    // deduplicated entries with stable ids (txHash-logIndex).
    const pollServerLogs = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const chainId = refs.runtimeChain.id;
        if (!roomId || !chainId) return;

        try {
            const res = await fetch(`${GM_SERVER_URL}/logs/${roomId}?chainId=${chainId}&t=${Date.now()}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.logs && Array.isArray(data.logs)) {
                addLogs(data.logs);
            }
        } catch (e) {
            console.error("[Server Log Polling] Error:", e);
        }
    }, [refs, addLogs]);

    // === POLL EVENTS ===
    const pollEvents = useCallback(async () => {
        if (isPollingRef.current) return;
        
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        if (!pClient || !roomId || !lastProcessedBlockRef.current) return;

        isPollingRef.current = true;
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
                const blockNumber = (log as any).blockNumber;
                const isHistorical = liveStartBlockRef.current !== null && blockNumber < liveStartBlockRef.current;

                console.log(`[Event Received ${isHistorical ? '(History)' : '(Live)'}] ${eventName}`, args);

                // ─── REACTIVE STATE ONLY ────────────────────────────────────
                // Text logs are written by the GM server (LogListener) which
                // resolves nicknames from cached PlayerJoined events.
                // pollServerLogs() fetches them every 2s and deduplicates by
                // stable id (txHash-logIndex). We only update React state here.
                switch (eventName) {
                    case 'PlayerJoined':
                        // No reactive state change needed; server logs the text
                        break;

                    case 'GameStarted':
                        // Sync contract state so phase changes propagate
                        if (roomId) {
                            dataSync.fetchGameData(roomId);
                        }
                        break;

                    case 'DayStarted':
                        // State sync handled by fetchGameData after NightFinalized;
                        // no extra action needed here
                        break;

                    case 'VotingStarted':
                        // No reactive state; server writes the text log
                        break;

                    case 'NightStarted':
                        // No reactive state; server writes "Night has fallen..."
                        break;

                    case 'NightFinalized':
                        // Sync player list so isAlive flags update
                        if (roomId) await dataSync.fetchGameData(roomId);
                        break;

                    case 'PlayerEliminated':
                        // isAlive flag update handled by fetchGameData above
                        break;

                    case 'GameEnded': {
                        if (!isHistorical) {
                            const winCondition = args.winCondition as string || '';
                            const lower = winCondition.toLowerCase();
                            const gameWinner: 'MAFIA' | 'TOWN' | 'DRAW' =
                                lower.includes('town') ? 'TOWN' :
                                lower.includes('mafia') ? 'MAFIA' :
                                lower.includes('draw') ? 'DRAW' : 'TOWN';

                            console.log(`[Event] GameEnded! Winner: ${gameWinner}, condition: ${winCondition}`);
                            setGameState(prev => ({
                                ...prev,
                                phase: GamePhase.ENDED,
                                winner: gameWinner
                            }));
                        }
                        break;
                    }

                    case 'VoteCast': {
                        // Update the visual vote-map (arrows on player circles)
                        // Text log is written by the server
                        try {
                            const voterStr = (args.voter as string).toLowerCase();
                            const targetStr = (args.target as string).toLowerCase();
                            setVoteMap(prev => ({ ...prev, [voterStr]: targetStr }));
                        } catch (e) {
                            console.error("[VoteCast] Error updating voteMap:", e);
                        }
                        break;
                    }

                    case 'VotingFinalized':
                        // Show voting results overlay (reactive UI state)
                        if (!isHistorical) {
                            console.log("[VotingFinalized] Triggering results phase...");
                            setShowVotingResults(true);

                            if (votingFinalizedTimerRef.current) clearTimeout(votingFinalizedTimerRef.current);
                            votingFinalizedTimerRef.current = setTimeout(() => {
                                // "Night has fallen" text is already written by server (NightStarted event).
                                // We just close the overlay and clear vote-map.
                                setTimeout(() => {
                                    console.log("[VotingFinalized] Results phase ended. Proceeding to Night.");
                                    setShowVotingResults(false);
                                    setVoteMap({});
                                }, 3000);
                                votingFinalizedTimerRef.current = null;
                            }, 5000);
                        }
                        break;
                }
            }

            if (hasChanges && roomId) {
                dataSync.refreshPlayersListDebounced(roomId);
            }

            lastProcessedBlockRef.current = currentBlock + 1n;
        } catch (e) {
            console.error("[Smart Poller] Error:", e);
        } finally {
            isPollingRef.current = false;
        }
    }, [refs, dataSync, setGameState, setVoteMap, setShowVotingResults, votingFinalizedTimerRef]);

    // === INITIALIZATION ===
    useEffect(() => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        if (!pClient || !roomId || lastProcessedBlockRef.current) return;
        
        pClient.getBlockNumber().then((b: bigint) => {
            liveStartBlockRef.current = b;
            const historyStart = b > 10000n ? b - 10000n : 0n;
            lastProcessedBlockRef.current = historyStart;
            console.log(`[Smart Poller] 🚀 Started for Room ${roomId} @ Block ${b} (History from ${historyStart})`);
            pollEvents().then(() => {
                // После реплея — обязательно синхронизировать состояние с контрактом
                dataSync.fetchGameData(roomId);
            });
        });
    }, [refs, pollEvents, dataSync]);

    // === POLL INTERVAL ===
    useEffect(() => {
        if (!refs.publicClientRef.current || !currentRoomId) return;
        if (gameState.phase === GamePhase.ENDED && gameState.winner) return;
        const interval = setInterval(() => {
            pollEvents();
            pollServerLogs();
        }, 2000);
        return () => clearInterval(interval);
    }, [pollEvents, pollServerLogs, gameState.phase, gameState.winner, refs, currentRoomId]);

    return {
        pollEvents,
    };
}

export type EventPoller = ReturnType<typeof useEventPoller>;
