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
import { gmWs } from '../../services/gmWebSocket';
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
    const lastVotingResultLogIdRef = useRef<string>('');

    // Helper: show voting results overlay.
    // Dedup (same log ID) is handled by each caller before invoking this.
    const triggerVotingResultsOverlay = useCallback(() => {
        // Block stale triggers during terminal/pre-game phases.
        // NIGHT is intentionally NOT blocked: on Somnia with 100ms blocks,
        // NightStarted fires in the same tx as VotingFinalized. By the time the
        // VOTING_RESULT WS log arrives, fetchGameData may have already read NIGHT
        // and updated phaseRef. Blocking on NIGHT would prevent the overlay from
        // ever showing. Dedup by log ID (in each caller) prevents re-delivery.
        const currentPhase = refs.phaseRef.current;
        if (
            currentPhase === GamePhase.ENDED ||
            currentPhase === GamePhase.LOBBY ||
            currentPhase === GamePhase.SHUFFLING ||
            currentPhase === GamePhase.REVEAL
        ) {
            console.log('[VotingFinalized] Skipping overlay — already in phase', currentPhase);
            return;
        }

        console.log('[VotingFinalized] Triggering results phase (phase:', currentPhase, ')');
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
    const BLOCK_REGRESSION_TOLERANCE = 5n;

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
                const regression = lastProcessedBlockRef.current - currentBlock;
                if (regression <= BLOCK_REGRESSION_TOLERANCE) {
                    // Common RPC load balancer lag (different nodes diverging by 1-5 blocks).
                    // Reset ref to currentBlock so this cycle scans from there forward;
                    // the prior cycle already processed everything above currentBlock.
                    // processedEventsRef deduplicates any overlap if the node catches up mid-cycle.
                    console.warn(`[EventPoller] Block regression by ${regression} block(s), continuing from ${currentBlock}.`);
                    lastProcessedBlockRef.current = currentBlock;
                } else {
                    // Large regression — potential reorg or major RPC issue. Skip cycle.
                    console.warn(`[EventPoller] Block regression: RPC returned ${currentBlock}, expected >= ${lastProcessedBlockRef.current}. Skipping cycle.`);
                    return;
                }
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
                        // Clear stale logs from previous game in the same room.
                        // Server Redis stores all logs for a room across games;
                        // pollServerLogs fetches them all. Without this clear,
                        // previous game's DayStarted/VoteCast/etc. persist in
                        // gameState.logs and pollute the new game's GameLog.
                        if (!isHistorical) {
                            setGameState(prev => ({ ...prev, logs: [] }));
                        }
                        break;

                    case 'DayStarted': {
                        // Write a client-side day marker log immediately so GameLog
                        // can target the new day without waiting for pollServerLogs.
                        // Only for LIVE events — historical logs from previous games
                        // in the same room would get current timestamps and pollute
                        // the log array. Server logs via pollServerLogs are authoritative
                        // for historical events.
                        const dayNum = args.dayNumber ? Number(args.dayNumber) : 0;
                        if (dayNum > 0 && !isHistorical) {
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
                        if (!isHistorical) {
                            addLog('Voting Phase Started. Cast your votes.', 'warning', 'VOTING_STARTED' as any, {}, stableId(log));
                        }
                        break;

                    case 'NightStarted':
                        if (!isHistorical) {
                            addLog('Night has fallen...', 'night' as any, 'NIGHT_FALLS' as any, {}, stableId(log));
                        }
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
                        if (!isHistorical) {
                            const nightId = stableId(log);
                            if (args.killed && args.killed !== '0x0000000000000000000000000000000000000000') {
                                const killedStr = (args.killed as string).toLowerCase();
                                const healedStr = args.healed ? (args.healed as string).toLowerCase() : '0x00';
                                if (killedStr === healedStr) {
                                    addLog('Night Result: No one died last night.', 'success', 'NIGHT_RESULT', { isSafe: true }, nightId);
                                } else {
                                    const killedPlayer = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === killedStr);
                                    const kname = killedPlayer?.name || `${(args.killed as string).slice(0, 6)}...`;
                                    addLog(`Night Result: ${kname} was killed by Mafia!`, 'danger', 'NIGHT_RESULT',
                                        { isEliminated: true, playerName: kname, playerAddress: killedStr }, nightId);
                                }
                            } else {
                                addLog('Night Result: No one died last night.', 'success', 'NIGHT_RESULT', { isSafe: true }, nightId);
                            }
                        }
                        break;
                    }

                    case 'NightResolvedByGM': {
                        // Real mafia kill path. NightFacet.resolveNightAsGameMaster emits
                        // this BEFORE transitionToDay when victim != 0. Without this case,
                        // no NIGHT_RESULT log is ever produced for kill nights and the
                        // morning recap on the next day stays empty.
                        if (roomId) await dataSync.fetchGameData(roomId);

                        if (!isHistorical) {
                            const nightId = stableId(log);
                            const killed = args.killed as string | undefined;
                            if (killed && killed !== '0x0000000000000000000000000000000000000000') {
                                const killedStr = killed.toLowerCase();
                                const killedPlayer = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === killedStr);
                                const kname = killedPlayer?.name || `${killed.slice(0, 6)}...`;
                                addLog(`Night Result: ${kname} was killed by Mafia!`, 'danger', 'NIGHT_RESULT',
                                    { isEliminated: true, playerName: kname, playerAddress: killedStr }, nightId);
                            } else {
                                addLog('Night Result: No one died last night.', 'success', 'NIGHT_RESULT', { isSafe: true }, nightId);
                            }
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
                        // Reactive state — always process, even historical.
                        try {
                            const voterStr = (args.voter as string).toLowerCase();
                            const targetStr = (args.target as string).toLowerCase();
                            setVoteMap(prev => ({ ...prev, [voterStr]: targetStr }));

                            // Write vote log only for live events. Historical votes
                            // come from pollServerLogs with correct timestamps.
                            if (!isHistorical) {
                                const voter = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === voterStr);
                                const target = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === targetStr);
                                const voterName = voter?.name || `${(args.voter as string).slice(0, 6)}...`;
                                const targetName = target?.name || `${(args.target as string).slice(0, 6)}...`;
                                addLog(`${voterName} voted for ${targetName}`, 'info', 'PLAYER_VOTED',
                                    { playerName: voterName, targetName, voterAddress: voterStr, targetAddress: targetStr }, stableId(log));
                            }
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
                        // Write result log only for live events.
                        if (!isHistorical) {
                            if (args.eliminated !== '0x0000000000000000000000000000000000000000') {
                                const elimStr = (args.eliminated as string).toLowerCase();
                                const elimPlayer = refs.playersRef.current.find((p: any) => p.address.toLowerCase() === elimStr);
                                const elimName = elimPlayer?.name || `${(args.eliminated as string).slice(0, 6)}...`;
                                addLog(`Voting Finalized: ${elimName} was eliminated!`, 'danger', 'VOTING_RESULT',
                                    { isEliminated: true, playerName: elimName, playerAddress: elimStr }, vfId);
                            } else {
                                addLog('Voting Finalized: No one was eliminated.', 'warning', 'VOTING_RESULT',
                                    { isSafe: true }, vfId);
                            }
                        }

                        // Show voting results overlay (reactive UI state).
                        // Dedup by log ID: the same VotingFinalized event can arrive
                        // via both the blockchain handler (here) and the WS 'log'
                        // handler. The first one to fire sets lastVotingResultLogIdRef
                        // and triggers the overlay; the second is blocked.
                        if (!isHistorical && vfId !== lastVotingResultLogIdRef.current) {
                            lastVotingResultLogIdRef.current = vfId;
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

    // === WS RECONNECT: fetch missed logs immediately ===
    // gmWs.onStateChange fires with 'connected' only after the server confirms
    // the 'joined' handshake — safe to fetch logs at this point.
    // useGameDataSync handles game state refresh on reconnect, but
    // pollServerLogs is not called there — leaving up to 5s before the next
    // scheduled poll fills the log gap.
    useEffect(() => {
        const unsub = gmWs.onStateChange((state) => {
            if (state === 'connected') {
                console.log('[EventPoller] WS connected — fetching missed server logs immediately');
                pollServerLogs();
            }
        });
        return unsub;
    }, [pollServerLogs]);

    // === WEBSOCKET EVENT HANDLERS ===
    // GM server pushes logs, phase changes, and player updates via WS.
    // When connected, we skip the polling interval entirely.
    const wsHandlers = useMemo(() => ({
        'log': (data: unknown) => {
            const log = data as LogEntry;
            if (log && log.message) {
                addLogs([log]);
            }
            // Update vote arrows immediately from WS server log.
            // The GM server includes voterAddress + targetAddress in PLAYER_VOTED
            // eventData and pushes this log via WS as soon as VoteCast fires on-chain.
            // This makes vote arrows appear via WS rather than waiting for pollEvents
            // (which runs every 5s when WS connected and can be delayed by block regression).
            if (
                log?.eventType === 'PLAYER_VOTED' &&
                log.eventData?.voterAddress &&
                log.eventData?.targetAddress
            ) {
                const voter = (log.eventData.voterAddress as string).toLowerCase();
                const target = (log.eventData.targetAddress as string).toLowerCase();
                setVoteMap(prev => ({ ...prev, [voter]: target }));
            }
            // Trigger voting results overlay from the VotingFinalized LOG arrival
            // rather than from the 'player-update' event. This guarantees all
            // preceding VoteCast 'log' messages have already been received (WS is
            // ordered) and their addLogs calls are batched with this one by React,
            // so gameState.logs contains every vote when the overlay first renders.
            // Dedup by log ID: watchContractEvent re-deliveries or parallel server
            // instances can re-broadcast the same log — ignore exact duplicates.
            if (log?.eventType === 'VOTING_RESULT' && log.id && log.id !== lastVotingResultLogIdRef.current) {
                lastVotingResultLogIdRef.current = log.id;
                triggerVotingResultsOverlay();
            }
        },
        'phase-change': (_data: unknown) => {
            const roomId = refs.currentRoomIdRef.current;
            if (roomId) dataSync.refreshPlayersListDebounced(roomId);
            // Server sends 'log' (DayStarted) BEFORE 'phase-change' (see
            // logListener.ts:274 vs 284). But if the 'log' event was missed
            // or delayed, fetchGameData from the debounced refresh will read
            // dayCount=N+1 before DayStarted(N+1) log arrives — causing a
            // brief targetDay mismatch. Fetching server logs immediately on
            // phase-change closes this gap.
            pollServerLogs();
        },
        'player-update': (data: unknown) => {
            const roomId = refs.currentRoomIdRef.current;
            if (roomId) dataSync.refreshPlayersListDebounced(roomId);
            // VotingFinalized overlay is now triggered from the 'log' handler
            // (see above) to guarantee all VoteCast logs are in state first.
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
    [addLogs, dataSync, refs, handleIncomingMafiaSignal, triggerVotingResultsOverlay, setVoteMap]);

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
