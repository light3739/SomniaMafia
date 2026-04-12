"use client";

/**
 * GameContext — Slim orchestrator.
 *
 * Composes 13 domain-specific hooks into a single React context.
 * All game logic has been extracted into hooks/game/*.ts
 *
 * Architecture:
 *   Level 0: useGameRefs (shared mutable refs)
 *   Level 1: useWalletManager, useTransactionEngine
 *   Level 2: useGameDataSync
 *   Level 3: useLobbyActions, useShuffleActions, useRoleActions,
 *            useVotingActions, useNightActions, useMafiaChat,
 *            useTournaments, useEndGame
 *   Level 4: useEventPoller
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { GamePhase, GameState, Player, Role, LogEntry, type GameEventType, type GameEventData } from '../types';
import type { GameContextType, DiscussionState } from './gameContext.types';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { resetShuffleService } from '../services/shuffleService';

import {
    useGameRefs,
    useWalletManager,
    useTransactionEngine,
    useGameDataSync,
    useLobbyActions,
    useShuffleActions,
    useRoleActions,
    useVotingActions,
    useNightActions,
    useMafiaChat,
    useTournaments,
    useEndGame,
    useEventPoller,
    useRefundClaims,
} from '../hooks/game';

const GameContext = createContext<GameContextType | undefined>(undefined);

const INITIAL_GAME_STATE: GameState = {
    phase: GamePhase.LOBBY,
    dayCount: 0,
    players: [],
    myPlayerId: null,
    logs: [],
    mafiaMessages: [],
    revealedCount: 0,
    mafiaCommittedCount: 0,
    mafiaRevealedCount: 0,
    phaseDeadline: 0,
    winner: null,
    host: null,
    maxPlayers: 16
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // ==================== LOCAL STATE ====================
    const [playerName, setPlayerName] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('playerName') || '';
        return '';
    });
    const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('mafia_player_avatar') || null;
        return null;
    });
    const [lobbyName, setLobbyName] = useState(() => {
        if (typeof window !== 'undefined') return sessionStorage.getItem('lobbyName') || '';
        return '';
    });
    const [lobbyPassword, setLobbyPassword] = useState('');
    const [currentRoomId, setCurrentRoomIdRaw] = useState<bigint | null>(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const urlRoomId = urlParams.get('roomId');
            if (urlRoomId) {
                const abandoned = JSON.parse(localStorage.getItem('mafia_abandoned_rooms') || '[]');
                if (!abandoned.includes(urlRoomId)) return BigInt(urlRoomId);
            }
            const path = window.location.pathname;
            // Only restore saved roomId on pages that need it (active game / waiting room).
            // /create and /setup should NOT restore old room data — it causes stale
            // players from the previous room to appear briefly in the new lobby.
            const shouldRestoreRoom = ['/game', '/lobby', '/waiting'].some(p => path.startsWith(p));
            if (!shouldRestoreRoom) return null;
            const saved = sessionStorage.getItem('currentRoomId');
            if (saved) return BigInt(saved);
            const lsSaved = localStorage.getItem('currentRoomId');
            if (lsSaved) {
                const abandoned = JSON.parse(localStorage.getItem('mafia_abandoned_rooms') || '[]');
                if (!abandoned.includes(lsSaved)) return BigInt(lsSaved);
            }
        }
        return null;
    });

    const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
    const [selectedTarget, setSelectedTarget] = useState<`0x${string}` | null>(null);
    const [showVotingResults, setShowVotingResults] = useState(false);
    const [keys, setKeys] = useState<CryptoKeyPair | null>(null);
    const [isTxPending, setIsTxPending] = useState(false);
    const [isTxConfirming, setIsTxConfirming] = useState(false);
    const [isTestMode, setIsTestMode] = useState(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("test") === "true" || params.has("test");
        }
        return false;
    });
    const [playerMarks, setPlayerMarks] = useState<Record<string, 'mafia' | 'civilian' | 'question' | null>>({});
    const [voteMap, setVoteMap] = useState<Record<string, string>>({});
    const [useEmbeddedWallet, setUseEmbeddedWallet] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('mafia_use_embedded_wallet') !== 'false';
        return true;
    });
    const [discussionState, setDiscussionState] = useState<DiscussionState | null>(null);

    // Persist embedded wallet preference
    useEffect(() => {
        if (typeof window !== 'undefined') localStorage.setItem('mafia_use_embedded_wallet', String(useEmbeddedWallet));
    }, [useEmbeddedWallet]);

    // ==================== SET CURRENT ROOM ID (with side effects) ====================
    const setCurrentRoomId = useCallback((id: bigint | null) => {
        if (id !== null) {
            localStorage.setItem('currentRoomId', id.toString());
            sessionStorage.setItem('currentRoomId', id.toString());
        }
        setCurrentRoomIdRaw(id);
    }, []);

    // ==================== ADD LOG ====================
    const addLog = useCallback((
        message: string,
        type: LogEntry['type'] = 'info',
        eventType?: GameEventType,
        eventData?: GameEventData,
        id?: string
    ) => {
        setGameState(prev => {
            const entryId = id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const existingIndex = prev.logs.findIndex(l => l.id === entryId);

            const newEntry: LogEntry = {
                id: entryId,
                timestamp: new Date().toISOString(),
                message,
                type,
                eventType,
                eventData,
            };

            if (existingIndex >= 0) {
                // Always merge eventData — address fields (playerAddress /
                // voterAddress / targetAddress) placed by one writer must survive
                // when the other writer pushes the same log id. Previously the
                // merge was gated on `message !== message`, but client pollEvents
                // and the GM server often produce the IDENTICAL message ("Alice
                // voted for Bob") after resolving the same nickname — so the
                // gate held, the incoming richer eventData was dropped, and
                // downstream UI lost its address-based voter lookup.
                const existing = prev.logs[existingIndex];
                const mergedEventData = { ...existing.eventData, ...eventData };
                const hasNewFields = Object.keys(mergedEventData).length !== Object.keys(existing.eventData || {}).length;
                if (existing.message === message && existing.type === type && !hasNewFields) {
                    return prev; // truly nothing new, skip re-render
                }
                const newLogs = [...prev.logs];
                newLogs[existingIndex] = { ...newEntry, eventData: mergedEventData };
                return { ...prev, logs: newLogs };
            }

            return {
                ...prev,
                logs: [...prev.logs.slice(-499), newEntry],
            };
        });
    }, []);

    const addLogs = useCallback((newLogs: LogEntry[]) => {
        setGameState(prev => {
            const logMap = new Map(prev.logs.map(l => [l.id, l]));
            let hasChanges = false;

            for (const log of newLogs) {
                const existing = logMap.get(log.id);
                if (!existing) {
                    logMap.set(log.id, log);
                    hasChanges = true;
                    continue;
                }
                // Always merge eventData — gating this on `message !== message`
                // dropped address fields when both client pollEvents and the GM
                // server produced an identical canonical message (same sender
                // + same target nickname resolution). See addLog for details.
                const mergedEventData = { ...existing.eventData, ...log.eventData };
                const hasNewFields = Object.keys(mergedEventData).length !== Object.keys(existing.eventData || {}).length;
                const messageChanged = existing.message !== log.message || existing.type !== log.type;
                if (!messageChanged && !hasNewFields) continue;
                logMap.set(log.id, { ...log, eventData: mergedEventData });
                hasChanges = true;
            }

            if (!hasChanges) return prev;

            const merged = Array.from(logMap.values())
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .slice(-500);

            return { ...prev, logs: merged };
        });
    }, []);

    // ==================== SET PLAYER MARK ====================
    const setPlayerMark = useCallback((address: string, mark: 'mafia' | 'civilian' | 'question' | null) => {
        setPlayerMarks(prev => ({ ...prev, [address.toLowerCase()]: mark }));
    }, []);

    // ==================== LEVEL 0: SHARED REFS ====================
    const refs = useGameRefs();

    // Sync refs with local state
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refs.playerNameRef.current = playerName; }, [playerName]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refs.lobbyNameRef.current = lobbyName; if (lobbyName) sessionStorage.setItem('lobbyName', lobbyName); }, [lobbyName]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refs.lobbyPasswordRef.current = lobbyPassword; }, [lobbyPassword]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refs.avatarUrlRef.current = avatarUrl; }, [avatarUrl]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refs.phaseRef.current = gameState.phase; }, [gameState.phase]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refs.dayCountRef.current = gameState.dayCount; }, [gameState.dayCount]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { refs.playersRef.current = gameState.players; }, [gameState.players]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        refs.currentRoomIdRef.current = currentRoomId;
        refs.roleFetchedRef.current = false;
        console.log(`[GameContext] Room ID changed to ${currentRoomId}. Resetting game state.`);
        setGameState(INITIAL_GAME_STATE);
        setPlayerMarks({});
        refs.avatarCacheRef.current = {};
        refs.lastPhaseKeyRef.current = '';
    }, [currentRoomId]);

    // Phase rewind detector: if the room transitions from SHUFFLING/REVEAL back
    // to LOBBY within the same currentRoomId, the contract rewound the room via
    // kickAfkAndReturnToLobby (pre-DAY timeout). The game isn't over — players
    // stay in the room, host can re-start — but the local state from the aborted
    // shuffle (commit/reveal flags, deck, role keys) is stale. Reset the
    // relevant slices and surface a toast so the player knows what happened.
    const prevPhaseRef = useRef<GamePhase>(gameState.phase);
    useEffect(() => {
        const prev = prevPhaseRef.current;
        const next = gameState.phase;
        prevPhaseRef.current = next;

        const wentBackToLobby =
            (prev === GamePhase.SHUFFLING || prev === GamePhase.REVEAL) &&
            next === GamePhase.LOBBY;

        if (!wentBackToLobby) return;
        if (!currentRoomId) return;

        console.log('[GameContext] Room rewound from', GamePhase[prev], '→ LOBBY. Resetting shuffle state.');

        // Clear shuffle service singleton — it holds the SRA keypair from the
        // aborted attempt which won't match the restart.
        resetShuffleService();
        if (refs.addressRef.current) {
            try {
                // Best-effort localStorage cleanup for the specific room+wallet.
                const rid = currentRoomId.toString();
                const addrLower = refs.addressRef.current.toLowerCase();
                localStorage.removeItem(`mafia_keys_${rid}_${addrLower}`);
                localStorage.removeItem(`mafia_shuffle_commit_${rid}_${addrLower}`);
                localStorage.removeItem(`role_salt_${rid}_${addrLower}`);
                localStorage.removeItem(`my_role_${rid}_${addrLower}`);
            } catch {
                /* localStorage unavailable — ignore */
            }
        }

        // Reset phase-specific slices of gameState. Keep currentRoomId,
        // players list (it'll be refreshed from chain on next poll), and
        // room metadata. Drop stale dayCount / revealed counters.
        setGameState(prev => ({
            ...prev,
            phase: GamePhase.LOBBY,
            dayCount: 0,
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            winner: null,
            players: prev.players.map(p => ({
                ...p,
                role: Role.UNKNOWN,
                hasConfirmedRole: false,
                hasDeckCommitted: false,
                hasVoted: false,
                hasNightCommitted: false,
                hasNightRevealed: false,
            })),
        }));

        refs.lastPhaseKeyRef.current = '';
        refs.roleFetchedRef.current = false;

        toast.warning(
            'Game was aborted before it started — back to lobby. Host can re-start when everyone is ready.',
            { duration: 7000, id: 'room-rewound' },
        );
        addLog('Room returned to lobby (shuffle/reveal aborted)', 'info');
    }, [gameState.phase, currentRoomId, refs, addLog]);

    // ==================== WALLET READY STATE ====================
    const { isConnecting, isReconnecting } = useAccount();
    const { ready, authenticated } = usePrivy();

    // True once Privy is initialised + Wagmi has finished reconnecting + address is set.
    // Used to disable action buttons during the brief reconnection window on page load.
    const isWalletReady = useMemo(
        () => ready && authenticated && !isConnecting && !isReconnecting && !!refs.stableAddress,
        [ready, authenticated, isConnecting, isReconnecting, refs.stableAddress]
    );

    // ==================== LEVEL 1: INFRASTRUCTURE ====================
    const wallet = useWalletManager(refs, useEmbeddedWallet);

    // Forward declaration: dataSync.refreshPlayersList is needed by txEngine
    // We solve this by creating a stable ref-based wrapper
    const refreshPlayersListRef = React.useRef<(roomId: bigint) => Promise<any>>(() => Promise.resolve());

    const txEngine = useTransactionEngine({
        refs,
        wallet,
        isTestMode,
        setIsTxPending,
        setIsTxConfirming,
        setGameState,
        addLog,
        refreshPlayersList: (...args) => refreshPlayersListRef.current(...args),
    });

    // ==================== LEVEL 2: DATA SYNC ====================
    const dataSync = useGameDataSync({
        refs,
        isTestMode,
        setGameState,
        avatarUrl,
        currentRoomId,
    });

    // Wire up the forward ref
    useEffect(() => {
        refreshPlayersListRef.current = dataSync.refreshPlayersList;
    }, [dataSync.refreshPlayersList]);

    // ==================== DERIVED STATE ====================
    const myPlayer = useMemo(() => {
        // Fallback to myPlayerId if in test mode (for local testing without wallet)
        const currentAddr = (isTestMode && gameState.myPlayerId) ? (gameState.myPlayerId as `0x${string}`) : refs.stableAddress;

        const found = gameState.players.find(p =>
            p.address.toLowerCase() === currentAddr?.toLowerCase()
        );

        // Fallback: if stableAddress (from useAccount) doesn't match any player,
        // try addressRef which tracks the wallet that actually signed the transaction.
        // This handles the case where Privy/Wagmi active wallet differs from the tx signer.
        if (!found && refs.addressRef.current && refs.addressRef.current.toLowerCase() !== currentAddr?.toLowerCase()) {
            return gameState.players.find(p =>
                p.address.toLowerCase() === refs.addressRef.current!.toLowerCase()
            );
        }

        return found;
    }, [gameState.players, refs.stableAddress, refs.addressRef, isTestMode, gameState.myPlayerId]);

    // ==================== LEVEL 3: DOMAIN ACTIONS ====================
    const lobby = useLobbyActions({
        refs, wallet, txEngine, dataSync,
        setKeys, setCurrentRoomId, setIsTxPending, addLog,
    });

    const shuffle = useShuffleActions({
        refs, txEngine, setIsTxPending, addLog,
    });

    const role = useRoleActions({
        refs, wallet, txEngine, dataSync, myPlayer,
        setIsTxPending, setGameState, addLog,
    });

    const voting = useVotingActions({
        refs, txEngine, setIsTxPending, setVoteMap, addLog,
    });

    const night = useNightActions({
        refs, wallet, txEngine, dataSync, isTestMode,
        setIsTxPending, addLog,
    });

    const chat = useMafiaChat({
        refs, wallet, txEngine, gameState, setGameState, addLog, currentRoomId
    });

    const tournaments = useTournaments({
        refs, wallet, txEngine,
        setKeys, setCurrentRoomId, setIsTxPending, setIsTxConfirming, addLog,
    });

    const endGame = useEndGame({
        refs, txEngine, dataSync, gameState,
        setIsTxPending, setGameState, addLog, isTestMode, currentRoomId
    });

    const refundClaims = useRefundClaims({
        refs, wallet, addLog,
    });

    // ==================== LEVEL 4: EVENT POLLING ====================
    useEventPoller({
        refs, dataSync, gameState, currentRoomId,
        setGameState, setVoteMap, setShowVotingResults, addLog, addLogs,
        handleIncomingMafiaSignal: chat.handleIncomingMafiaSignal,
    });

    // ==================== SHARED DISCUSSION POLLING ====================
    const fetchDiscussionState = useCallback(async () => {
        if (gameState.phase !== GamePhase.DAY || !currentRoomId) return;
        try {
            const res = await fetch(`/api/game/discussion?roomId=${currentRoomId}&dayCount=${gameState.dayCount}&playerAddress=${refs.stableAddress || ''}&chainId=${refs.runtimeChain.id || ''}&t=${Date.now()}`);
            if (!res.ok) {
                const err = new Error(`HTTP ${res.status}`) as any;
                err.status = res.status;
                throw err;
            }
            const data = await res.json();
            setDiscussionState(data);
            return data;
        } catch (e) {
            console.error('[Discussion Polling] Error:', e);
            throw e;
        }
    }, [gameState.phase, gameState.dayCount, currentRoomId, refs.stableAddress, refs.runtimeChain.id]);

    // Discussion polling is handled by DayPhase (every 3s when mounted).
    // Only clear stale state here when leaving DAY phase.
    useEffect(() => {
        const isDay = gameState.phase === GamePhase.DAY;
        if (!isDay && discussionState !== null) {
            setDiscussionState(null);
        }
    }, [gameState.phase, discussionState, setDiscussionState]);

    // ==================== SMOOTH DISCUSSION TIME ====================
    // Server pushes discussionState every 3-10s. If any UI ticks per-second
    // (speaker timer on player spots, countdown in the discussion section),
    // reading discussionState.timeRemaining directly makes the value jump in
    // 3-10s increments and often skips the <=10s highlight window entirely.
    //
    // We interpolate locally here so there's ONE shared smooth value that
    // every consumer can read (GameLayout player cards + DayPhase discussion
    // section). Previously only DayPhase computed its own interpolation, so
    // the player-spot timer rendered from raw server values and appeared
    // broken.
    //
    // Monotonic clamp: never accept a server update that would move the
    // displayed value BACKWARD unless the speaker actually changed (= new
    // turn, fresh budget). Stale latency-delayed server pushes would
    // otherwise rewind the UI by ~1s.
    const [smoothDiscussionTimeRemaining, setSmoothDiscussionTimeRemaining] = useState<number>(0);
    const discLastServerTimeRef = React.useRef<number>(0);
    const discLastUpdateTsRef = React.useRef<number>(0);
    const discLastSpeakerRef = React.useRef<string | null>(null);
    const discLastPhaseRef = React.useRef<string | null>(null);

    useEffect(() => {
        if (!discussionState || discussionState.timeRemaining === undefined) {
            setSmoothDiscussionTimeRemaining(0);
            discLastServerTimeRef.current = 0;
            discLastUpdateTsRef.current = 0;
            discLastSpeakerRef.current = null;
            discLastPhaseRef.current = null;
            return;
        }
        const serverValue = discussionState.timeRemaining;
        const speaker = discussionState.currentSpeakerAddress || null;
        const speakerChanged = speaker !== discLastSpeakerRef.current;
        discLastSpeakerRef.current = speaker;

        if (serverValue === discLastServerTimeRef.current && !speakerChanged) return;

        const elapsed = Math.floor((Date.now() - discLastUpdateTsRef.current) / 1000);
        const currentInterp = Math.max(0, discLastServerTimeRef.current - elapsed);

        // Stale-server clamp: ignore server updates that would rewind the UI
        // backwards unless we have a legitimate reason to jump up.
        //
        // Legitimate reasons to accept a higher server value:
        //   1. Speaker changed — new turn, fresh budget.
        //   2. Current interp is 0 — we're at rest, any new value is fine.
        //      This specifically covers the `initial_delay` → `turn_in_progress`
        //      transition where the server counts down 5..0 during the 5-second
        //      pre-discussion delay, then sends `timeRemaining=60` for the real
        //      turn without necessarily changing speaker. Without this guard
        //      the timer would stick at 0 for the entire actual discussion.
        //   3. Phase field changed (e.g. initial_delay → something else).
        const phaseChanged = discussionState.phase !== discLastPhaseRef.current;
        discLastPhaseRef.current = discussionState.phase || null;

        if (serverValue > currentInterp && !speakerChanged && !phaseChanged && currentInterp > 0) {
            // Truly stale — re-anchor to current displayed value.
            discLastServerTimeRef.current = currentInterp;
            discLastUpdateTsRef.current = Date.now();
            return;
        }

        discLastServerTimeRef.current = serverValue;
        discLastUpdateTsRef.current = Date.now();
        setSmoothDiscussionTimeRemaining(serverValue);
    }, [discussionState]);

    useEffect(() => {
        if (!discussionState?.active || discussionState?.finished) return;
        const iv = setInterval(() => {
            const elapsed = Math.floor((Date.now() - discLastUpdateTsRef.current) / 1000);
            setSmoothDiscussionTimeRemaining(Math.max(0, discLastServerTimeRef.current - elapsed));
        }, 300);
        return () => clearInterval(iv);
    }, [discussionState?.active, discussionState?.finished]);

    // ==================== FETCH ROLE ON PHASE CHANGE ====================
    const prevPhaseForRoleRef = React.useRef<GamePhase>(GamePhase.LOBBY);
    useEffect(() => {
        const prev = prevPhaseForRoleRef.current;
        const curr = gameState.phase;
        prevPhaseForRoleRef.current = curr;
        if (curr === GamePhase.DAY && prev !== GamePhase.DAY) {
            setTimeout(() => { role.fetchMyRoleFromGM(); }, 2000);
        }
    }, [gameState.phase, role.fetchMyRoleFromGM]);

    // ==================== CLEAR MAFIA CHAT ON NIGHT ENTRY ====================
    // Each night is a separate mafia discussion. Previously mafiaMessages
    // accumulated across the whole game — Night 1 messages were still visible
    // to mafia on Night 2, 3, etc. Reset the list whenever we transition INTO
    // a new NIGHT phase (not just when the game first enters NIGHT).
    const prevPhaseForMafiaChatRef = React.useRef<GamePhase>(GamePhase.LOBBY);
    useEffect(() => {
        const prev = prevPhaseForMafiaChatRef.current;
        const curr = gameState.phase;
        prevPhaseForMafiaChatRef.current = curr;
        if (curr === GamePhase.NIGHT && prev !== GamePhase.NIGHT) {
            setGameState(prev => ({ ...prev, mafiaMessages: [] }));
        }
    }, [gameState.phase]);

    // ==================== UI HELPERS ====================
    const canActOnPlayer = useCallback((target: Player) => {
        if (!myPlayer?.isAlive) return false;
        if (!target.isAlive) return false;
        if (target.address.toLowerCase() === myPlayer?.address.toLowerCase()) return false;

        if (gameState.phase === GamePhase.VOTING) return true;

        if (gameState.phase === GamePhase.NIGHT) {
            if (myPlayer?.hasNightCommitted) return false;
            const myRole = myPlayer?.role;
            if (myRole === Role.MAFIA || myRole === Role.DETECTIVE || myRole === Role.DOCTOR) {
                if (myRole === Role.MAFIA && target.role === Role.MAFIA) return false;
                return true;
            }
            return false;
        }
        return false;
    }, [gameState.phase, gameState.players, myPlayer]);

    const handlePlayerAction = useCallback((targetId: `0x${string}`) => {
        const targetPlayer = gameState.players.find(p => p.address.toLowerCase() === targetId.toLowerCase());
        if (!targetPlayer || !canActOnPlayer(targetPlayer)) return;
        if (gameState.phase === GamePhase.VOTING || gameState.phase === GamePhase.NIGHT) {
            setSelectedTarget(prev => prev === targetId ? null : targetId);
        }
    }, [gameState.phase, gameState.players, canActOnPlayer]);

    const getActionLabel = useCallback(() => {
        if (gameState.phase === GamePhase.VOTING) return "VOTE";
        if (gameState.phase === GamePhase.NIGHT) return "TARGET";
        return "SELECT";
    }, [gameState.phase]);

    // Kick stalled player delegates to forcePhaseTimeout
    const kickStalledPlayerOnChain = useCallback(async () => {
        await night.forcePhaseTimeoutOnChain();
    }, [night.forcePhaseTimeoutOnChain]);

    // ==================== CONTEXT VALUE ====================
    const contextValue = useMemo<GameContextType>(() => ({
        // State
        playerName, setPlayerName, avatarUrl, setAvatarUrl, lobbyName, setLobbyName,
        gameState, setGameState, isTxPending, isTxConfirming, currentRoomId,
        selectedTarget, setSelectedTarget, showVotingResults, setShowVotingResults,
        isTestMode, setIsTestMode, setIsTxPending,
        playerMarks, setPlayerMark, voteMap, setVoteMap,
        runtimeContractAddress: refs.runtimeContractAddress,
        currencySymbol: refs.runtimeChain.name.toLowerCase().includes('somnia') ? 'SOMI' : refs.runtimeChain.nativeCurrency.symbol,
        publicClient: refs.publicClient,
        address: refs.stableAddress,
        isWalletReady,
        useEmbeddedWallet, setUseEmbeddedWallet,
        runtimeChain: refs.runtimeChain,
        setCurrentRoomId,
        lobbyPassword, setLobbyPassword,
        myPlayer, addLog,
        discussionState, setDiscussionState, fetchDiscussionState,
        smoothDiscussionTimeRemaining,

        // Lobby
        createLobbyOnChain: lobby.createLobbyOnChain,
        joinLobbyOnChain: lobby.joinLobbyOnChain,
        forfeitGameOnChain: lobby.forfeitGameOnChain,
        broadcastRematchInvite: lobby.broadcastRematchInvite,
        createRematchLobby: lobby.createRematchLobby,

        // Shuffle
        startGameOnChain: shuffle.startGameOnChain,
        commitDeckOnChain: shuffle.commitDeckOnChain,
        revealDeckOnChain: shuffle.revealDeckOnChain,
        shareKeysToAllOnChain: shuffle.shareKeysToAllOnChain,

        // Role
        commitRoleOnChain: role.commitRoleOnChain,
        confirmRoleOnChain: role.confirmRoleOnChain,
        commitAndConfirmRoleOnChain: role.commitAndConfirmRoleOnChain,
        syncSecretWithServer: role.syncSecretWithServer,
        decryptMyRoleFromGM: role.decryptMyRoleFromGM,

        // Voting
        startVotingOnChain: voting.startVotingOnChain,
        voteOnChain: voting.voteOnChain,
        finalizeVotingOnChain: voting.finalizeVotingOnChain,

        // Night
        submitNightActionToGM: night.submitNightActionToGM,
        skipNightActionToGM: night.skipNightActionToGM,
        fetchInvestigationProofFromGM: night.fetchInvestigationProofFromGM,
        getInvestigationResultOnChain: night.getInvestigationResultOnChain,
        forcePhaseTimeoutOnChain: night.forcePhaseTimeoutOnChain,

        // Chat
        sendMafiaMessageOnChain: chat.sendMafiaMessageOnChain,
        handleIncomingMafiaSignal: chat.handleIncomingMafiaSignal,
        getMafiaChatKey: chat.getMafiaChatKey,

        // End Game
        endGameZK: endGame.endGameZK,
        fetchOnChainRoles: endGame.fetchOnChainRoles,
        fetchGMRoles: endGame.fetchGMRoles,

        // Tournaments
        createTournamentOnChain: tournaments.createTournamentOnChain,
        joinTournamentOnChain: tournaments.joinTournamentOnChain,
        createTournamentAndRoomOnChain: tournaments.createTournamentAndRoomOnChain,
        distributePrizesOnChain: tournaments.distributePrizesOnChain,
        cancelTournamentOnChain: tournaments.cancelTournamentOnChain,
        leaveTournamentOnChain: tournaments.leaveTournamentOnChain,

        // Utility
        kickStalledPlayerOnChain,
        refreshPlayersList: dataSync.refreshPlayersList,
        handlePlayerAction, canActOnPlayer, getActionLabel,

        // Pull-based refund
        pendingRefundNative: refundClaims.pendingNative,
        isClaimingRefund: refundClaims.isClaiming,
        claimRefund: refundClaims.claim,
        refreshPendingRefund: refundClaims.refresh,
    }), [
        playerName, avatarUrl, lobbyName, gameState, isTxPending, isTxConfirming,
        currentRoomId, selectedTarget, showVotingResults, isTestMode,
        playerMarks, voteMap, useEmbeddedWallet, isWalletReady,
        refs.runtimeContractAddress, refs.runtimeChain, refs.publicClient, refs.stableAddress,
        lobbyPassword, myPlayer, addLog, setCurrentRoomId,
        discussionState, setDiscussionState, fetchDiscussionState,
        smoothDiscussionTimeRemaining,
        lobby, shuffle, role, voting, night, chat, tournaments,
        endGame.endGameZK,
        endGame.fetchOnChainRoles, endGame.fetchGMRoles,
        dataSync.refreshPlayersList,
        kickStalledPlayerOnChain, handlePlayerAction, canActOnPlayer, getActionLabel,
        setPlayerMark,
        refundClaims.pendingNative, refundClaims.isClaiming,
        refundClaims.claim, refundClaims.refresh,
    ]);

    return (
        <GameContext.Provider value={contextValue}>
            {children}
        </GameContext.Provider>
    );
};

export const useGameContext = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error("GameProvider error");
    return context;
};
