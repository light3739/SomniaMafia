/**
 * GameContext public interface (types only).
 * Extracted from the monolithic GameContext.tsx.
 */
import React from 'react';
import { GameState, Player, LogEntry, Role, MafiaChatMessage } from '../types';
import type { EciesEncrypted } from '../services/eciesService';

export interface GameContextType {
    playerName: string;
    setPlayerName: (name: string) => void;
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    lobbyName: string;
    setLobbyName: (name: string) => void;
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    isTxPending: boolean;
    isTxConfirming: boolean;
    currentRoomId: bigint | null;
    selectedTarget: `0x${string}` | null;
    setSelectedTarget: (target: `0x${string}` | null) => void;
    showVotingResults: boolean;
    setShowVotingResults: (val: boolean) => void;

    // Lobby
    joinLobbyOnChain: (roomId: bigint | number, passwordOverride?: string) => Promise<boolean>;
    forfeitGameOnChain: () => Promise<boolean>;

    // Shuffle (V4: commit-reveal)
    startGameOnChain: () => Promise<void>;
    commitDeckOnChain: (deckHash: string) => Promise<`0x${string}` | undefined>;
    revealDeckOnChain: (deck: string[], salt: string) => Promise<`0x${string}` | undefined>;

    // Reveal (V3: batch share keys)
    shareKeysToAllOnChain: (recipients: string[], encryptedKeys: string[]) => Promise<void>;
    commitRoleOnChain: (role: number, salt: string) => Promise<void>;
    confirmRoleOnChain: () => Promise<void>;
    commitAndConfirmRoleOnChain: (role: number, salt: string) => Promise<void>;

    // Day/Voting (V3: auto-finalize on last vote)
    startVotingOnChain: () => Promise<void>;
    voteOnChain: (targetAddress: `0x${string}`) => Promise<void>;

    // Night (V4: GM-based)
    submitNightActionToGM: (actionType: 'kill' | 'heal' | 'check', targetAddress: string) => Promise<void>;
    skipNightActionToGM: () => Promise<void>;
    fetchInvestigationProofFromGM: (targetAddress: string) => Promise<{ role: Role, source: string } | null>;

    finalizeVotingOnChain: () => Promise<void>;
    forcePhaseTimeoutOnChain: () => Promise<void>;
    endGameZK: () => Promise<void>;
    sendMafiaMessageOnChain: (content: MafiaChatMessage["content"]) => Promise<void>;
    getInvestigationResultOnChain: (detective: string, target: string) => Promise<{ role: Role; isMafia: boolean }>;
    syncSecretWithServer: (roomId: string, playerAddress: string, role: number, salt: string) => Promise<void>;
    setCurrentRoomId: (id: bigint | null) => void;
    handleIncomingMafiaSignal: (sender: string, encryptedHex: string) => Promise<void>;
    getMafiaChatKey: (roomId: bigint) => Promise<CryptoKey | null>;

    // Utility
    kickStalledPlayerOnChain: () => Promise<void>;
    refreshPlayersList: (roomId: bigint) => Promise<any>;

    addLog: (message: string, type?: LogEntry['type'], eventType?: import('../types').GameEventType, eventData?: import('../types').GameEventData) => void;
    handlePlayerAction: (targetId: `0x${string}`) => void;
    myPlayer: Player | undefined;
    getActionLabel: () => string;
    canActOnPlayer: (target: Player) => boolean;
    setIsTestMode: (val: boolean) => void;
    isTestMode: boolean;
    setIsTxPending: (val: boolean) => void;
    playerMarks: Record<string, 'mafia' | 'civilian' | 'question' | null>;
    setPlayerMark: (address: string, mark: 'mafia' | 'civilian' | 'question' | null) => void;
    voteMap: Record<string, string>;
    setVoteMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    runtimeContractAddress: `0x${string}`;
    currencySymbol: string;
    decryptMyRoleFromGM: (encrypted: EciesEncrypted) => Promise<number | null>;

    lobbyPassword: string;
    setLobbyPassword: (pass: string) => void;

    // Role reveal (from useEndGame)
    fetchOnChainRoles: () => Promise<void>;
    fetchGMRoles: () => Promise<void>;

    // Tournaments
    createTournamentOnChain: (params: {
        name: string;
        buyIn: string;
        maxPlayers: number;
        playersPerTable: number;
        password?: string;
        paymentToken: `0x${string}`;
        initialPrize: string;
        nonce?: number;
    }) => Promise<bigint | null>;
    joinTournamentOnChain: (tournamentId: bigint, password?: string, amount?: string, nonce?: number) => Promise<boolean>;
    createTournamentAndRoomOnChain: (params: {
        name: string;
        buyIn: string;
        maxPlayers: number;
        playersPerTable: number;
        password?: string;
        paymentToken: `0x${string}`;
        initialPrize: string;
        roomName: string;
        nickname: string;
        isPrivate: boolean;
        joinPassword?: string;
    }) => Promise<boolean>;
    distributePrizesOnChain: (roomId: bigint) => Promise<void>;
    cancelTournamentOnChain: (tournamentId: bigint) => Promise<void>;
    leaveTournamentOnChain: (tournamentId: bigint) => Promise<boolean>;
    publicClient: any;
    address: `0x${string}` | undefined;
    isWalletReady: boolean;
    createLobbyOnChain: (maxPlayers?: number, tournamentId?: bigint, nonce?: number) => Promise<boolean>;
    useEmbeddedWallet: boolean;
    setUseEmbeddedWallet: (v: boolean) => void;
    runtimeChain?: any;

    discussionState: DiscussionState | null;
    setDiscussionState: React.Dispatch<React.SetStateAction<DiscussionState | null>>;
    fetchDiscussionState: () => Promise<void>;

    // Pull-based refund (PR1 DoS fallback UI)
    pendingRefundNative: bigint;
    isClaimingRefund: boolean;
    claimRefund: () => Promise<boolean>;
    refreshPendingRefund: () => Promise<void>;
}

export interface DiscussionState {
    active: boolean;
    currentSpeakerAddress: string | null;
    timeRemaining: number;
    finished?: boolean;
    isMyTurn?: boolean;
    phase?: string;
}
