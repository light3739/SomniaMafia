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

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { GamePhase, GameState, Player, Role, LogEntry, type GameEventType, type GameEventData } from '../types';
import type { GameContextType } from './gameContext.types';

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
            const isGamePage = ['/game', '/lobby', '/waiting', '/join', '/create', '/setup'].some(p => path.startsWith(p));
            if (!isGamePage) return null;
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
        eventData?: GameEventData
    ) => {
        setGameState(prev => ({
            ...prev,
            logs: [...prev.logs.slice(-500), {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: new Date().toISOString(),
                message,
                type,
                eventType,
                eventData,
            }],
        }));
    }, []);

    // ==================== SET PLAYER MARK ====================
    const setPlayerMark = useCallback((address: string, mark: 'mafia' | 'civilian' | 'question' | null) => {
        setPlayerMarks(prev => ({ ...prev, [address.toLowerCase()]: mark }));
    }, []);

    // ==================== LEVEL 0: SHARED REFS ====================
    const refs = useGameRefs();

    // Sync refs with local state
    useEffect(() => { refs.playerNameRef.current = playerName; }, [playerName, refs]);
    useEffect(() => { refs.lobbyNameRef.current = lobbyName; }, [lobbyName, refs]);
    useEffect(() => { refs.lobbyPasswordRef.current = lobbyPassword; }, [lobbyPassword, refs]);
    useEffect(() => { refs.avatarUrlRef.current = avatarUrl; }, [avatarUrl, refs]);
    useEffect(() => { refs.phaseRef.current = gameState.phase; }, [gameState.phase, refs]);
    useEffect(() => { refs.dayCountRef.current = gameState.dayCount; }, [gameState.dayCount, refs]);
    useEffect(() => { refs.playersRef.current = gameState.players; }, [gameState.players, refs]);
    useEffect(() => {
        refs.currentRoomIdRef.current = currentRoomId;
        refs.roleFetchedRef.current = false;
        console.log(`[GameContext] Room ID changed to ${currentRoomId}. Resetting game state.`);
        setGameState(INITIAL_GAME_STATE);
        setPlayerMarks({});
        refs.avatarCacheRef.current = {};
        refs.lastPhaseKeyRef.current = '';
    }, [currentRoomId, refs]);

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
    });

    // Wire up the forward ref
    useEffect(() => {
        refreshPlayersListRef.current = dataSync.refreshPlayersList;
    }, [dataSync.refreshPlayersList]);

    // ==================== DERIVED STATE ====================
    const myPlayer = useMemo(() => {
        return gameState.players.find(p =>
            p.address.toLowerCase() === refs.stableAddress?.toLowerCase()
        );
    }, [gameState.players, refs.stableAddress]);

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
        refs, wallet, txEngine, gameState, setGameState, addLog,
    });

    const tournaments = useTournaments({
        refs, wallet, txEngine,
        setKeys, setCurrentRoomId, setIsTxPending, setIsTxConfirming, addLog,
    });

    const endGame = useEndGame({
        refs, txEngine, dataSync, gameState,
        setIsTxPending, setGameState, addLog,
    });

    // ==================== LEVEL 4: EVENT POLLING ====================
    useEventPoller({
        refs, dataSync, gameState,
        setGameState, setVoteMap, setShowVotingResults, addLog,
    });

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
        currencySymbol: refs.runtimeChain.nativeCurrency.symbol,
        publicClient: refs.publicClient,
        address: refs.stableAddress,
        useEmbeddedWallet, setUseEmbeddedWallet,
        runtimeChain: refs.runtimeChain,
        setCurrentRoomId,
        lobbyPassword, setLobbyPassword,
        myPlayer, addLog,

        // Lobby
        createLobbyOnChain: lobby.createLobbyOnChain,
        joinLobbyOnChain: lobby.joinLobbyOnChain,

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

        // Tournaments
        createTournamentOnChain: tournaments.createTournamentOnChain,
        joinTournamentOnChain: tournaments.joinTournamentOnChain,
        createTournamentAndRoomOnChain: tournaments.createTournamentAndRoomOnChain,
        distributePrizesOnChain: tournaments.distributePrizesOnChain,
        cancelTournamentOnChain: tournaments.cancelTournamentOnChain,

        // Utility
        kickStalledPlayerOnChain,
        refreshPlayersList: dataSync.refreshPlayersList,
        handlePlayerAction, canActOnPlayer, getActionLabel,
    }), [
        playerName, avatarUrl, lobbyName, gameState, isTxPending, isTxConfirming,
        currentRoomId, selectedTarget, showVotingResults, isTestMode,
        playerMarks, voteMap, useEmbeddedWallet,
        refs.runtimeContractAddress, refs.runtimeChain, refs.publicClient, refs.stableAddress,
        lobbyPassword, myPlayer, addLog, setCurrentRoomId,
        lobby, shuffle, role, voting, night, chat, tournaments, endGame,
        dataSync.refreshPlayersList,
        kickStalledPlayerOnChain, handlePlayerAction, canActOnPlayer, getActionLabel,
        setPlayerMark,
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
