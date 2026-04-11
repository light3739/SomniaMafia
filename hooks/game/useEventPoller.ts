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
import { useCallback, useRef, useEffect, useMemo } from 'react';
import { pad, toHex, parseEventLogs } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';
import { GamePhase, GameState } from '../../types';
import type { GameRefs } from './useGameRefs';
import type { GameDataSync } from './useGameDataSync';
import type { LogEntry } from '../../types';
import { parseWinCondition } from '../../services/winConditionParser';
import React from 'react';
import { GM_SERVER_URL } from '../../contracts/config';
import { useGmWebSocket } from './useGmWebSocket';
import type { ServerEventType } from '../../services/gmWebSocket';

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
    handleIncomingMafiaSignal?: (sender: string, encryptedHex: string) => Promise<void>;
}

export function useEventPoller(deps: PollerDeps) {
    const { refs, dataSync, gameState, currentRoomId, setGameState, setVoteMap, setShowVotingResults, addLog, addLogs, handleIncomingMafiaSignal } = deps;

    // Helper: stable event id matching the server's format (txHash-logIndex).
    // Passing this as `id` to addLog() ensures server logs and client logs
    // deduplicate correctly — whichever arrives first wins.
    const stableId = (log: any) => `${log.transactionHash}-${log.logIndex ?? 0}`;

    const processedEventsRef = useRef<Set<string>>(new Set());
    const lastProcessedBlockRef = useRef<bigint | null>(null);
    const liveStartBlockRef = useRef<bigint | null>(null);
    const votingFinalizedTimerRef = refs.votingFinalizedTimerRef;
    const votingFinalizedInnerRef = useRef<NodeJS.Timeout | null>(null);
    const lastVotingFinalizedDayRef = useRef<string>('');

    // Helper: show voting results overlay with proper dedup + cleanup.
    // Guarded by dayCount to prevent re-triggering from stale events.
    const triggerVotingResultsOverlay = useCallback(() => {
        const currentDay = refs.dayCountRef.current;
        const dedupKey = `${refs.currentRoomIdRef.current}:${currentDay}`;
        if (lastVotingFinalizedDayRef.current === dedupKey) return; // already triggered this day+room
        lastVotingFinalizedDayRef.current = dedupKey;

        console.log('[VotingFinalized] Triggering results phase for day', currentDay);
        setShowVotingResults(true);

        // Clear both outer and inner timers before starting new sequence
        if (votingFinalizedTimerRef.current) { clearTimeout(votingFinalizedTimerRef.current); votingFinalizedTimerRef.current = null; }
        if (votingFinalizedInnerRef.current) { clearTimeout(votingFinalizedInnerRef.current); votingFinalizedInnerRef.current = null; }

        votingFinalizedTimerRef.current = setTimeout(() => {
            votingFinalizedTimerRef.current = null;
            votingFinalizedInnerRef.current = setTimeout(() => {
                votingFinalizedInnerRef.current = null;
                console.log('[VotingFinalized] Results phase ended. Proceeding to Night.');
                setShowVotingResults(false);
                setVoteMap({});
            }, 3000);
        }, 5000);
    }, [refs, setShowVotingResults, setVoteMap, votingFinalizedTimerRef]);

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
            if (currentBlock < lastProcessedBlockRef.current) {
                console.warn(`[EventPoller] Block regression: RPC returned ${currentBlock}, expected >= ${lastProcessedBlockRef.current}. Skipping cycle.`);
                return;
            }

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

                // Memory cap — clear and re-seed with current batch to prevent stale re-processing
                if (processedEventsRef.current.size > 3000) {
                    processedEventsRef.current.clear();
                    for (const prevLog of parsedLogs) {
                        processedEventsRef.current.add(`${prevLog.transactionHash}-${prevLog.logIndex}`);
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

                    case 'DayStarted': {
                        // Write a client-side day marker log immediately so GameLog
                        // can target the new day without waiting for pollServerLogs.
                        const dayNum = args.dayNumber ? Number(args.dayNumber) : 0;
                        if (dayNum > 0) {
                            addLog(
                                `Day ${dayNum} has begun.`,
                                'phase',
                                'DayStarted' as any,
                                { dayNumber: dayNum },
                                stableId(log)
                            );
                        }
                        break;
                    }

                    case 'VotingStarted':
                        // Write client-side log immediately (deduplicates with server log by stable id)
                        addLog('Voting Phase Started. Cast your votes.', 'warning', 'VOTING_STARTED' as any, {}, stableId(log));
                        break;

                    case 'NightStarted':
                        // Write client-side log immediately (deduplicates with server log by stable id)
                        addLog('Night has fallen...', 'night' as any, 'NIGHT_FALLS' as any, {}, stableId(log));
                        break;

                    case 'NightFinalized': {
                        // Sync player list so isAlive flags update
                        if (roomId) await dataSync.fetchGameData(roomId);

                        // NightFinalized is only emitted by LibGame.finalizeNight on the
                        // failsafe peaceful path (resolveNightAsGameMaster with victim==0
                        // or LobbyFacet.forcePhaseTimeout). Real mafia kills come through
                        // NightResolvedByGM (handled in the next case). Either way we
                        // surface a NIGHT_RESULT log entry so GameLog can render the
                        // morning recap on the next day.
                        const nightId = stableId(log);
                        if (args.killed && args.killed !== '0x0000000000000000000000000000000000000000') {
                            const killedStr = (args.killed as string).toLowerCase();
                            const healedStr = args.healed ? (args.healed as string).toLowerCase() : '0x00';
                            if (killedStr === healedStr) {
                                addLog('Night Result: No one died last night.', 'success', 'NIGHT_RESULT', { isSafe: true }, nightId);
                            } else {
                                const killedPlayer = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === killedStr);
                                const kname = killedPlayer?.name || (args.killed as string).slice(0, 6);
                                addLog(`Night Result: ${kname} was killed by Mafia!`, 'danger', 'NIGHT_RESULT', { isEliminated: true, playerName: kname }, nightId);
                            }
                        } else {
                            addLog('Night Result: No one died last night.', 'success', 'NIGHT_RESULT', { isSafe: true }, nightId);
                        }
                        break;
                    }

                    case 'NightResolvedByGM': {
                        // Real mafia kill path. NightFacet.resolveNightAsGameMaster emits
                        // this BEFORE transitionToDay when victim != 0. Without this case,
                        // no NIGHT_RESULT log is ever produced for kill nights and the
                        // morning recap on the next day stays empty.
                        if (roomId) await dataSync.fetchGameData(roomId);

                        const nightId = stableId(log);
                        const killed = args.killed as string | undefined;
                        if (killed && killed !== '0x0000000000000000000000000000000000000000') {
                            const killedStr = killed.toLowerCase();
                            const killedPlayer = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === killedStr);
                            const kname = killedPlayer?.name || killed.slice(0, 6);
                            addLog(`Night Result: ${kname} was killed by Mafia!`, 'danger', 'NIGHT_RESULT', { isEliminated: true, playerName: kname }, nightId);
                        } else {
                            // Defensive: GM should never call resolveNightAsGameMaster with
                            // victim==0 (it routes to finalizeNight which fires NightFinalized
                            // instead), but log a peaceful result just in case.
                            addLog('Night Result: No one died last night.', 'success', 'NIGHT_RESULT', { isSafe: true }, nightId);
                        }
                        break;
                    }

                    case 'PlayerEliminated':
                        // isAlive flag update handled by NightFinalized fetchGameData
                        break;

                    case 'GameEnded': {
                        // GameEnded is authoritative — always process it, even
                        // when the event came in via historical replay after a
                        // refresh/reconnect. Previously this was gated on
                        // !isHistorical, which left gameState.winner stuck on
                        // a proactive (and sometimes wrong) guess when the
                        // real event arrived "late" relative to liveStartBlock.
                        const winCondition = (args.winCondition as string) || '';
                        const gameWinner = parseWinCondition(winCondition, refs.playersRef.current);
                        const isPreGameAbort = gameWinner === 'ABORTED';

                        console.log(`[Event] GameEnded! Winner: ${gameWinner}, condition: "${winCondition}", historical: ${isHistorical}`);
                        setGameState(prev => {
                            // Chain truth always wins over any proactive guess.
                            if (prev.winner && prev.winner !== gameWinner) {
                                console.warn(`[Event] Overriding proactive winner ${prev.winner} → ${gameWinner} (chain authoritative)`);
                            }
                            return { ...prev, phase: GamePhase.ENDED, winner: gameWinner };
                        });

                        if (isPreGameAbort && !isHistorical) {
                            if (roomId) await dataSync.fetchGameData(roomId);
                            addLog(
                                'Game aborted before start — everyone refunded (deposit + buy-in).',
                                'warning',
                                undefined,
                                undefined,
                                stableId(log),
                            );
                        }
                        break;
                    }

                    case 'VoteCast': {
                        // Update the visual vote-map (arrows on player circles).
                        // Text log is written by the server. If server ABI doesn't have VoteCast,
                        // write a fallback client log with stable id.
                        try {
                            const voterStr = (args.voter as string).toLowerCase();
                            const targetStr = (args.target as string).toLowerCase();
                            setVoteMap(prev => ({ ...prev, [voterStr]: targetStr }));

                            // Fallback: write vote log from client in case server doesn't have VoteCast in ABI.
                            // Stable id → deduplicates with server log if server does write it.
                            const voter = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === voterStr);
                            const target = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === targetStr);
                            const voterName = voter?.name || (args.voter as string).slice(0, 6);
                            const targetName = target?.name || (args.target as string).slice(0, 6);
                            addLog(`${voterName} voted for ${targetName}`, 'info', 'PLAYER_VOTED',
                                { playerName: voterName, targetName }, stableId(log));
                        } catch (e) {
                            console.error('[VoteCast] Error:', e);
                        }
                        break;
                    }

                    case 'RoomReturnedToLobby': {
                        // Legacy event — the old kickAfkAndReturnToLobby path
                        // rewound the room back to LOBBY on pre-DAY timeout.
                        // The new abortPreGame model ENDs the room outright
                        // and emits GameEnded("Aborted pre-game") instead.
                        // Kept as a defensive no-op for historical log replay;
                        // new contracts never emit this event.
                        if (roomId) await dataSync.fetchGameData(roomId);
                        break;
                    }

                    case 'VotingFinalized': {
                        // Write result log immediately with stable id for deduplication.
                        const vfId = stableId(log);
                        if (args.eliminated !== '0x0000000000000000000000000000000000000000') {
                            const elimStr = (args.eliminated as string).toLowerCase();
                            const elimPlayer = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === elimStr);
                            const elimName = elimPlayer?.name || (args.eliminated as string).slice(0, 6);
                            addLog(`Voting Finalized: ${elimName} was eliminated!`, 'danger', 'VOTING_RESULT',
                                { isEliminated: true, playerName: elimName }, vfId);
                        } else {
                            addLog('Voting Finalized: No one was eliminated.', 'warning', 'VOTING_RESULT',
                                { isSafe: true }, vfId);
                        }

                        // Show voting results overlay (reactive UI state)
                        if (!isHistorical) {
                            triggerVotingResultsOverlay();
                        }
                        break;
                    }
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
    }, [refs, dataSync, setGameState, setVoteMap, addLog, triggerVotingResultsOverlay]);

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
            // Fetch server text logs immediately (WS only pushes new logs, not history)
            pollServerLogs();
        });
    }, [refs, pollEvents, dataSync]);

    // === WEBSOCKET EVENT HANDLERS ===
    // GM server pushes logs, phase changes, and player updates via WS.
    // When connected, we skip the polling interval entirely.
    const wsHandlers = useMemo(() => ({
        'log': (data: unknown) => {
            const log = data as LogEntry;
            if (log && log.message) {
                addLogs([log]);
            }
        },
        'phase-change': (_data: unknown) => {
            const roomId = refs.currentRoomIdRef.current;
            if (roomId) dataSync.refreshPlayersListDebounced(roomId);
        },
        'player-update': (data: unknown) => {
            const roomId = refs.currentRoomIdRef.current;
            if (roomId) dataSync.refreshPlayersListDebounced(roomId);

            // Handle VotingFinalized overlay immediately via WS push
            const d = data as { trigger?: string } | undefined;
            if (d?.trigger === 'VotingFinalized') {
                triggerVotingResultsOverlay();
            }
        },
        'night-resolved': (_data: unknown) => {
            const roomId = refs.currentRoomIdRef.current;
            if (roomId) dataSync.refreshPlayersListDebounced(roomId);
        },
        'mafia-chat': (data: unknown) => {
            const d = data as { sender?: string; encryptedData?: string } | undefined;
            if (d?.sender && d?.encryptedData && handleIncomingMafiaSignal) {
                handleIncomingMafiaSignal(d.sender, d.encryptedData);
            }
        },
    } as Partial<Record<ServerEventType, (data: unknown) => void>>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addLogs, dataSync, refs, handleIncomingMafiaSignal, triggerVotingResultsOverlay]);

    const { wsConnected } = useGmWebSocket({
        roomId: currentRoomId ? Number(currentRoomId) : null,
        chainId: refs.runtimeChain.id,
        playerAddress: refs.addressRef.current ?? null,
        handlers: wsHandlers,
    });

    // === POLL INTERVAL (fallback when WS disconnected, slow heartbeat when connected) ===
    useEffect(() => {
        if (!refs.publicClientRef.current || !currentRoomId) return;
        if (gameState.phase === GamePhase.ENDED && gameState.winner) return;

        // When WS is connected: reduced polling (5s) as safety net.
        // When WS is disconnected: fast polling (2s) as before.
        const intervalMs = wsConnected ? 5_000 : 2_000;

        const interval = setInterval(() => {
            pollEvents();
            pollServerLogs();
        }, intervalMs);
        return () => clearInterval(interval);
    }, [pollEvents, pollServerLogs, gameState.phase, gameState.winner, refs, currentRoomId, wsConnected]);

    return {
        pollEvents,
        wsConnected,
    };
}

export type EventPoller = ReturnType<typeof useEventPoller>;
