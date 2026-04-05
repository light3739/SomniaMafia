/**
 * useGameDataSync — Game data fetching, player list refresh, debouncing.
 *
 * Handles:
 * - Multicall data fetching (getPlayers + getRoom + getMafiaConsensus)
 * - Player state mapping (flags -> booleans)
 * - Role restoration from localStorage
 * - Avatar syncing (server + cache)
 * - Win condition checking
 * - Debounced refresh to prevent RPC spam
 * - Continuous polling interval
 */
import { useCallback, useRef, useEffect, useMemo } from 'react';
import { MAFIA_ABI } from '../../contracts/config';
import { GamePhase, GameState, Player, Role } from '../../types';
import type { GameRefs } from './useGameRefs';
import React from 'react';

interface DataSyncDeps {
    refs: GameRefs;
    isTestMode: boolean;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    avatarUrl: string | null;
    currentRoomId: bigint | null;
}

export function useGameDataSync(deps: DataSyncDeps) {
    const { refs, isTestMode, setGameState, avatarUrl, currentRoomId } = deps;

    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const refreshPromiseRef = useRef<Promise<any> | null>(null);
    const lastRefreshTimeRef = useRef<number>(0);
    const refreshInProgressRef = useRef(false);

    // === WIN CONDITION CHECK ===
    const checkWinCondition = useCallback((players: Player[], contractPhase: GamePhase): 'MAFIA' | 'TOWN' | 'DRAW' | null => {
        if (contractPhase < GamePhase.DAY) return null;

        const alivePlayers = players.filter(p => p.isAlive);
        if (alivePlayers.length === 0) return 'DRAW';

        let aliveMafia = 0;
        let aliveTown = 0;
        let unknownRoles = 0;

        for (const player of alivePlayers) {
            if (player.role === Role.MAFIA) aliveMafia++;
            else if (player.role === Role.UNKNOWN) unknownRoles++;
            else aliveTown++;
        }

        if (unknownRoles > 0) return null;
        if (aliveMafia > 0 && aliveMafia >= aliveTown) return 'MAFIA';
        if (aliveMafia === 0) return 'TOWN';

        return null;
    }, []);

    // === FETCH GAME DATA (raw, no state update) ===
    const fetchGameData = useCallback(async (roomId: bigint) => {
        if (isTestMode || !refs.publicClientRef.current) return null;
        try {
            console.log(`[FetchGameData] Fetching room ${roomId} from ${refs.contractAddressRef.current} on chain ${refs.runtimeChainRef.current.id}`);

            const results = await refs.publicClientRef.current.multicall({
                contracts: [
                    {
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'getPlayers',
                        args: [roomId],
                    },
                    {
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'getRoom',
                        args: [roomId],
                    },
                    {
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'getMafiaConsensus',
                        args: [roomId],
                    },
                ],
                allowFailure: true,
            }); // Default blockTag is 'latest' which is safer for fast testnets

            const playersResult = results[0].status === 'success' ? results[0].result as any[] : [];
            const roomResult = results[1].status === 'success' ? results[1].result : null;
            const mafiaResult = results[2].status === 'success' ? results[2].result as [number, number, string] : [0, 0, '0x0000000000000000000000000000000000000000'];

            if (results[0].status === 'failure') {
                console.error(`[FetchGameData] getPlayers failed on chain ${refs.runtimeChainRef.current.id}:`, results[0].error);
            }
            if (results[1].status === 'failure') {
                console.error(`[FetchGameData] getRoom failed on chain ${refs.runtimeChainRef.current.id}:`, results[1].error);
                return null;
            }

            const data = playersResult;
            const roomData = roomResult as any;
            
            if (!roomData || (Array.isArray(roomData) && roomData[0] === 0n)) {
                console.warn(`[FetchGameData] Room ${roomId} not found or uninitialized on chain ${refs.runtimeChainRef.current.id}`);
                return null;
            }
            const [mafiaCommitted, mafiaRevealed] = mafiaResult;

            let phase: GamePhase, dayCount: number, aliveCount: number;
            let committedCount: number, revealedCount: number, phaseDeadline: number, maxPlayers: number;
            let tournamentId: bigint = 0n;

            if (Array.isArray(roomData)) {
                phase = Number(roomData[3]) as GamePhase;
                aliveCount = Number(roomData[6]);
                dayCount = Number(roomData[7]);
                committedCount = Number(roomData[13]);
                revealedCount = Number(roomData[14]);
                phaseDeadline = Number(roomData[10]);
                maxPlayers = Number(roomData[4]);
                tournamentId = BigInt(roomData[19] || 0);
            } else {
                phase = Number(roomData.phase) as GamePhase;
                dayCount = Number(roomData.dayCount);
                aliveCount = Number(roomData.aliveCount);
                committedCount = Number(roomData.committedCount);
                revealedCount = Number(roomData.revealedCount);
                phaseDeadline = Number(roomData.phaseDeadline);
                maxPlayers = Number(roomData.maxPlayers);
                tournamentId = BigInt(roomData.tournamentId || 0);
            }

            return {
                rawPlayers: data,
                phase, dayCount, aliveCount, committedCount, revealedCount,
                phaseDeadline,
                mafiaCommittedCount: Number(mafiaCommitted),
                mafiaRevealedCount: Number(mafiaRevealed),
                tournamentId, maxPlayers,
            };
        } catch (e: any) {
            console.error("[FetchGameData] Error:", e);
            return null;
        }
    }, [isTestMode, refs]);

    // === REFRESH PLAYERS LIST ===
    const refreshPlayersList = useCallback(async (roomId: bigint) => {
        if (refreshInProgressRef.current) return;
        refreshInProgressRef.current = true;
        try {
            const gameData = await fetchGameData(roomId);
            if (!gameData) return;

            // Guard: if currentRoomId changed while we were fetching, discard stale data
            if (currentRoomId !== null && roomId !== currentRoomId) {
                console.warn(`[refreshPlayersList] Discarding stale data for room ${roomId} (current: ${currentRoomId})`);
                return;
            }

            const {
                rawPlayers, phase, dayCount, revealedCount,
                mafiaCommittedCount, mafiaRevealedCount, phaseDeadline,
                tournamentId, aliveCount, maxPlayers
            } = gameData;

            console.log('[DEBUG refreshPlayersList] rawPlayers count:', rawPlayers.length, 'wallets:', rawPlayers.map((p: any) => p.wallet));

            if ((!rawPlayers || rawPlayers.length === 0) && phase === GamePhase.LOBBY) {
                console.warn('[refreshPlayersList] skipping update because rawPlayers is empty (RPC lag?)');
                return;
            }

            const phaseKey = `${phase}:${dayCount}`;
            if (refs.lastPhaseKeyRef.current !== phaseKey) {
                console.log('[Phase Sync]', { contractPhase: phase, phaseName: GamePhase[phase], dayCount });
                refs.lastPhaseKeyRef.current = phaseKey;
            }

            // Fetch remote avatars
            let remoteAvatars: Record<string, string> = {};
            const isLobby = refs.phaseRef.current === GamePhase.LOBBY;
            const hasCache = Object.keys(refs.avatarCacheRef.current).length > 0;

            if (isLobby || !hasCache) {
                try {
                    const avatarRes = await fetch(`/api/game/avatar?roomId=${roomId.toString()}&chainId=${refs.runtimeChainRef.current.id}`);
                    if (avatarRes.ok) {
                        const data = await avatarRes.json();
                        remoteAvatars = data.avatars || {};
                        refs.avatarCacheRef.current = remoteAvatars;
                    } else {
                        remoteAvatars = refs.avatarCacheRef.current;
                    }
                } catch (e) {
                    console.warn('[Avatar Sync] Failed to fetch avatars:', e);
                    remoteAvatars = refs.avatarCacheRef.current;
                }
            } else {
                remoteAvatars = refs.avatarCacheRef.current;
            }

            setGameState(prev => {
                const existingRoles = new Map<string, Role>();
                prev.players.forEach(p => {
                    if (p.role !== Role.UNKNOWN) {
                        existingRoles.set(p.address.toLowerCase(), p.role);
                    }
                });

                const FLAG_CONFIRMED_ROLE = 1;
                const FLAG_ACTIVE = 2;
                const FLAG_HAS_VOTED = 4;
                const FLAG_HAS_COMMITTED = 8;
                const FLAG_HAS_REVEALED = 16;
                const FLAG_DECK_COMMITTED = 64;

                const formattedPlayers: Player[] = rawPlayers.length === 0 ? prev.players : rawPlayers.map((p: any) => {
                    const flags = Number(p.flags);
                    const existingPlayer = prev.players.find(
                        ep => ep.address.toLowerCase() === p.wallet.toLowerCase()
                    );
                    const isMe = p.wallet.toLowerCase() === refs.addressRef.current?.toLowerCase();

                    const playerAvatar =
                        remoteAvatars[p.wallet.toLowerCase()] ||
                        existingPlayer?.avatarUrl ||
                        (isMe && avatarUrl) ||
                        `https://picsum.photos/seed/${p.wallet}/200`;

                    let resolvedRole = existingRoles.get(p.wallet.toLowerCase()) || Role.UNKNOWN;

                    if (isMe && resolvedRole === Role.UNKNOWN && refs.addressRef.current) {
                        const savedRole = localStorage.getItem(`my_role_${roomId}_${refs.addressRef.current.toLowerCase()}`);
                        if (savedRole && Object.values(Role).includes(savedRole as Role)) {
                            resolvedRole = savedRole as Role;
                        }
                    }

                    return {
                        id: p.wallet,
                        name: p.nickname,
                        address: p.wallet,
                        role: resolvedRole,
                        isAlive: (flags & FLAG_ACTIVE) !== 0,
                        hasConfirmedRole: (flags & FLAG_CONFIRMED_ROLE) !== 0,
                        hasDeckCommitted: (flags & FLAG_DECK_COMMITTED) !== 0,
                        hasVoted: (flags & FLAG_HAS_VOTED) !== 0,
                        hasNightCommitted: (flags & FLAG_HAS_COMMITTED) !== 0,
                        hasNightRevealed: (flags & FLAG_HAS_REVEALED) !== 0,
                        avatarUrl: playerAvatar,
                        votesReceived: Number(p.votesReceived || 0),
                        status: (flags & FLAG_ACTIVE) !== 0 ? 'connected' : 'slashed'
                    };
                });

                // In LOBBY phase, filter out players who forfeited (FLAG_ACTIVE cleared)
                // In active game phases, keep them visible (shown as eliminated)
                const visiblePlayers = phase === GamePhase.LOBBY
                    ? formattedPlayers.filter(p => p.isAlive)
                    : formattedPlayers;

                console.log('[DEBUG setGameState] prev.players:', prev.players.length, 'formattedPlayers:', visiblePlayers.length, visiblePlayers.map(p => p.address));

                const winner = checkWinCondition(formattedPlayers, phase);
                let finalPhase = phase;
                let resolvedWinner: 'MAFIA' | 'TOWN' | 'DRAW' | null = winner;

                if (winner && phase !== GamePhase.ENDED) {
                    console.log('[Win Condition Calculated Local]', winner);
                    finalPhase = GamePhase.ENDED;
                }
                
                if (prev.phase === GamePhase.ENDED) {
                    finalPhase = GamePhase.ENDED;
                }

                if (phase === GamePhase.ENDED && !resolvedWinner) {
                    if (prev.winner) {
                        resolvedWinner = prev.winner;
                    }
                }

                return {
                    ...prev,
                    players: visiblePlayers,
                    phase: finalPhase,
                    dayCount,
                    revealedCount,
                    mafiaCommittedCount,
                    mafiaRevealedCount,
                    phaseDeadline,
                    aliveCount,
                    tournamentId,
                    isTournament: tournamentId > 0n,
                    maxPlayers,
                    winner: prev.winner || resolvedWinner
                };
            });
            return gameData;
        } finally {
            refreshInProgressRef.current = false;
        }
    }, [fetchGameData, checkWinCondition, refs, setGameState, avatarUrl]);

    // === DEBOUNCED REFRESH ===
    const refreshPlayersListDebounced = useCallback((roomId: bigint) => {
        if (refreshPromiseRef.current) return;
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
        const MIN_INTERVAL = 2000;

        const delay = timeSinceLastRefresh < MIN_INTERVAL
            ? MIN_INTERVAL - timeSinceLastRefresh
            : 300;

        refreshTimerRef.current = setTimeout(() => {
            refreshTimerRef.current = null;
            lastRefreshTimeRef.current = Date.now();

            const promise = refreshPlayersList(roomId).finally(() => {
                refreshPromiseRef.current = null;
            });
            refreshPromiseRef.current = promise;
        }, delay);
    }, [refreshPlayersList]);

    // === CONTINUOUS POLLING ===
    useEffect(() => {
        if (!currentRoomId || isTestMode || !refs.publicClientRef.current) return;

        refreshPlayersListDebounced(currentRoomId);

        const interval = setInterval(() => {
            refreshPlayersListDebounced(currentRoomId);
        }, 3000);
        return () => clearInterval(interval);
    }, [isTestMode, refreshPlayersListDebounced, refs, currentRoomId]);

    return {
        fetchGameData,
        refreshPlayersList,
        refreshPlayersListDebounced,
        checkWinCondition,
    };
}

export type GameDataSync = ReturnType<typeof useGameDataSync>;
