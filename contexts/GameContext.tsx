"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useAccount, useWriteContract, usePublicClient, useWalletClient, useWatchContractEvent, useWatchBlockNumber } from 'wagmi';
import { createWalletClient, http, fallback, parseEther, formatEther, parseEventLogs, toHex, pad, custom, type WalletClient, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount, nonceManager } from 'viem/accounts';
import { useWallets } from '@privy-io/react-auth';
import { GamePhase, GameState, Player, Role, LogEntry, MafiaChatMessage } from '../types';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI, GM_SERVER_URL, AVALANCHE_FUJI, getDeploymentByChainId } from '../contracts/config';
import { generateKeyPair, exportPublicKey } from '../services/cryptoUtils';
import { loadSession, createNewSession, markSessionRegistered, getSessionAccount, createSessionWalletClient } from '../services/sessionKeyService';
import { loadOrCreateKeypair, exportPublicKeyHex, eciesDecrypt, EciesEncrypted } from '../services/eciesService';
import { generateEndGameProof } from '../services/zkProof';
import { ShuffleService } from '../services/shuffleService';
import { signRequest } from '../services/requestSigning';
import { buildAvatarMessage, buildNightActionMessage, buildResolveNightMessage, buildDiscussionMessage, buildInvestigateMessage, buildRoleSyncMessage, buildMafiaMembersMessage } from '../services/signingSchema';
import * as GM from '../services/gmService';
import { emitGameSignal } from '../services/signalBus';

const shotSound = "/assets/mafia_shot.wav";

interface GameContextType {
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
    joinLobbyOnChain: (roomId: bigint | number) => Promise<boolean>;

    // Shuffle (V4: commit-reveal)
    startGameOnChain: () => Promise<void>;
    commitDeckOnChain: (deckHash: string) => Promise<`0x${string}` | undefined>;
    revealDeckOnChain: (deck: string[], salt: string) => Promise<void>;

    // Reveal (V3: batch share keys)
    shareKeysToAllOnChain: (recipients: string[], encryptedKeys: string[]) => Promise<void>;
    commitRoleOnChain: (role: number, salt: string) => Promise<void>;
    confirmRoleOnChain: () => Promise<void>;
    commitAndConfirmRoleOnChain: (role: number, salt: string) => Promise<void>;

    // Day/Voting (V3: auto-finalize on last vote)
    startVotingOnChain: () => Promise<void>;
    voteOnChain: (targetAddress: `0x${string}`) => Promise<void>;

    // Night (V4: Mafia uses consensus, Doctor/Detective use commit-reveal)
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
    // Mafia Chat

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
    // Vote visualization: voter address -> target address
    voteMap: Record<string, string>;
    setVoteMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    runtimeContractAddress: `0x${string}`;
    currencySymbol: string;
    decryptMyRoleFromGM: (encrypted: EciesEncrypted) => Promise<number | null>;

    lobbyPassword: string;
    setLobbyPassword: (pass: string) => void;

    // Tournaments
    createTournamentOnChain: (params: {
        name: string;
        buyIn: string; // token amount as string
        maxPlayers: number;
        playersPerTable: number;
        password?: string;
        paymentToken: `0x${string}`;
        initialPrize: string; // token amount as string
        nonce?: number;
    }) => Promise<bigint | null>;
    joinTournamentOnChain: (tournamentId: bigint, password?: string, amount?: string, nonce?: number) => Promise<boolean>;
    distributePrizesOnChain: (roomId: bigint) => Promise<void>;
    cancelTournamentOnChain: (tournamentId: bigint) => Promise<void>;
    publicClient: any;
    address: `0x${string}` | undefined;
    createLobbyOnChain: (maxPlayers?: number, tournamentId?: bigint, nonce?: number) => Promise<boolean>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Session
    const [playerName, setPlayerName] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('playerName') || '';
        }
        return '';
    });
    const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('mafia_player_avatar') || null;
        }
        return null;
    });
    const [lobbyName, setLobbyName] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lobbyName') || '';
        }
        return '';
    });
    const [lobbyPassword, setLobbyPassword] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState<bigint | null>(() => {
        if (typeof window !== 'undefined') {
            // FIX #24: Try URL param first, then sessionStorage, then localStorage
            const urlParams = new URLSearchParams(window.location.search);
            const urlRoomId = urlParams.get('roomId');
            if (urlRoomId) {
                const abandoned = JSON.parse(localStorage.getItem('mafia_abandoned_rooms') || '[]');
                if (abandoned.includes(urlRoomId)) {
                    console.log(`[RoomId] Room ${urlRoomId} in URL was abandoned, ignoring.`);
                } else {
                    return BigInt(urlRoomId);
                }
            }

            // FIX: Only restore roomId from storage on game-related pages
            // Prevents stale room polling on home/setup pages after a previous game
            const path = window.location.pathname;
            const isGamePage = ['/game', '/lobby', '/waiting', '/join', '/create', '/setup'].some(p => path.startsWith(p));
            if (!isGamePage) {
                console.log('[RoomId] Not on game page, skipping roomId restore from storage');
                return null;
            }

            const saved = sessionStorage.getItem('currentRoomId');
            if (saved) return BigInt(saved);

            // Fallback: check localStorage (survives tab close)
            const lsSaved = localStorage.getItem('currentRoomId');
            if (lsSaved) {
                const abandoned = JSON.parse(localStorage.getItem('mafia_abandoned_rooms') || '[]');
                if (abandoned.includes(lsSaved)) {
                    console.log(`[RoomId] Room ${lsSaved} was abandoned, skipping auto-restore.`);
                    return null;
                }
                return BigInt(lsSaved);
            }
        }
        return null;
    });
    const [selectedTarget, setSelectedTarget] = useState<`0x${string}` | null>(null);
    const [showVotingResults, setShowVotingResults] = useState(false);
    const [keys, setKeys] = useState<CryptoKeyPair | null>(null);
    const eciesPrivKeyRef = useRef<CryptoKey | null>(null);
    const roleFetchedRef = useRef(false);

    // Ref для currentRoomId чтобы избежать проблем с замыканием в callbacks
    const currentRoomIdRef = useRef<bigint | null>(currentRoomId);
    const autoWinLockRef = useRef(false);
    const checkWinInProgressRef = useRef(false);
    const votingFinalizedTimerRef = useRef<NodeJS.Timeout | null>(null);
    const avatarCacheRef = useRef<Record<string, string>>({});
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;
        roleFetchedRef.current = false;
    }, [currentRoomId]);

    // === TX QUEUE: Serialize session key transactions to prevent nonce collisions ===
    const txQueueRef = useRef<Promise<any>>(Promise.resolve());
    const enqueueTx = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
        const result = txQueueRef.current.then(fn, fn); // run even if previous failed
        txQueueRef.current = result.catch(() => { }); // swallow to keep chain alive
        return result;
    }, []);

    // === DEBOUNCE refreshPlayersList: prevent 10+/sec RPC spam ===
    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const refreshPromiseRef = useRef<Promise<any> | null>(null);
    const lastRefreshTimeRef = useRef<number>(0);
    const lastPhaseKeyRef = useRef<string>('');

    // Web3
    const { address, chainId, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    
    // Derived from active wallet chain (default to Fuji if not connected or unknown chain)
    // STABILITY FIX: Use a ref to keep track of the reported chainId to avoid flickering
    const lastChainIdRef = useRef<number | null>(null);
    if (chainId) lastChainIdRef.current = chainId;

    const runtimeDeployment = useMemo(() => {
        // Use the most recent non-null chainId to prevent "flickering" to default during switches
        return getDeploymentByChainId(chainId || lastChainIdRef.current);
    }, [chainId]);
    const runtimeChain = runtimeDeployment.chain;
    const runtimeContractAddress = runtimeDeployment.contracts.MafiaDiamond as `0x${string}`;

    const publicClient = usePublicClient({ chainId: runtimeChain.id });
    const { data: walletClient } = useWalletClient();
    const { wallets } = useWallets();
    const [isTxPending, setIsTxPending] = useState(false);
    const [isTxConfirming, setIsTxConfirming] = useState(false);
    const pendingConfirmationsRef = useRef<Set<string>>(new Set());
    const [isTestMode, setIsTestMode] = useState(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("test") === "true" || params.has("test");
        }
        return false;
    });
    const [playerMarks, setPlayerMarks] = useState<Record<string, 'mafia' | 'civilian' | 'question' | null>>({});
    // Vote map: stores who voted for whom (voter address -> target address)
    const [voteMap, setVoteMap] = useState<Record<string, string>>({});

    const runtimeChainRef = useRef(runtimeChain);
    const walletsRef = useRef(wallets);
    const addressRef = useRef(address);
    const publicClientRef = useRef(publicClient);
    const walletClientRef = useRef<any>(null);
    const avatarUrlRef = useRef<string | null>(avatarUrl);
    const phaseRef = useRef<GamePhase>(GamePhase.LOBBY);
    const dayCountRef = useRef<number>(0);

    const playerNameRef = useRef(playerName);
    const lobbyNameRef = useRef(lobbyName);
    const lobbyPasswordRef = useRef(lobbyPassword);
    useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
    useEffect(() => { lobbyNameRef.current = lobbyName; }, [lobbyName]);
    useEffect(() => { lobbyPasswordRef.current = lobbyPassword; }, [lobbyPassword]);

    const walletSwitchPromiseRef = useRef<Promise<void> | null>(null);

    const getActiveWalletClient = useCallback(async () => {
        const embeddedWallet = walletsRef.current.find(w => w.walletClientType === 'privy');
        const targetChain = runtimeChainRef.current;

        if (embeddedWallet) {
            const rawChainId = embeddedWallet.chainId;
            let currentChainId = 0;
            
            if (typeof rawChainId === 'string' && rawChainId.includes(':')) {
                currentChainId = Number(rawChainId.split(':')[1]);
            } else {
                currentChainId = Number(rawChainId);
            }
                
            if (currentChainId > 0 && Number.isFinite(currentChainId) && currentChainId !== targetChain.id) {
                if (!walletSwitchPromiseRef.current) {
                    console.log(`[Privy] Switching embedded wallet from ${currentChainId} to ${targetChain.id}`);
                    walletSwitchPromiseRef.current = embeddedWallet.switchChain(targetChain.id).finally(() => {
                        walletSwitchPromiseRef.current = null;
                    });
                }
                await walletSwitchPromiseRef.current;
            }

            const provider = await embeddedWallet.getEthereumProvider();
            return {
                client: createWalletClient({
                    account: embeddedWallet.address as `0x${string}`,
                    chain: targetChain,
                    transport: custom(provider)
                }),
                account: embeddedWallet.address as `0x${string}`
            };
        }
        
        if (walletClientRef.current && addressRef.current) {
            return { client: walletClientRef.current, account: addressRef.current as `0x${string}` };
        }
        throw new Error("No connected wallet found");
    }, []); // ABSOLUTELY STABLE

    const LOBBY_FUNDING_VALUE = useMemo(() => {
        const rc = runtimeChainRef.current;
        const isSomnia = (rc.id === 50312);
        return isSomnia ? parseEther('1.0') : parseEther('0.1'); // 1 STT for Somnia, 0.1 for Fuji
    }, []);

    useEffect(() => {
        if (isTestMode && typeof window !== 'undefined') {
            (window as any).isTestMode = true;
        }
    }, [isTestMode]);

    const setPlayerMark = useCallback((address: string, mark: 'mafia' | 'civilian' | 'question' | null) => {
        setPlayerMarks(prev => ({
            ...prev,
            [address.toLowerCase()]: mark
        }));
    }, []);

    // === CACHED SESSION WALLET CLIENT: avoid recreating on every TX ===
    // The WalletClient is cached in a ref keyed by privateKey+roomId.
    // nonceManager from viem eliminates eth_getTransactionCount RPC per TX (~200ms saved).
    const sessionClientRef = useRef<{ client: WalletClient; key: string } | null>(null);

    const getSessionWalletClient = useCallback(() => {
        const session = loadSession();
        if (!session || !session.registeredOnChain || Date.now() >= session.expiresAt) {
            return null;
        }

        try {
            // Cache key: if same private key + same room, reuse existing client
            const cacheKey = `${session.privateKey}:${session.roomId}`;
            if (sessionClientRef.current && sessionClientRef.current.key === cacheKey) {
                return sessionClientRef.current.client;
            }

            // SPEED: nonceManager auto-manages nonces locally, eliminating
            // eth_getTransactionCount RPC call before every writeContract (~200ms saved)
            const account = privateKeyToAccount(session.privateKey, { nonceManager });
            console.log(`[Session Debug] Creating new cached client for ${account.address}`);

            // Generate list of fallback transports from all defined RPCs
            const fallbackTransports = runtimeChainRef.current.rpcUrls.default.http.map(url => http(url, {
                // SPEED: Tighter timeout — Somnia RPCs respond in <500ms normally
                timeout: 8_000,
                // SPEED: Batch JSON-RPC — combine multiple calls into single HTTP request
                batch: { batchSize: 20, wait: 16 },
            }));

            const client = createWalletClient({
                account,
                chain: runtimeChainRef.current,
                transport: fallback(fallbackTransports, {
                    rank: {
                        // Automatically rank based on speed to use the fastest responsive RPC
                        interval: 60_000,
                        timeout: 5_000,
                    }
                }),
            });
            sessionClientRef.current = { client, key: cacheKey };
            return client;
        } catch (err) {
            console.error("[Session Debug] Failed to create client:", err);
            return null;
        }
    }, []); // runtimeChainRef.current is stable

    // Helper: sync role secret with server (includes signature verification)
    // FIX #10/#11: Retry with exponential backoff instead of fire-and-forget
    // FIX: Added in-memory guard to prevent concurrent calls (each call triggers MetaMask sign)
    const syncInProgressRef = useRef(false);
    const lastSyncKeyRef = useRef<string>(''); // Track last successful sync to prevent dupes
    const syncSecretWithServer = useCallback(async (roomId: string, playerAddress: string, role: number, salt: string) => {
        // FIX: Dedup — don't re-sync exact same data
        const syncKey = `${roomId}:${playerAddress.toLowerCase()}:${role}:${salt}`;
        if (lastSyncKeyRef.current === syncKey) {
            console.log('[SyncSecret] Already synced this exact data, skipping.');
            return;
        }

        // FIX: Prevent concurrent calls
        if (syncInProgressRef.current) {
            console.log('[SyncSecret] Another sync in progress, skipping.');
            return;
        }
        syncInProgressRef.current = true;

        const MAX_RETRIES = 2;
        let activeWalletClient: any = null;
        try {
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const message = `reveal-secret:${roomId}:${role}:${salt}`;
                    let signature: `0x${string}`;
                    let signerAddress: string = playerAddress;
                    let sessionKeyAddress: string | undefined;

                    // FIX: Use session key to sign (no MetaMask popup!)
                    // Session key is a local private key — signing is instant and invisible.
                    const session = loadSession();
                    if (session && session.registeredOnChain && Date.now() < session.expiresAt &&
                        session.mainWallet.toLowerCase() === playerAddress.toLowerCase()) {
                        const sessionAccount = privateKeyToAccount(session.privateKey);
                        signature = await sessionAccount.signMessage({ message });
                        signerAddress = playerAddress; // Server verifies against main address
                        sessionKeyAddress = sessionAccount.address; // Pass session key for server to verify
                        console.log('[SyncSecret] Signed with session key (no popup)');
                    } else {
                        try {
                            if (!activeWalletClient) {
                                const walletResult = await getActiveWalletClient();
                                activeWalletClient = walletResult.client;
                            }
                            signature = await activeWalletClient.signMessage({ message });
                            console.log('[SyncSecret] Signed with main wallet');
                        } catch (walletErr) {
                            console.warn('[SyncSecret] No wallet available, skipping server sync');
                            return;
                        }
                    }

                    // Compute the on-chain commitment (Poseidon of role+salt) for ZK proof
                    const { ShuffleService } = await import('../services/shuffleService');
                    const commitment = await ShuffleService.createRoleCommitHashAsync(role, salt);

                    const res = await fetch('/api/game/reveal-secret', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomId,
                            address: playerAddress,
                            role,
                            salt,
                            commitment,  // needed by GM server for ZK proof
                            signature,
                            sessionKeyAddress, // optional: server uses this to verify session key sig
                            chainId: runtimeChainRef.current.id,
                        })
                    });
                    if (!res.ok) throw new Error(`Server responded ${res.status}`);
                    console.log(`[Status] Secret synced with server DB (attempt ${attempt}).`);
                    lastSyncKeyRef.current = syncKey;
                    try {
                        localStorage.setItem(`secret_synced_${roomId}_${playerAddress.toLowerCase()}`, 'true');
                        localStorage.removeItem(`pending_sync_${roomId}_${playerAddress.toLowerCase()}`);
                    } catch (_) { }
                    return; // success
                } catch (err) {
                    console.warn(`[SyncSecret] Attempt ${attempt}/${MAX_RETRIES} failed:`, err);
                    if (attempt < MAX_RETRIES) {
                        await new Promise(r => setTimeout(r, 1500 * attempt));
                    } else {
                        console.error('[SyncSecret] All retries exhausted. Secret NOT synced with server!');
                        try {
                            localStorage.setItem(`pending_sync_${roomId}_${playerAddress.toLowerCase()}`, JSON.stringify({ role, salt }));
                        } catch (_) { }
                    }
                }
            }
        } finally {
            syncInProgressRef.current = false;
        }
    }, []); // runtimeChainRef.current.id is used inside, getActiveWalletClient is stable

    const roleCommitSyncInProgressRef = useRef<Set<string>>(new Set());
    const syncRoleCommitToGM = useCallback(async (
        roomId: bigint,
        playerAddress: string,
        txHash: `0x${string}`
    ) => {
        const key = `${roomId.toString()}:${playerAddress.toLowerCase()}:${txHash.toLowerCase()}`;
        if (roleCommitSyncInProgressRef.current.has(key)) return;
        roleCommitSyncInProgressRef.current.add(key);

        const MAX_RETRIES = 2;
        let activeWalletClient: any = null;
        try {
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    // Sign using signRequest so message format matches GM server's
                    // buildRoleSyncMessage: sync-role-commit:${roomId}:${txHash}:${nonce}:${timestamp}
                    if (!activeWalletClient) {
                        const walletResult = await getActiveWalletClient();
                        activeWalletClient = walletResult.client;
                    }

                    const signed = await signRequest({
                        address: playerAddress,
                        roomId: Number(roomId),
                        walletClient: activeWalletClient,
                        buildMessage: ({ nonce, timestamp }) => buildRoleSyncMessage({
                            roomId: roomId.toString(),
                            txHash,
                            nonce,
                            timestamp,
                        }),
                    });

                    const res = await fetch(`${GM_SERVER_URL}/role-commit-sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomId: roomId.toString(),
                            playerAddress,
                            txHash,
                            signature: signed.signature,
                            signerAddress: signed.signerAddress,
                            nonce: signed.nonce,
                            timestamp: signed.timestamp,
                            chainId: runtimeChainRef.current.id.toString(),
                        }),
                    });

                    if (!res.ok) throw new Error(`GM sync failed: ${res.status}`);
                    console.log(`[RoleCommitSync] Synced tx ${txHash} to GM cache`);
                    return;
                } catch (err) {
                    if (attempt < MAX_RETRIES) {
                        await new Promise(r => setTimeout(r, 1200 * attempt));
                    }
                }
            }
        } finally {
            roleCommitSyncInProgressRef.current.delete(key);
        }
    }, []); // Zero-deps for ZK stability on Somnia

    // Wrapper для транзакций - использует session key если доступен
    const sendGameTransaction = useCallback(async (
        functionName: string,
        args: any[],
        useSessionKeyParam: boolean = true // для lobby actions ставим false
    ): Promise<`0x${string}`> => {
        const session = loadSession();
        const roomId = currentRoomIdRef.current;

        // Debug: показываем все условия
        console.log(`[TX Debug] ${functionName}:`, {
            useSessionKeyParam,
            hasSession: !!session,
            registeredOnChain: session?.registeredOnChain,
            expired: session ? Date.now() >= session.expiresAt : 'no session',
            expiresAt: session?.expiresAt,
            now: Date.now(),
            roomId: roomId !== null ? Number(roomId) : null,
            sessionRoomId: session?.roomId,
            sessionAddress: session?.address,
            roomMatch: session && roomId !== null ? session.roomId === Number(roomId) : false,
        });

        // Проверяем можно ли использовать session key
        let canUseSession = useSessionKeyParam &&
            session &&
            session.registeredOnChain &&
            Date.now() < session.expiresAt &&
            roomId !== null &&
            session.roomId === Number(roomId);

        // FIX: For gas-heavy functions (endGameZK), check session key balance
        // If balance is too low, fall back to main wallet to avoid "insufficient balance"
        const currencySymbol = runtimeChainRef.current.nativeCurrency.symbol;
        if (canUseSession && session && publicClientRef.current && ['endGameZK'].includes(functionName)) {
            try {
                const sessionBalance = await publicClientRef.current.getBalance({
                    address: session.address as `0x${string}`
                });
                // SPEED: Reduced threshold to 0.01 (ZK TXs are typically ~0.005 on Somnia, slightly more on Fuji)
                const MIN_BALANCE_FOR_HEAVY_TX = parseEther('0.01');
                if (sessionBalance < MIN_BALANCE_FOR_HEAVY_TX) {
                    console.warn(`[Session TX] Session key balance too low for ${functionName}: ${formatEther(sessionBalance)} ${currencySymbol}. Falling back to main wallet.`);
                    canUseSession = false;
                } else {
                    console.log(`[Session TX] Session key balance OK for ${functionName}: ${formatEther(sessionBalance)} ${currencySymbol}`);
                }
            } catch (balErr) {
                console.warn('[Session TX] Failed to check session balance, proceeding anyway:', balErr);
            }
        }

        console.log(`[TX Debug] Final canUseSession for ${functionName}: ${canUseSession}`);

        // === TEST MODE SIMULATION ===
        if (isTestMode && ['commitNightAction', 'revealNightAction', 'commitMafiaTarget', 'revealMafiaTarget', 'commitRole'].includes(functionName)) {
            console.log(`[Test Mode] Simulating transaction for ${functionName}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
            return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`;
        }

        // Determine which account to use for gas estimation
        const sessionClient = getSessionWalletClient();
        const { client: activeWalletClient, account: activeAccount } = await getActiveWalletClient();
        const accountToUse = (canUseSession && sessionClient) ? sessionClient.account : activeAccount;

        if (!accountToUse || !publicClientRef.current) {
            console.error("[Gas Estimation] Missing account or publicClient.");
            throw new Error("Cannot estimate gas: account or publicClient missing.");
        }

        // === АВТОМАТИЧЕСКИЙ РАСЧЕТ ГАЗА ===
        let calculatedGas = 1_000_000n; // Fallback на случай сбоя оценки
        const txStartTime = performance.now();

        // SPEED FIX: Use known gas price to skip eth_gasPrice RPC call where possible
        // Somnia testnet consistently reports 6 gwei. Avalanche Fuji varies but ~25-30 is safe.
        const CURRENT_GAS_PRICE = runtimeChainRef.current.id === 50312
            ? 6_000_000_000n
            : 30_000_000_000n; // 30 gwei for Fuji/others as safe default

        // SPEED FIX: Known gas limits for heavy functions — skip estimateContractGas
        // These are battle-tested values, estimation adds 500-2000ms latency
        // NOTE: Block gas limit on current chain is 15M — never exceed 14.5M
        // NOTE: revealDeck, shareKeysToAll, endGameZK are NOT listed here because their
        // gas usage varies heavily with player count / deck size. They get dynamically estimated.
        const MAX_BLOCK_GAS = 14_500_000n;
        const KNOWN_GAS_LIMITS: Record<string, bigint> = {
            commitDeck: 1_500_000n,
            commitAndConfirmRole: 1_000_000n,
            commitNightAction: 1_000_000n,
            revealNightAction: 2_000_000n,
            commitMafiaTarget: 1_000_000n,
            revealMafiaTarget: 3_000_000n,
            vote: 1_500_000n,
            startVoting: 4_000_000n,
            finalizeVoting: 8_000_000n,
            forcePhaseTimeout: 8_000_000n,
            mafiaMessage: 1_500_000n,
        };

        const knownLimit = KNOWN_GAS_LIMITS[functionName];
        let useKnownLimit = false;
        if (knownLimit && canUseSession) {
            // Check if session key can actually afford this known limit
            try {
                const sessionAddr = getSessionWalletClient()?.account?.address;
                if (sessionAddr && publicClientRef.current) {
                    const bal = await publicClientRef.current.getBalance({ address: sessionAddr });
                    const cost = knownLimit * CURRENT_GAS_PRICE;
                    if (bal >= cost) {
                        useKnownLimit = true;
                    } else {
                        console.log(`[Gas] Session key balance (${formatEther(bal)} ${currencySymbol}) can't cover known limit ${knownLimit} (cost=${formatEther(cost)} ${currencySymbol}), using estimation instead`);
                    }
                } else {
                    useKnownLimit = false; // Missing data, safer to estimate
                }
            } catch {
                useKnownLimit = false; // RPC error during balance check, safer to estimate
            }
        }

        if (useKnownLimit && knownLimit) {
            // SPEED: Skip gas estimation for session key TXs with known limits
            calculatedGas = knownLimit;
            console.log(`[Gas] Using known limit for ${functionName}: ${calculatedGas} (skipped estimation, saved ~500ms)`);
        } else {
            try {
                console.log(`[Gas] Estimating for ${functionName}...`);
                const estStart = performance.now();

                // 1. Спрашиваем у ноды, сколько нужно газа
                const gasEstimate = await publicClientRef.current.estimateContractGas({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: functionName as any,
                    args: args as any,
                    account: accountToUse,
                });

                const estTime = Math.round(performance.now() - estStart);

                // 2. Добавляем буфер безопасности +50% (x1.5)
                calculatedGas = (gasEstimate * 150n) / 100n;

                // 3. Safety cap - never exceed block gas limit (15M on current chain)
                const safetyCap = 14_500_000n;
                if (calculatedGas > safetyCap) {
                    console.warn(`[Gas] Estimate too high (${calculatedGas}), capping at ${safetyCap} (block gas limit).`);
                    calculatedGas = safetyCap;
                }

                console.log(`[Gas] Estimated for ${functionName}: ${gasEstimate}, With Buffer: ${calculatedGas} (took ${estTime}ms)`);
            } catch (e: any) {
                const errMsg = e?.message || e?.toString() || '';
                // If estimation failed because contract REVERTED, don't waste gas — TX will also revert
                const isContractRevert = errMsg.includes('reverted') || errMsg.includes('revert') ||
                    errMsg.includes('execution reverted') || errMsg.includes('Error:');
                if (isContractRevert) {
                    console.error(`[Gas] Contract revert during estimation for ${functionName} — aborting TX.`, e);
                    throw e; // Don't proceed, TX will definitely fail
                }

                console.warn(`[Gas] Estimation failed for ${functionName} (network error?), using safe fallback.`, e);
                // For session key TXs: cap fallback to what balance can afford
                if (canUseSession && publicClientRef.current && getSessionWalletClient()?.account) {
                    try {
                        const sessionBalance = await publicClientRef.current.getBalance({
                            address: getSessionWalletClient()!.account!.address
                        });
                        // Max gas = 80% of balance / gasPrice (leave 20% buffer)
                        const maxAffordable = (sessionBalance * 80n / 100n) / CURRENT_GAS_PRICE;
                        calculatedGas = maxAffordable > 0n ? maxAffordable : 3_000_000n;
                        console.log(`[Gas] Session key fallback: balance=${formatEther(sessionBalance)} ${currencySymbol}, maxAffordable gas=${calculatedGas}`);
                    } catch (_balErr) {
                        calculatedGas = 3_000_000n; // Very conservative fallback
                    }
                } else if (['revealDeck', 'commitDeck', 'shareKeysToAll', 'createAndJoin', 'joinRoom', 'endGameZK', 'commitAndConfirmRole'].includes(functionName)) {
                    calculatedGas = 14_500_000n; // main wallet can afford more
                } else {
                    calculatedGas = 10_000_000n;
                }
            }
        }

        // === ОТПРАВКА ТРАНЗАКЦИИ ===
        if (canUseSession && sessionClient) {
            console.log(`[Session TX] Sending ${functionName} with gas ${calculatedGas}...`);

            const attemptSend = async (retryCount: number = 0): Promise<`0x${string}`> => {
                const MAX_NONCE_RETRIES = 3; // FIX #7: Multi-attempt nonce retry
                try {
                    const sendStart = performance.now();
                    const hash = await sessionClient.writeContract({
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI as any,
                        functionName: functionName as any,
                        args: args as any,
                        account: sessionClient.account!,
                        chain: runtimeChainRef.current,
                        gas: calculatedGas,
                        gasPrice: CURRENT_GAS_PRICE, // SPEED: Skip eth_gasPrice RPC call
                        type: 'legacy',
                    });
                    const sendTime = Math.round(performance.now() - sendStart);
                    const totalTime = Math.round(performance.now() - txStartTime);
                    console.log(`[Session TX] ✅ ${functionName} sent! Hash: ${hash} (send: ${sendTime}ms, total: ${totalTime}ms)`);
                    return hash;
                } catch (err: any) {
                    const errMsg = err.message || '';
                    if (retryCount < MAX_NONCE_RETRIES && (errMsg.includes('nonce too low') || errMsg.includes('Nonce provided for the transaction is lower') || errMsg.includes('replacement transaction underpriced'))) {
                        console.warn(`[Session TX] Nonce issue for ${functionName} (attempt ${retryCount + 1}/${MAX_NONCE_RETRIES}). Retrying...`);

                        // Wait with exponential backoff
                        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));

                        // Retry - viem will re-fetch nonce from getTransactionCount
                        return attemptSend(retryCount + 1);
                    }
                    console.error('[Session TX] Failed:', err.message || err);
                    throw err;
                }
            };

            // FIX #8/#9: Enqueue session key TXs to prevent nonce collisions
            return enqueueTx(() => attemptSend(0));
        } else {
            // Fallback на основной кошелек (MetaMask или Privy Embedded)
            const totalTime = Math.round(performance.now() - txStartTime);
            console.log(`[Main Wallet TX] ${functionName} - requires signature | Gas: ${calculatedGas} (prep took ${totalTime}ms)`);
            return activeWalletClient.writeContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: functionName as any,
                args: args as any,
                account: activeAccount,
                chain: runtimeChainRef.current,
                gas: calculatedGas,
                type: 'legacy',
            });
        }
    }, [getSessionWalletClient, runtimeContractAddress]); // getActiveWalletClient and isTestMode (ref) are stable // Removed publicClient, address, runtimeChain from deps

    const [gameState, setGameState] = useState<GameState>({
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
    });

    // --- REF SYNC ---
    useEffect(() => { runtimeChainRef.current = runtimeChain; }, [runtimeChain]);
    useEffect(() => { walletsRef.current = wallets; }, [wallets]);
    useEffect(() => { addressRef.current = address; }, [address]);
    useEffect(() => { publicClientRef.current = publicClient; }, [publicClient]);
    useEffect(() => { walletClientRef.current = walletClient; }, [walletClient]);
    useEffect(() => { avatarUrlRef.current = avatarUrl; }, [avatarUrl]);
    useEffect(() => { phaseRef.current = gameState.phase; }, [gameState.phase]);
    useEffect(() => { dayCountRef.current = gameState.dayCount; }, [gameState.dayCount]);

    // Ref for players to avoid stale closure in event handlers
    const playersRef = useRef<Player[]>(gameState.players);
    useEffect(() => {
        playersRef.current = gameState.players;
    }, [gameState.players]);

    const mafiaKeyRef = useRef<CryptoKey | null>(null);
    const mafiaKeyVerifyingRef = useRef(false);

    /**
     * Helper to derive the shared Mafia key using room-specific salt and Mafia members list.
     * Only works if the character is a member of the Mafia and has signed an auth message.
     */
    const getMafiaChatKey = useCallback(async (roomId: bigint): Promise<CryptoKey | null> => {
        if (mafiaKeyRef.current) return mafiaKeyRef.current;
        if (mafiaKeyVerifyingRef.current) return null;

        const roomIdStr = roomId.toString();
        const myAddr = addressRef.current;
        if (!myAddr) return null;

        try {
            mafiaKeyVerifyingRef.current = true;
            // 1. Get or generate salt
            let salt = localStorage.getItem(`mafia_salt_${roomIdStr}`);
            if (!salt) {
                salt = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                localStorage.setItem(`mafia_salt_${roomIdStr}`, salt);
            }

            // 2. Fetch Mafia members from GM
            const { client: activeWalletClient } = await getActiveWalletClient();
            const meta = await signRequest({
                address: myAddr,
                roomId: Number(roomId),
                walletClient: activeWalletClient,
                buildMessage: (inp) => buildMafiaMembersMessage({ roomId: roomIdStr, ...inp })
            });

            const queryParams = new URLSearchParams({
                roomId: roomIdStr,
                playerAddress: meta.signerAddress,
                signature: meta.signature,
                nonce: meta.nonce,
                timestamp: meta.timestamp.toString(),
            });

            const res = await fetch(`/api/game/mafia-members?${queryParams.toString()}`);
            if (!res.ok) {
                const err = await res.json();
                console.warn('[MafiaChat] Failed to fetch teammates:', err.error);
                return null;
            }

            const { mafia } = await res.json() as { mafia: string[] };
            if (!mafia || mafia.length === 0) return null;

            // 3. Derive Key: keccak256(roomId + salt + sortedMafiaAddresses)
            const sortedMafia = [...mafia].map(a => a.toLowerCase()).sort();
            const inputHash = keccak256(encodePacked(
                ['uint256', 'string', 'address[]'],
                [roomId, salt, sortedMafia as `0x${string}`[]]
            ));

            // Use first 32 bytes as AES key
            const keyBytes = new Uint8Array(32);
            for (let i = 0; i < 32; i++) {
                keyBytes[i] = parseInt(inputHash.slice(2 + i * 2, 4 + i * 2), 16);
            }

            const key = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                'AES-GCM',
                false,
                ['encrypt', 'decrypt']
            );

            mafiaKeyRef.current = key;
            return key;
        } catch (e) {
            console.error('[MafiaChat] Key derivation error:', e);
            return null;
        } finally {
            mafiaKeyVerifyingRef.current = false;
        }
    }, [getActiveWalletClient]); // Removed address from deps

    // Fix for "Night Action" flashing before Voting Results:
    // When detecting a transition from VOTING to NIGHT (e.g. via polling), 
    // immediately trigger the Voting Results view.
    const prevPhaseRef = useRef<GamePhase>(gameState.phase);
    useLayoutEffect(() => {
        const prevPhase = prevPhaseRef.current;
        const currentPhase = gameState.phase;

        if (prevPhase === GamePhase.VOTING && currentPhase === GamePhase.NIGHT) {
            setShowVotingResults(true);
            // Auto-hide after 10s (matches PostVotingTransition timer)
            const timer = setTimeout(() => {
                setShowVotingResults(false);
                setVoteMap({}); // Safely clear vote map AFTER results display
            }, 10000);
            return () => clearTimeout(timer);
        }

        prevPhaseRef.current = currentPhase;
    }, [gameState.phase, setShowVotingResults]);

    // Ищем myPlayer: если myPlayerId установлен (тестовый режим), используем его, иначе - адрес кошелька
    const myPlayerById = gameState.myPlayerId
        ? gameState.players.find(p => p.address.toLowerCase() === gameState.myPlayerId?.toLowerCase())
        : null;
    const myPlayerByWallet = gameState.players.find(p => p.address.toLowerCase() === address?.toLowerCase());
    // Приоритет: myPlayerId (тестовый режим) > адрес кошелька
    const myPlayer = myPlayerById || myPlayerByWallet;

    // Effects
    useEffect(() => { localStorage.setItem('playerName', playerName); }, [playerName]);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (currentRoomId) {
                sessionStorage.setItem('currentRoomId', currentRoomId.toString());
                localStorage.setItem('currentRoomId', currentRoomId.toString());
            } else {
                sessionStorage.removeItem('currentRoomId');
                localStorage.removeItem('currentRoomId');
            }
        }
    }, [currentRoomId]);

    // Independent lobby name persistence
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (lobbyName) {
                sessionStorage.setItem('lobbyName', lobbyName);
            }
        }
    }, [lobbyName]);

    // FIX: Clear stored roomId when game ends to prevent stale polling on next visit
    useEffect(() => {
        if (gameState.phase === GamePhase.ENDED) {
            console.log('[Cleanup] Game ended — clearing stored roomId');
            localStorage.removeItem('currentRoomId');
            sessionStorage.removeItem('currentRoomId');
        }
    }, [gameState.phase]);


    // FIXED: Only auto-set myPlayerId from wallet if we're NOT in test mode
    // Test mode sets myPlayerId to a mock address; we shouldn't override it
    useEffect(() => {
        if (!address) return;

        setGameState(prev => {
            // If myPlayerId is already set and matches a player, don't override (test mode)
            const existingPlayer = prev.myPlayerId
                ? prev.players.find(p => p.address.toLowerCase() === prev.myPlayerId?.toLowerCase())
                : null;

            if (existingPlayer) {
                // myPlayerId already matches a player - don't override (test mode is active)
                return prev;
            }

            // No player found for current myPlayerId - use wallet address
            return { ...prev, myPlayerId: address };
        });
    }, [address]);

    // Safety valve: Сброс зависшего спиннера через 60 секунд
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isTxPending) {
            timer = setTimeout(() => {
                console.warn("Transaction timeout - resetting UI state");
                setIsTxPending(false);
                addLog("Transaction taking too long. UI unlocked.", "warning");
            }, 60000); // 60 секунд таймаут
        }
        return () => clearTimeout(timer);
    }, [isTxPending]);

    const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', eventType?: import('../types').GameEventType, eventData?: import('../types').GameEventData) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        setGameState(prev => ({
            ...prev,
            logs: [...prev.logs, { id: Math.random().toString(36).substr(2, 9), timestamp: timeString, message, type, eventType, eventData }]
        }));
    }, []);

    // --- DATA SYNC ---
    // V3 flag constants (must match contract)
    const FLAG_CONFIRMED_ROLE = 1;

    // FIX #12: Retry any pending secret syncs that failed on previous sessions
    // FIX: Only retry ONCE on mount, not every 15 seconds (each call triggers MetaMask popup)
    const recoveryAttemptedRef = useRef<string>(''); // Track which room we already attempted
    useEffect(() => {
        if (!currentRoomId || !addressRef.current || !walletClient) return;
        const myAddr = addressRef.current;

        // FIX: Only attempt recovery ONCE per room (not every mount/re-render)
        const roomKey = `${currentRoomId}_${myAddr.toLowerCase()}`;
        if (recoveryAttemptedRef.current === roomKey) return;

        // Check if already synced
        const syncedKey = `secret_synced_${currentRoomId}_${myAddr.toLowerCase()}`;
        if (localStorage.getItem(syncedKey)) {
            recoveryAttemptedRef.current = roomKey;
            return; // Already synced, no need to retry
        }

        // Mark as attempted regardless of outcome (prevents re-triggering)
        recoveryAttemptedRef.current = roomKey;

        const retryPendingSync = async () => {
            const pendingKey = `pending_sync_${currentRoomId}_${myAddr.toLowerCase()}`;
            const pending = localStorage.getItem(pendingKey);
            if (pending) {
                try {
                    const { role, salt } = JSON.parse(pending);
                    console.log('[Recovery] Retrying pending server sync...');
                    await syncSecretWithServer(currentRoomId.toString(), myAddr, role, salt);
                    localStorage.removeItem(pendingKey);
                    console.log('[Recovery] Pending sync completed successfully.');
                } catch (e) {
                    console.warn('[Recovery] Failed to retry pending sync:', e);
                }
                return;
            }

            // Also try syncing from saved role_salt if no pending entry exists
            const savedSalt = localStorage.getItem(`role_salt_${currentRoomId}_${myAddr.toLowerCase()}`);
            const savedRole = localStorage.getItem(`my_role_${currentRoomId}_${myAddr.toLowerCase()}`);
            if (savedSalt && savedRole && savedRole !== 'UNKNOWN') {
                const roleMap: Record<string, number> = { 'MAFIA': 1, 'DOCTOR': 2, 'DETECTIVE': 3, 'CIVILIAN': 4 };
                const roleNum = roleMap[savedRole];
                if (!roleNum) {
                    console.warn(`[Recovery] Invalid saved role '${savedRole}', skipping sync.`);
                    return;
                }
                try {
                    await syncSecretWithServer(currentRoomId.toString(), myAddr, roleNum, savedSalt);
                    console.log('[Recovery] Role secret synced from localStorage backup.');
                } catch (e) {
                    console.warn('[Recovery] Sync from localStorage failed:', e);
                }
            }
        };

        // Retry ONCE on mount after a short delay (give time for normal flow to complete first)
        const timer = setTimeout(retryPendingSync, 10000);
        return () => clearTimeout(timer);
    }, [currentRoomId, syncSecretWithServer, walletClient]); // Removed address from deps
    const FLAG_ACTIVE = 2;

    // Check win condition on frontend (since contract doesn't know roles)
    const checkWinCondition = useCallback((players: Player[], contractPhase: GamePhase): 'MAFIA' | 'TOWN' | 'DRAW' | null => {
        // Don't check in early phases
        if (contractPhase < GamePhase.DAY) return null;

        const alivePlayers = players.filter(p => p.isAlive);
        if (alivePlayers.length === 0) return 'DRAW';

        let aliveMafia = 0;
        let aliveTown = 0;
        let unknownRoles = 0;

        for (const player of alivePlayers) {
            if (player.role === Role.MAFIA) aliveMafia++;
            else if (player.role === Role.UNKNOWN) unknownRoles++;
            else aliveTown++; // CIVILIAN, DOCTOR, DETECTIVE
        }

        // Can't determine winner if we don't know all roles
        if (unknownRoles > 0) return null;

        // Win conditions:
        // MAFIA wins: mafia >= town
        if (aliveMafia > 0 && aliveMafia >= aliveTown) {
            return 'MAFIA';
        }

        // TOWN wins: no mafia
        if (aliveMafia === 0) {
            return 'TOWN';
        }

        return null; // Game continues
    }, []);

    // Helper to fetch data without updating state (for synchronous checks)
    const fetchGameData = useCallback(async (roomId: bigint) => {
        if (isTestMode || !publicClientRef.current) return null;
        try {
            console.log(`[FetchGameData] Fetching room ${roomId} from ${runtimeContractAddress} on chain ${runtimeChainRef.current.id}`);
            // SPEED: Batch all 3 reads into a single multicall — saves 2 sequential RPC roundtrips (~400-800ms)
            const results = await publicClientRef.current.multicall({
                contracts: [
                    {
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI,
                        functionName: 'getPlayers',
                        args: [roomId],
                    },
                    {
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI,
                        functionName: 'getRoom',
                        args: [roomId],
                    },
                    {
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI,
                        functionName: 'getMafiaConsensus',
                        args: [roomId],
                    },
                ],
                allowFailure: true, // Don't crash entire call if one fails
                blockTag: 'latest',
            });

            // Extract with safety checks
            const playersResult = results[0].status === 'success' ? results[0].result as any[] : [];
            const roomResult = results[1].status === 'success' ? results[1].result : null;
            const mafiaResult = results[2].status === 'success' ? results[2].result as [number, number, string] : [0, 0, '0x0000000000000000000000000000000000000000'];

            if (results[0].status === 'failure') {
                console.error(`[FetchGameData] getPlayers failed:`, results[0].error);
            }
            if (results[1].status === 'failure') {
                console.error(`[FetchGameData] getRoom failed:`, results[1].error);
                return null; // Room is essential
            }

            const data = playersResult;
            const roomData = roomResult as any;
            const [mafiaCommitted, mafiaRevealed] = mafiaResult;

            // Parse Room Data
            let phase: GamePhase;
            let dayCount: number;
            let aliveCount: number;
            let committedCount: number;
            let revealedCount: number;
            let phaseDeadline: number;
            let maxPlayers: number;

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
                phase,
                dayCount,
                aliveCount,
                committedCount,
                revealedCount,
                phaseDeadline,
                mafiaCommittedCount: Number(mafiaCommitted),
                mafiaRevealedCount: Number(mafiaRevealed),
                tournamentId,
                maxPlayers
            };
        } catch (e: any) {
            console.error("[FetchGameData] Error:", e);
            return null;
        }
    }, [isTestMode, runtimeContractAddress]); // Removed publicClient, runtimeChain from deps

    const refreshPlayersList = useCallback(async (roomId: bigint) => {
        const gameData = await fetchGameData(roomId);
        if (!gameData) return;

        const {
            rawPlayers, phase, dayCount, revealedCount,
            mafiaCommittedCount, mafiaRevealedCount, phaseDeadline,
            tournamentId, aliveCount, maxPlayers
        } = gameData;

        // FIX: If rawPlayers is empty (transient RPC issue), skip update to prevent role loss
        if (!rawPlayers || rawPlayers.length === 0) {
            console.warn('[refreshPlayersList] skipping update because rawPlayers is empty (RPC lag?)');
            return;
        }

        // DEBUG: Log current phase from contract (only when phase/day changes to reduce noise)
        const phaseKey = `${phase}:${dayCount}`;
        if (lastPhaseKeyRef.current !== phaseKey) {
            console.log('[Phase Sync]', {
                contractPhase: phase,
                phaseName: GamePhase[phase],
                dayCount
            });
            lastPhaseKeyRef.current = phaseKey;
        }

        // Fetch remote avatars from server (CACHE IF NOT LOBBY)
        let remoteAvatars: Record<string, string> = {};
        const isLobby = phaseRef.current === GamePhase.LOBBY;
        const hasCache = Object.keys(avatarCacheRef.current).length > 0;

        if (isLobby || !hasCache) {
            try {
                const avatarRes = await fetch(`/api/game/avatar?roomId=${roomId.toString()}`);
                if (avatarRes.ok) {
                    const data = await avatarRes.json();
                    remoteAvatars = data.avatars || {};
                    avatarCacheRef.current = remoteAvatars;
                } else {
                    remoteAvatars = avatarCacheRef.current;
                }
            } catch (e) {
                console.warn('[Avatar Sync] Failed to fetch avatars:', e);
                remoteAvatars = avatarCacheRef.current;
            }
        } else {
            remoteAvatars = avatarCacheRef.current;
        }

        setGameState(prev => {
            const existingRoles = new Map<string, Role>();
            prev.players.forEach(p => {
                if (p.role !== Role.UNKNOWN) {
                    existingRoles.set(p.address.toLowerCase(), p.role);
                }
            });

            const formattedPlayers: Player[] = rawPlayers.map((p: any) => {
                const flags = Number(p.flags);
                const existingPlayer = prev.players.find(
                    ep => ep.address.toLowerCase() === p.wallet.toLowerCase()
                );
                const isMe = p.wallet.toLowerCase() === addressRef.current?.toLowerCase();

                // Avatar priority: 1) remote server, 2) existing, 3) local (if me), 4) fallback
                const playerAvatar =
                    remoteAvatars[p.wallet.toLowerCase()] ||
                    existingPlayer?.avatarUrl ||
                    (isMe && avatarUrl) ||
                    `https://picsum.photos/seed/${p.wallet}/200`;

                let resolvedRole = existingRoles.get(p.wallet.toLowerCase()) || Role.UNKNOWN;

                if (isMe && resolvedRole === Role.UNKNOWN && addressRef.current) {
                    const savedRole = localStorage.getItem(`my_role_${roomId}_${addressRef.current.toLowerCase()}`);
                    if (savedRole && Object.values(Role).includes(savedRole as Role)) {
                        resolvedRole = savedRole as Role;
                    }
                }

                // FLAG Constants
                const FLAG_CONFIRMED_ROLE = 1;
                const FLAG_ACTIVE = 2;
                const FLAG_HAS_VOTED = 4;
                const FLAG_HAS_COMMITTED = 8;
                const FLAG_HAS_REVEALED = 16;
                const FLAG_DECK_COMMITTED = 64;

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

            const winner = checkWinCondition(formattedPlayers, phase);
            let finalPhase = phase;
            let resolvedWinner: 'MAFIA' | 'TOWN' | 'DRAW' | null = winner;

            if (winner && phase !== GamePhase.ENDED) {
                console.log('[Win Condition Calculated Local]', winner);
                finalPhase = GamePhase.ENDED;
            }

            // FIX: If contract says ENDED but we can't determine winner locally
            // (e.g. other players' roles are UNKNOWN), trust the contract phase
            // and try to determine winner from alive counts
            if (phase === GamePhase.ENDED && !resolvedWinner) {
                // Check if we already have a winner from a GameEnded event
                if (prev.winner) {
                    resolvedWinner = prev.winner;
                }
            }

            return {
                ...prev,
                players: formattedPlayers,
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
                // prev.winner has absolute priority — never overwrite established winner with null or derivation
                winner: prev.winner || resolvedWinner
            };
        });
        return gameData;
    }, [fetchGameData, checkWinCondition]); // avatarUrlRef used inside

    // === OPTIMISTIC UI: Background TX confirmation ===
    const confirmInBackground = useCallback((
        hash: `0x${string}`,
        functionName: string,
        onReverted?: () => void
    ) => {
        pendingConfirmationsRef.current.add(hash);
        setIsTxConfirming(true);
        (async () => {
            try {
                const receipt = await publicClientRef.current?.waitForTransactionReceipt({ hash });
                if (receipt?.status === 'reverted') {
                    console.error(`[Optimistic] ❌ ${functionName} REVERTED! Rolling back...`);
                    addLog(`${functionName} reverted on-chain. Reverting...`, 'danger');
                    onReverted?.();
                } else {
                    console.log(`[Optimistic] ✅ ${functionName} confirmed (block ${receipt?.blockNumber})`);
                }
                const roomId = currentRoomIdRef.current;
                if (roomId) { await refreshPlayersList(roomId); }
            } catch (err) {
                console.error(`[Optimistic] Receipt check failed for ${functionName}:`, err);
                onReverted?.();
                const roomId = currentRoomIdRef.current;
                if (roomId) { await refreshPlayersList(roomId); }
            } finally {
                pendingConfirmationsRef.current.delete(hash);
                if (pendingConfirmationsRef.current.size === 0) { setIsTxConfirming(false); }
            }
        })();
    }, [addLog, refreshPlayersList]); // Removed publicClient from deps

    const applyOptimisticUpdate = useCallback((updates: Partial<{
        hasVoted: boolean;
        hasDeckCommitted: boolean;
        hasNightCommitted: boolean;
        hasNightRevealed: boolean;
        hasConfirmedRole: boolean;
    }>) => {
        if (!addressRef.current) return;
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(p =>
                p.address.toLowerCase() === addressRef.current!.toLowerCase()
                    ? { ...p, ...updates }
                    : p
            )
        }));
    }, []); // Removed address from deps

    // FIX #14: Debounced refreshPlayersList wrapper
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

    // Initial/Continuous refresh
    useEffect(() => {
        if (!currentRoomId || isTestMode || !publicClientRef.current) return;

        // Initial
        refreshPlayersList(currentRoomId);

        // Continuous
        const interval = setInterval(() => {
            if (!isTxPending) {
                refreshPlayersListDebounced(currentRoomId);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [currentRoomId, isTestMode, isTxPending, refreshPlayersList, refreshPlayersListDebounced]);





    // Local win check is disabled because Town players don't know all roles.
    // We rely on Server-Side "Smart Polling" triggerAutoWinCheck instead.

    // --- LOBBY ACTIONS (V3: createRoom only, then joinRoom with session) ---

    const createLobbyOnChain = useCallback(async (maxPlayers: number = 10, tournamentId: bigint = 0n, nonce?: number): Promise<boolean> => {
        const myAddr = addressRef.current;
        const pClient = publicClientRef.current;
        const targetChain = runtimeChainRef.current;
        const name = playerNameRef.current;
        const lobbyName = lobbyNameRef.current;
        const lobbyPassword = lobbyPasswordRef.current;

        if (!name || !myAddr || !lobbyName || !pClient) { alert("Enter details and connect wallet!"); return false; }
        setIsTxPending(true);
        try {
            const nextId = await pClient.readContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'nextRoomId',
            }) as bigint;
            const newRoomId = Number(nextId) + 1; // Predict next ID
            const isSomnia = (targetChain.id as number) === 5031 || (targetChain.id as number) === 50312;

            // 2. Генерируем ключи
            const keyPair = await generateKeyPair();
            setKeys(keyPair);
            const pubKeyHex = await exportPublicKey(keyPair.publicKey);

            // 3. Сессия
            const { sessionAddress } = createNewSession(myAddr, newRoomId);

            // ✅ ДОБАВИТЬ: Загружаем/генерируем ECIES keypair для этого игрока
            const eciesKp = await loadOrCreateKeypair(newRoomId.toString(), myAddr);
            eciesPrivKeyRef.current = eciesKp.privateKey;

            // Sanitize nickname
            const safeName = /^[a-zA-Z0-9_ ]+$/.test(name) ? name : `Player_${Math.floor(Math.random() * 1000)}`;
            console.log(`[SafeName] Original: "${name}", Used: "${safeName}"`);

            // Get wallet once and reuse
            const { client: activeWalletClient, account: activeAccount } = await getActiveWalletClient();

            if (!pClient || !targetChain || !myAddr) { alert("Public client or chain/address not ready!"); return false; }

            // 4. Оценка газа с буфером
            let gasLimit = isSomnia ? undefined : 5_000_000n;
            try {
                const gasEstimate = await pClient.estimateContractGas({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'createAndJoin',
                    args: [
                        lobbyName,
                        maxPlayers,
                        safeName,
                        pubKeyHex as `0x${string}`,
                        sessionAddress as `0x${string}`,
                        !!lobbyPassword,
                        tournamentId
                    ],
                    account: activeAccount,
                    value: LOBBY_FUNDING_VALUE,
                    nonce,
                });
                gasLimit = (gasEstimate * 125n) / 100n;
                console.log(`[Gas] createAndJoin estimated: ${gasEstimate}, using limit: ${gasLimit}`);
            } catch (e) {
                console.warn('[Gas] createAndJoin estimation failed, using fallback 5M', e);
            }

            // 5. TX: createAndJoin (Atomic v2)
            const hash = await activeWalletClient.writeContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'createAndJoin',
                args: [lobbyName, maxPlayers, safeName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`, !!lobbyPassword, tournamentId],
                account: activeAccount,
                chain: targetChain,
                value: LOBBY_FUNDING_VALUE,
                gas: gasLimit,
                nonce: nonce,
                type: 'legacy',
            });
            const receipt = await pClient.waitForTransactionReceipt({ hash });

            let finalRoomId = BigInt(newRoomId);
            try {
                const logs = parseEventLogs({
                    abi: MAFIA_ABI,
                    eventName: 'RoomCreated',
                    logs: receipt.logs
                });
                if (logs.length > 0) {
                    finalRoomId = (logs[0] as any).args.roomId;
                }
            } catch (e) {
                console.warn("[Lobby] Failed to parse RoomCreated log, falling back to predicted ID", e);
            }

            // Sync session roomId and registration status EARLY
            const session = loadSession();
            if (session) {
                session.roomId = Number(finalRoomId);
                session.registeredOnChain = true;
                localStorage.setItem('somnia_mafia_session', JSON.stringify(session));
            } else {
                markSessionRegistered();
            }

            // 6. IF PRIVATE: Set password on GM server
            if (lobbyPassword) {
                let passwordSet = false;
                for (let attempt = 1; attempt <= 6; attempt++) {
                    const delay = 1000 + (attempt - 1) * 2000;
                    if (attempt > 1) await new Promise(r => setTimeout(r, delay));

                    try {
                        await GM.setRoomPassword({
                            roomId: finalRoomId.toString(),
                            address: myAddr,
                            password: lobbyPassword,
                            walletClient: activeWalletClient,
                            signerAddress: myAddr,
                            chainId: targetChain.id,
                            maxPlayers: maxPlayers,
                            forceWallet: true
                        });
                        passwordSet = true;
                        break;
                    } catch (e: any) {
                        console.warn(`[PrivateRoom] Attempt ${attempt}/6 failed:`, e.message);
                    }
                }
            }

            // ✅ ДОБАВИТЬ: Регистрируем ECIES pubkey на GM сервере (с ретраями)
            let pubkeyRegistered = false;
            for (let attempt = 1; attempt <= 4; attempt++) {
                const delay = 500 + (attempt - 1) * 1500;
                if (attempt > 1) await new Promise(r => setTimeout(r, delay));

                try {
                    await GM.registerEciesPubkey(finalRoomId.toString(), myAddr, activeWalletClient, targetChain.id, true);
                    pubkeyRegistered = true;
                    break;
                } catch (e: any) {
                    console.warn(`[ECIES] Attempt ${attempt}/4 failed:`, e.message);
                }
            }

            setCurrentRoomId(finalRoomId);
            await refreshPlayersList(finalRoomId);

            // Upload avatar to server
            if (avatarUrl && myAddr) {
                try {
                    const signed = await signRequest({
                        address: myAddr,
                        roomId: Number(finalRoomId),
                        walletClient: activeWalletClient,
                        buildMessage: ({ nonce, timestamp }) => buildAvatarMessage({
                            roomId: finalRoomId.toString(),
                            address: myAddr,
                            nonce,
                            timestamp,
                        }),
                    });

                    await fetch('/api/game/avatar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomId: finalRoomId.toString(),
                            address: myAddr,
                            avatar: avatarUrl,
                            signature: signed.signature,
                            signerAddress: signed.signerAddress,
                            nonce: signed.nonce,
                            timestamp: signed.timestamp,
                            chainId: targetChain.id,
                        })
                    });
                    console.log('[Avatar Sync] Avatar uploaded to server');
                } catch (e) {
                    console.warn('[Avatar Sync] Failed to upload avatar:', e);
                }
            }

            addLog("Lobby created successfully!", "success");
            setIsTxPending(false);
            return true;
        } catch (e: any) {
            console.error(e);
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            return false;
        }
    }, [addLog]); // getActiveWalletClient is stable. Removed hook state deps to avoid React Error #300.

    const joinLobbyOnChain = useCallback(async (roomId: bigint | number): Promise<boolean> => {
        const pClient = publicClientRef.current;
        const targetChain = runtimeChainRef.current;
        const myAddr = addressRef.current;
        const name = playerNameRef.current;
        const lobbyPassword = lobbyPasswordRef.current;
        const avatarUrl = avatarUrlRef.current;

        if (!name || !myAddr || !pClient || !targetChain) { alert("Connect wallet and set name first!"); return false; }

        const rId = BigInt(roomId);
        setIsTxPending(true);
        try {
            const { client: activeWalletClient, account: activeAccount } = await getActiveWalletClient();
            
            // Sanitize nickname for join
            const safeName = /^[a-zA-Z0-9_ ]+$/.test(name) ? name : `Player_${Math.floor(Math.random() * 1000)}`;
            console.log(`[SafeName] Join - Original: "${name}", Used: "${safeName}"`);

            // 0. Check abandonment
            const abandoned = JSON.parse(localStorage.getItem('mafia_abandoned_rooms') || '[]');
            if (abandoned.includes(rId.toString())) {
                addLog("You have already left this game session and cannot rejoin.", "danger");
                setIsTxPending(false);
                return false;
            }

            // 1. Generate crypto keys
            const keyPair = await generateKeyPair();
            setKeys(keyPair);
            const pubKeyHex = await exportPublicKey(keyPair.publicKey);

            // 2. Generate session key
            const { sessionAddress } = createNewSession(myAddr, Number(roomId));

            // ✅ ДОБАВИТЬ: ECIES keypair для join
            const eciesKp = await loadOrCreateKeypair(roomId.toString(), myAddr);
            eciesPrivKeyRef.current = eciesKp.privateKey;

            // 3. Check if room is private & get GM signature if needed
            let roomData: any = null;
            let gmSignature: `0x${string}` = '0x';
            try {
                roomData = await pClient.readContract({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'getRoom',
                    args: [BigInt(roomId)],
                }) as any;

                const isPrivate = Array.isArray(roomData) ? Boolean(roomData[18]) : Boolean(roomData.isPrivate);
                if (roomData && isPrivate) {
                    if (!lobbyPassword) {
                        alert("This room is private. Please enter the password.");
                        setIsTxPending(false);
                        return false;
                    }
                    addLog("Requesting join permit (private room)...", "info");
                    gmSignature = await GM.requestJoinPermit({
                        roomId: roomId.toString(),
                        password: lobbyPassword,
                        playerAddress: myAddr,
                        chainId: targetChain.id,
                    });
                    addLog("Join permit received ✅", "success");
                }
            } catch (e: any) {
                console.error("[Join] Error checking room privacy or tournament:", e);
                addLog(`Join permit failed: ${e.message}`, "danger");
                
                // CRITICAL: If it's a private room and we failed to get permit, STOP here
                const isPrivateData = Array.isArray(roomData) ? Boolean(roomData[18]) : Boolean(roomData?.isPrivate);
                if (roomData && isPrivateData) {
                    setIsTxPending(false);
                    alert(`Failed to get join permit: ${e.message}`);
                    return false;
                }
            }

            // 3.1. Determine if deposit is needed (Skip if it's a tournament room)
            const tournamentIdFromRoom = Array.isArray(roomData) ? BigInt(roomData[19] || 0) : BigInt(roomData?.tournamentId || 0);
            const isTournamentRoom = roomData ? tournamentIdFromRoom > 0n : false;
            
            // Tournament participation check for joiner
            if (isTournamentRoom) {
                try {
                    const tournamentResult = await pClient.readContract({
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI,
                        functionName: 'getTournament',
                        args: [tournamentIdFromRoom],
                    }) as any;

                    const buyIn = Array.isArray(tournamentResult) ? BigInt(tournamentResult[3] || 0) : BigInt(tournamentResult.buyIn || 0);
                    if (tournamentResult && buyIn > 0n) {
                        const isPart = await pClient.readContract({
                            address: runtimeContractAddress,
                            abi: MAFIA_ABI,
                            functionName: 'isTournamentParticipant',
                            args: [tournamentIdFromRoom, myAddr as `0x${string}`],
                        }) as boolean;
                        if (!isPart) {
                            addLog(`Joining tournament #${tournamentIdFromRoom} (buy-in: ${formatEther(buyIn)} ${targetChain.nativeCurrency.symbol}) first...`, "info");
                            const joined = await joinTournamentOnChain(tournamentIdFromRoom, "", formatEther(buyIn));
                            if (!joined) {
                                addLog("Tournament join failed or cancelled.", "danger");
                                setIsTxPending(false);
                                return false;
                            }
                            addLog("Tournament joined! Continuing to join room...", "success");
                        }
                    }
                } catch (e: any) {
                    console.error("[Join] Participation check failed:", e);
                }
            }

            const txValue = isTournamentRoom ? 0n : LOBBY_FUNDING_VALUE;
            console.log(`[Join] Tournament status: ${isTournamentRoom}, sending value: ${txValue}`);

            // 3.5. Оценка газа с буфером
            let gasLimit = 14_500_000n;
            try {
                const gasEstimate = await pClient.estimateContractGas({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'joinRoom',
                    args: [BigInt(roomId), safeName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`, gmSignature],
                    account: activeAccount as `0x${string}`,
                    value: txValue,
                });
                gasLimit = (gasEstimate * 150n) / 100n;
                console.log(`[Gas] joinRoom estimated: ${gasEstimate}, with buffer: ${gasLimit}`);
            } catch (e) {
                console.warn('[Gas] joinRoom estimation failed, using fallback', e);
            }

            // 4. Join room with main wallet + fund session key
            const hash = await activeWalletClient.writeContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'joinRoom',
                args: [BigInt(roomId), safeName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`, gmSignature],
                account: activeAccount,
                chain: targetChain,
                value: txValue,
                gas: gasLimit,
                type: 'legacy',
            });
            const joinReceipt = await pClient.waitForTransactionReceipt({ hash });

            // DEBUG: Check deposit collection on join
            try {
                const depositLogs = parseEventLogs({
                    abi: MAFIA_ABI,
                    eventName: 'DepositCollected',
                    logs: joinReceipt.logs
                });
                if (depositLogs.length > 0) {
                    const depArgs = (depositLogs[0] as any).args;
                    console.log(`[Deposit Debug] joinRoom DepositCollected:`, {
                        player: depArgs.player,
                        amount: formatEther(depArgs.amount) + ' STT',
                    });
                } else {
                    console.log(`[Deposit Debug] No DepositCollected in joinRoom receipt.`);
                }
            } catch (e) {
                console.warn('[Deposit Debug] Could not parse join deposit events:', e);
            }

            // 5. Mark session as registered
            markSessionRegistered();

            // ✅ ДОБАВИТЬ: Регистрируем ECIES pubkey на GM сервере
            try {
                await GM.registerEciesPubkey(roomId.toString(), myAddr, activeWalletClient, targetChain.id);
                console.log('[ECIES] Public key registered with GM server');
            } catch (e) {
                console.warn('[ECIES] Failed to register pubkey with GM (non-blocking):', e);
            }

            setCurrentRoomId(BigInt(roomId));
            await refreshPlayersList(BigInt(roomId));

            // Upload avatar to server for other players to see
            if (avatarUrl && myAddr) {
                try {
                    const signed = await signRequest({
                        address: myAddr,
                        roomId: Number(roomId),
                        walletClient: activeWalletClient,
                        buildMessage: ({ nonce, timestamp }) => buildAvatarMessage({
                            roomId: roomId.toString(),
                            address: myAddr,
                            nonce,
                            timestamp,
                        }),
                    });

                    await fetch('/api/game/avatar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomId: roomId.toString(),
                            address: myAddr,
                            avatar: avatarUrl,
                            signerAddress: signed.signerAddress,
                            nonce: signed.nonce,
                            timestamp: signed.timestamp,
                            chainId: targetChain.id,
                        })
                    });
                    console.log('[Avatar Sync] Avatar uploaded to server');
                } catch (e) {
                    console.warn('[Avatar Sync] Failed to upload avatar:', e);
                }
            }

            setIsTxPending(false);
            return true;
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            return false;
        }
    }, []); // ABSOLUTELY STABLE

    // --- SHUFFLE PHASE ---

    const startGameOnChain = useCallback(async () => {
        const pClient = publicClientRef.current;
        const targetChain = runtimeChainRef.current;
        const myAddr = addressRef.current;
        const roomId = currentRoomIdRef.current;

        if (!roomId || !pClient || !myAddr || !targetChain) return;
        setIsTxPending(true);
        try {
            // Оценка газа с буфером
            let gasLimit = 14_500_000n;
            const { client: activeWalletClient, account: activeAccount } = await getActiveWalletClient();
            try {
                const gasEstimate = await pClient.estimateContractGas({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'startGame',
                    args: [roomId],
                    account: activeAccount,
                });
                gasLimit = (gasEstimate * 150n) / 100n;
                console.log(`[Gas] startGame estimated: ${gasEstimate}, with buffer: ${gasLimit}`);
            } catch (e) {
                console.warn('[Gas] startGame estimation failed, using fallback', e);
            }

            const hash = await activeWalletClient.writeContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'startGame',
                args: [roomId],
                account: activeAccount,
                chain: targetChain,
                gas: gasLimit,
                type: 'legacy',
            });
            addLog("Starting game...", "phase");
            // OPTIMISTIC: Release spinner immediately, confirm receipt in background
            setIsTxPending(false);
            confirmInBackground(hash, 'startGame');
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [addLog]); // ABSOLUTELY STABLE. Removed hook state deps.

    // V4: Deck commit-reveal
    const commitDeckOnChain = useCallback(async (deckHash: string): Promise<`0x${string}` | undefined> => {
        const roomId = currentRoomIdRef.current;
        const pClient = publicClientRef.current;
        if (!roomId || !pClient) return undefined;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('commitDeck', [currentRoomId, deckHash]);
            addLog("Deck hash committed! Waiting for confirmation...", "success");
            applyOptimisticUpdate({ hasDeckCommitted: true });

            // CRITICAL: Wait for commit to be confirmed on-chain BEFORE returning.
            // revealDeck will fail with InvalidReveal() if commit isn't mined yet.
            try {
                const receipt = await pClient.waitForTransactionReceipt({ hash });
                if (receipt?.status === 'reverted') {
                    console.error("[commitDeck] ❌ TX reverted on-chain!");
                    applyOptimisticUpdate({ hasDeckCommitted: false });
                    addLog("Commit reverted on-chain!", "danger");
                    throw new Error("commitDeck reverted");
                }
                console.log(`[commitDeck] ✅ Confirmed in block ${receipt?.blockNumber}`);
            } catch (receiptErr) {
                console.error("[commitDeck] Receipt wait failed:", receiptErr);
                applyOptimisticUpdate({ hasDeckCommitted: false });
                throw receiptErr;
            }

            setIsTxPending(false);
            return hash;
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            throw e;
        }
    }, []); // ABSOLUTELY STABLE

    const revealDeckOnChain = useCallback(async (deck: string[], salt: string) => {
        const roomId = currentRoomIdRef.current;
        if (!roomId) return;
        // Strip 0x prefix if present — keep consistent with new salt format
        const cleanSalt = salt.startsWith('0x') ? salt.slice(2) : salt;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('revealDeck', [currentRoomId, deck, cleanSalt]);
            addLog("Deck revealed!", "success");
            // OPTIMISTIC: Release spinner immediately, confirm in background
            setIsTxPending(false);
            confirmInBackground(hash, 'revealDeck');
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            throw e;
        }
    }, []); // ABSOLUTELY STABLE

    // --- REVEAL PHASE (V3: batch share keys) ---

    const shareKeysToAllOnChain = useCallback(async (recipients: string[], encryptedKeys: string[]) => {
        const roomId = currentRoomIdRef.current;
        if (!roomId) return;
        setIsTxPending(true);
        try {
            // V3: shareKeysToAll - one transaction for all keys
            const hash = await sendGameTransaction('shareKeysToAll', [
                currentRoomId,
                recipients,
                encryptedKeys.map(k => k as `0x${string}`) // Convert to bytes
            ]);
            addLog(`Keys shared to ${recipients.length} players!`, "success");
            // OPTIMISTIC: Release spinner immediately, confirm in background
            setIsTxPending(false);
            confirmInBackground(hash, 'shareKeysToAll');
        } catch (e: any) {
            // FIX: If keys were already shared, swallow the error (don't re-throw)
            const errMsg = (e.message || '').toLowerCase() + (e.shortMessage || '').toLowerCase();
            if (errMsg.includes('alreadyshared') || errMsg.includes('keysalreadyshared')) {
                console.log("[shareKeysToAll] Keys already shared on-chain.");
                return; // Not an error, just a no-op
            }
            addLog(e.shortMessage || e.message, "danger");
            throw e; // FIX: Re-throw so caller knows it failed (prevents false hasSharedKeys=true)
        } finally {
            setIsTxPending(false);
        }
    }, []); // ABSOLUTELY STABLE

    // ✅ ДОБАВИТЬ: Расшифровка роли, зашифрованной GM через ECIES
    const decryptMyRoleFromGM = useCallback(async (
        encrypted: EciesEncrypted
    ): Promise<number | null> => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        // Попытка 1: использовать privKey из памяти (текущая сессия)
        let privKey = eciesPrivKeyRef.current;

        // Попытка 2: восстановить из localStorage (после перезагрузки страницы)
        if (!privKey && roomId && myAddr) {
            try {
                const { privateKey } = await loadOrCreateKeypair(roomId.toString(), myAddr);
                privKey = privateKey;
                eciesPrivKeyRef.current = privKey;
                console.log('[ECIES] Private key restored from localStorage');
            } catch (e) {
                console.error('[ECIES] Failed to restore keypair:', e);
                return null;
            }
        }

        if (!privKey) {
            console.error('[ECIES] No private key available for decryption');
            return null;
        }

        try {
            const plaintext = await eciesDecrypt(encrypted, privKey);
            const text = plaintext.trim().toUpperCase();
            // Поддержка обоих форматов: строка ("MAFIA") и число ("1")
            const roleStringMap: Record<string, number> = {
                'MAFIA': 1, 'DOCTOR': 2, 'DETECTIVE': 3, 'CIVILIAN': 4
            };
            const roleNum = roleStringMap[text] ?? parseInt(text, 10);

            if (isNaN(roleNum) || roleNum < 1 || roleNum > 4) {
                console.error('[ECIES] Decrypted value is not a valid role:', plaintext);
                return null;
            }
            console.log('[ECIES] Role decrypted successfully:', text, '->', roleNum);
            return roleNum;
        } catch (e: any) {
            // Suppress noise: OperationError just means it's not our payload (encrypted for someone else)
            if (e instanceof DOMException && e.name === 'OperationError') return null;
            console.error('[ECIES] Decryption failed:', e);
            return null;
        }
    }, []);

    const fetchMyRoleFromGM = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const targetChain = runtimeChainRef.current;
        if (!myAddr || !roomId) return;
        if (roleFetchedRef.current) return; // уже получили
        roleFetchedRef.current = true;

        const tryFetch = async (): Promise<void> => {
            try {
                const { client: activeWalletClient } = await getActiveWalletClient();
                const signed = await signRequest({
                    address: myAddr,
                    roomId: Number(roomId),
                    walletClient: activeWalletClient,
                    buildMessage: ({ nonce, timestamp }) =>
                        `my-role:${roomId}:${myAddr.toLowerCase()}:${nonce}:${timestamp}`,
                });

                const params = new URLSearchParams({
                    playerAddress: myAddr,
                    signature: signed.signature,
                    signerAddress: signed.signerAddress,
                    nonce: signed.nonce,
                    timestamp: String(signed.timestamp),
                    chainId: String(targetChain.id),
                });

                const res = await fetch(
                    `${GM_SERVER_URL}/my-role/${roomId}?${params}`
                );

                if (res.status === 202) {
                    // SRA ключи ещё не все собраны — повтор через 4с
                    console.log('[MyRole] SRA keys not ready, retrying in 4s...');
                    roleFetchedRef.current = false; // разрешить повтор
                    setTimeout(tryFetch, 4000);
                    return;
                }

                if (!res.ok) {
                    console.error('[MyRole] GM responded', res.status);
                    roleFetchedRef.current = false;
                    return;
                }

                const { encrypted } = await res.json();
                const roleNum = await decryptMyRoleFromGM(encrypted);
                if (!roleNum) {
                    roleFetchedRef.current = false;
                    return;
                }

                const roleEnumMap: Record<number, Role> = {
                    1: Role.MAFIA, 2: Role.DOCTOR, 3: Role.DETECTIVE, 4: Role.CIVILIAN
                };
                const myRole = roleEnumMap[roleNum] ?? Role.UNKNOWN;

                // Сохраняем в localStorage (для совместимости с остальными функциями)
                localStorage.setItem(
                    `my_role_${roomId}_${myAddr.toLowerCase()}`,
                    myRole
                );

                // Обновляем state
                setGameState(prev => ({
                    ...prev,
                    players: prev.players.map(p =>
                        p.address.toLowerCase() === myAddr.toLowerCase()
                            ? { ...p, role: myRole }
                            : p
                    ),
                }));

                addLog(`Your role: ${myRole}`, 'success');
                console.log(`[MyRole] ✅ Role set: ${myRole}`);
            } catch (e) {
                console.error('[MyRole] fetchMyRoleFromGM failed:', e);
                roleFetchedRef.current = false;
            }
        };

        await tryFetch();
    }, []); // ABSOLUTELY STABLE

    const commitRoleOnChain = useCallback(async (role: number, salt: string) => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const pClient = publicClientRef.current;
        if (!roomId || !pClient) return;

        const existingSalt = myAddr ? localStorage.getItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`) : null;
        let saltToUse = salt;
        let shouldCommitOnChain = !existingSalt;

        if (existingSalt) {
            saltToUse = existingSalt;
            console.log("Role already committed locally, will attempt server sync.");
        }

        setIsTxPending(true);
        try {
            if (shouldCommitOnChain) {
                try {
                    const { ShuffleService } = await import('../services/shuffleService');
                    const roleHash = await ShuffleService.createRoleCommitHashAsync(role, saltToUse);
                    const txHash = await sendGameTransaction('commitRole', [roomId, roleHash]);
                    addLog("Role committed!", "success");
                    await pClient.waitForTransactionReceipt({ hash: txHash });
                    if (myAddr) {
                        syncRoleCommitToGM(roomId, myAddr, txHash)
                            .catch(err => console.warn('[commitRole] GM role-commit sync failed (non-blocking):', err));
                    }
                    if (myAddr) {
                        localStorage.setItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`, saltToUse);
                    }
                } catch (txErr: any) {
                    if (txErr.message?.includes("AlreadyCommitted") || txErr.message?.includes("AlreadyConfirmed")) {
                        console.log("Role already on-chain, proceeding to server sync.");
                    } else {
                        throw txErr;
                    }
                }
            }

            // ALWAYS save role to localStorage if known, even if we skipped on-chain commit (e.g. recovery)
            let roleEnumStr = "";
            if (role === 1) roleEnumStr = Role.MAFIA;
            else if (role === 2) roleEnumStr = Role.DOCTOR;
            else if (role === 3) roleEnumStr = Role.DETECTIVE;
            else if (role === 4) roleEnumStr = Role.CIVILIAN;

            if (roleEnumStr && myAddr) {
                console.log(`[GameContext] Persisting role ${roleEnumStr} for ${myAddr.toLowerCase()}`);
                localStorage.setItem(`my_role_${roomId}_${myAddr.toLowerCase()}`, roleEnumStr);
            }

            // SYNC WITH SERVER-SIDE DB (for automated win-checking)
            // FIX: Non-blocking — if sign fails (user rejects MetaMask), don't break the commit flow
            if (myAddr) {
                syncSecretWithServer(roomId.toString(), myAddr, role, saltToUse)
                    .catch(err => console.warn('[commitRole] Server sync failed (non-blocking):', err));
            }

            await refreshPlayersList(roomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || "Role commit failed", "danger");
            setIsTxPending(false);
            throw e;
        }
    }, []); // ABSOLUTELY STABLE

    const confirmRoleOnChain = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        if (!roomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('confirmRole', [roomId]);
            addLog("Role confirmed.", "success");
            // OPTIMISTIC: Mark confirmed immediately
            applyOptimisticUpdate({ hasConfirmedRole: true });
            setIsTxPending(false);
            confirmInBackground(hash, 'confirmRole', () => {
                applyOptimisticUpdate({ hasConfirmedRole: false });
            });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, []); // ABSOLUTELY STABLE

    const commitAndConfirmRoleOnChain = useCallback(async (role: number, salt: string) => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const pClient = publicClientRef.current;
        if (!roomId || !pClient) return;

        const savedSalt = myAddr ? localStorage.getItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`) : null;
        let saltToUse = salt;

        // Check if we are already confirmed on chain to avoid redundant txs
        const isConfirmedOnChain = myPlayer?.hasConfirmedRole;

        if (savedSalt) {
            saltToUse = savedSalt;
            console.log("Role already committed locally.");
        }

        let roleEnumStr = "";
        if (role === 1) roleEnumStr = Role.MAFIA;
        else if (role === 2) roleEnumStr = Role.DOCTOR;
        else if (role === 3) roleEnumStr = Role.DETECTIVE;
        else if (role === 4) roleEnumStr = Role.CIVILIAN;

        if (roleEnumStr && myAddr) {
            localStorage.setItem(`my_role_${roomId}_${myAddr.toLowerCase()}`, roleEnumStr);
        }

        setIsTxPending(true);
        try {
            // FIX: If we have a saved salt but NOT confirmed on chain, we must complete the process.
            // If we assume commit was successful (because salt is saved), we try confirmRole.
            // If we don't have salt, we do the full commitAndConfirm.

            if (isConfirmedOnChain) {
                console.log("Role already confirmed on-chain. Skipping transaction, syncing DB only.");
            } else if (savedSalt && !isConfirmedOnChain) {
                console.log("Found local salt but not confirmed on-chain. Attempting `confirmRole` fallback...");
                try {
                    const hash = await sendGameTransaction('confirmRole', [roomId]);
                    addLog("Role confirmed (fallback).", "success");
                    // OPTIMISTIC: confirm in background
                    confirmInBackground(hash, 'confirmRole (fallback)');
                } catch (err: any) {
                    // FIX: If standalone confirmRole fails (role was never committed on-chain),
                    // fall back to full commitAndConfirmRole with the saved salt
                    console.warn("Fallback confirmRole failed — role may never have been committed. Retrying full commitAndConfirmRole...", err.shortMessage || err.message);
                    try {
                        const { ShuffleService } = await import('../services/shuffleService');
                        const roleHash = await ShuffleService.createRoleCommitHashAsync(role, savedSalt);
                        const retryHash = await sendGameTransaction('commitAndConfirmRole', [roomId, roleHash]);
                        addLog("Role committed & confirmed (recovery).", "success");
                        if (myAddr) {
                            syncRoleCommitToGM(roomId, myAddr, retryHash)
                                .catch(err => console.warn('[commitAndConfirm recovery] GM role-commit sync failed (non-blocking):', err));
                        }
                        // OPTIMISTIC: confirm in background
                        confirmInBackground(retryHash, 'commitAndConfirmRole (recovery)');
                    } catch (retryErr: any) {
                        console.error("Full commitAndConfirmRole retry also failed:", retryErr);
                        // Clear stale salt so next attempt goes through normal flow
                        if (myAddr) localStorage.removeItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`);
                        throw retryErr;
                    }
                }
            } else {
                // Normal flow: No salt, not confirmed -> Commit + Confirm
                try {
                    const { ShuffleService } = await import('../services/shuffleService');
                    const roleHash = await ShuffleService.createRoleCommitHashAsync(role, saltToUse);
                    const txHash = await sendGameTransaction('commitAndConfirmRole', [roomId, roleHash]);
                    addLog("Role committed & confirmed on-chain!", "success");
                    if (myAddr) {
                        syncRoleCommitToGM(roomId, myAddr, txHash)
                            .catch(err => console.warn('[commitAndConfirm] GM role-commit sync failed (non-blocking):', err));
                    }
                    // OPTIMISTIC: confirm in background, save salt immediately
                    if (myAddr) localStorage.setItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`, saltToUse);
                    confirmInBackground(txHash, 'commitAndConfirmRole');
                } catch (txErr: any) {
                    const errMsg = (txErr.message || "").toLowerCase();
                    const shortMsg = (txErr.shortMessage || "").toLowerCase();

                    // Check for RoleAlreadyCommitted (revert)
                    if (errMsg.includes("rolealreadycommitted") || shortMsg.includes("rolealreadycommitted") ||
                        errMsg.includes("alreadycommitted") || shortMsg.includes("alreadycommitted")) {

                        console.warn("Role already committed. Checking confirmation status...");

                        // Check if we are already confirmed
                        const flags = await pClient.readContract({
                            address: runtimeContractAddress,
                            abi: MAFIA_ABI,
                            functionName: 'getPlayerFlags',
                            args: [roomId, myAddr as `0x${string}`],
                        }) as unknown as any[]; // returns tuple of bools

                        // Tuple index 1 is hasConfirmedRole (see RoleReveal)
                        // [isActive, hasConfirmedRole, hasVoted, hasCommitted, hasRevealed, hasSharedKeys, hasClaimedMafia]
                        const isConfirmed = flags?.[1];

                        if (!isConfirmed) {
                            console.log("Role committed but NOT confirmed. Calling confirmRole...");
                            addLog("Role previously committed. Confirming now...", "info");
                            // Determine gas for confirmRole
                            const confirmHash = await sendGameTransaction('confirmRole', [roomId]);
                            // OPTIMISTIC: confirm in background
                            confirmInBackground(confirmHash, 'confirmRole (retry)');
                            addLog("Role confirmed separately!", "success");
                        } else {
                            console.log("Role already confirmed on-chain.");
                        }

                    } else if (errMsg.includes("alreadyrevealed") || shortMsg.includes("alreadyrevealed") ||
                        errMsg.includes("alreadyconfirmed") || shortMsg.includes("alreadyconfirmed")) {
                        console.log("Role already confirmed on-chain.");
                    } else {
                        throw txErr;
                    }
                }
            }

            // SYNC WITH SERVER-SIDE DB
            // FIX: Non-blocking — don't let MetaMask sign rejection break the entire confirm flow
            // The on-chain TX already succeeded; server sync is a backup for auto-win checking
            if (myAddr) {
                syncSecretWithServer(roomId.toString(), myAddr, role, saltToUse)
                    .catch(err => console.warn('[commitAndConfirm] Server sync failed (non-blocking):', err));
            }

            // OPTIMISTIC: No blocking refreshPlayersList — confirmInBackground handles refresh
            setIsTxPending(false);
        } catch (e: any) {
            console.error("Confirmation error:", e);
            // FIX: If role is already confirmed/committed, don't throw — this breaks the RoleReveal auto-loop
            const errMsg = (e.message || '').toLowerCase() + (e.shortMessage || '').toLowerCase();
            if (errMsg.includes('alreadycommitted') || errMsg.includes('alreadyconfirmed') || errMsg.includes('alreadyrevealed')) {
                console.log("[commitAndConfirmRole] Role already processed on-chain. Not re-throwing.");
                // Non-blocking server sync attempt
                if (addressRef.current) {
                    syncSecretWithServer(roomId.toString(), addressRef.current, role, saltToUse)
                        .catch(_ => { });
                }
                return; // Swallow the error — role is done
            }
            addLog(e.shortMessage || "Confirmation failed", "danger");
            throw e;
        } finally {
            setIsTxPending(false);
        }
    }, []); // ABSOLUTELY STABLE

    // --- DAY & VOTING ---

    const startVotingOnChain = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        if (!roomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('startVoting', [roomId]);
            // Log comes from VotingStarted event handler (no duplicate)
            // OPTIMISTIC: Release spinner immediately
            setIsTxPending(false);
            confirmInBackground(hash, 'startVoting');
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [addLog]); // ABSOLUTELY STABLE. Removed hook state deps.

    const voteOnChain = useCallback(async (targetAddress: string) => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const players = playersRef.current;
        if (!roomId || !myAddr) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('vote', [roomId, targetAddress]);
            const targetPlayer = players.find(p => p.address.toLowerCase() === targetAddress.toLowerCase());
            const targetName = targetPlayer ? (targetPlayer.name || `Player ${players.indexOf(targetPlayer) + 1}`) : targetAddress.slice(0, 6);
            // OPTIMISTIC: Mark as voted immediately, update vote map
            applyOptimisticUpdate({ hasVoted: true });
            setVoteMap(prev => ({ ...prev, [myAddr.toLowerCase()]: targetAddress.toLowerCase() }));
            
            setIsTxPending(false);
            confirmInBackground(hash, 'vote', () => {
                // Rollback: unmark vote
                applyOptimisticUpdate({ hasVoted: false });
                setVoteMap(prev => {
                    const next = { ...prev };
                    delete next[myAddr.toLowerCase()];
                    return next;
                });
            });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [addLog]); // ABSOLUTELY STABLE. Removed hook state deps.

    // V3: finalizeVoting removed - auto-triggers on last vote

    // --- NIGHT PHASE (GM SERVER API) ---

    const submitNightActionToGM = useCallback(async (
        actionType: 'kill' | 'heal' | 'check',
        targetAddress: string,
        explicitDayCount?: number
    ) => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const targetChain = runtimeChainRef.current;
        const players = playersRef.current;
        const resolvedDayCount = explicitDayCount ?? dayCountRef.current;
        if (!roomId || !myAddr || !targetChain) return;

        setIsTxPending(true);
        try {
            const { client: activeWalletClient } = await getActiveWalletClient();
            console.log(`[GM API] Submitting night action: ${actionType} on ${targetAddress} by ${myAddr}`);

            const savedRole = localStorage.getItem(`my_role_${roomId}_${myAddr.toLowerCase()}`);
            const myPlayer = players.find(p => p.address.toLowerCase() === myAddr.toLowerCase());
            const myRoleStr = savedRole || myPlayer?.role;

            let myRoleNum: number | undefined;
            if (myRoleStr === Role.MAFIA) myRoleNum = 1;
            else if (myRoleStr === Role.DOCTOR) myRoleNum = 2;
            else if (myRoleStr === Role.DETECTIVE) myRoleNum = 3;
            else if (myRoleStr === Role.CIVILIAN) myRoleNum = 4;

            const savedSalt = localStorage.getItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`);

            // SALT BYPASS: Salt is only strictly necessary for on-chain commit-reveal.
            // When using GM off-chain actions, the GM verifies our role by ECIES-resolved mapping.
            // We only throw if myRoleNum is missing (we don't even know who we are).
            if (myRoleNum === undefined) {
                console.error(`[NightAction] Missing role data. RoleNum=${myRoleNum}, savedRole=${savedRole}`);
                addLog("Missing role. Please ensure your role is decrypted.", "danger");
                setIsTxPending(false);
                throw new Error("Missing role for night action submission");
            }

            if (!savedSalt) {
                console.warn(`[NightAction] Salt missing for ${myAddr}, proceeding anyway as GM knows our role.`);
            }

            // Retry with backoff for transient 403/5xx (role commit cache miss on GM)
            let response: Response | undefined;
            let lastError = '';
            for (let attempt = 0; attempt < 3; attempt++) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);
                try {
                    // FIX: Re-sign on every attempt to get a fresh nonce/timestamp
                    const signed = await signRequest({
                        address: myAddr,
                        roomId: Number(roomId),
                        walletClient: activeWalletClient,
                        buildMessage: ({ nonce, timestamp }) => buildNightActionMessage({
                            roomId: roomId.toString(),
                            actionType,
                            targetAddress,
                            dayCount: resolvedDayCount,
                            nonce,
                            timestamp,
                        }),
                    });

                    console.log(`[GM API] Attempt ${attempt + 1}: signature fresh, sending payload`);

                    response = await fetch('/api/game/night-action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomId: roomId.toString(),
                            playerAddress: myAddr,
                            actionType,
                            targetAddress,
                            dayCount: resolvedDayCount,
                            signature: signed.signature,
                            signerAddress: signed.signerAddress,
                            role: myRoleNum,
                            salt: savedSalt,
                            nonce: signed.nonce,
                            timestamp: signed.timestamp,
                            chainId: targetChain.id,
                        }),
                        signal: controller.signal,
                    });

                    if (response.ok) break;

                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    lastError = errorData.error || 'Failed to submit night action';

                    // Only retry on 403 or 5xx
                    if (response.status !== 403 && response.status < 500) {
                        throw new Error(lastError);
                    }

                    if (attempt < 2) {
                        console.warn(`[GM API] Attempt ${attempt + 1} failed (${response.status}: ${lastError}). Retrying...`);
                        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
                    }
                } catch (e: any) {
                    lastError = e.message || 'Network error';
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
                    } else {
                        throw e;
                    }
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            if (!response || !response.ok) {
                throw new Error(lastError || 'Failed after multiple attempts');
            }

            // OPTIMISTIC: Mark committed immediately
            applyOptimisticUpdate({ hasNightCommitted: true });
            addLog(`Submitted ${actionType} action!`, "success");

        } catch (e: any) {
            console.error('[Night Action Failed]', e);
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        } finally {
            setIsTxPending(false);
        }
    }, []); // ABSOLUTELY STABLE (Uses playersRef and dayCount internally)

    const skipNightActionToGM = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const targetChain = runtimeChainRef.current;
        if (!roomId || !myAddr || !targetChain) return;
        setIsTxPending(true);
        try {
            const { client: activeWalletClient } = await getActiveWalletClient();
            await GM.skipNightActionToGM({
                roomId: roomId.toString(),
                address: myAddr,
                walletClient: activeWalletClient,
                chainId: targetChain.id,
                dayCount: dayCountRef.current
            });
            // Mark as acted locally
            applyOptimisticUpdate({ hasNightCommitted: true });
            addLog("Turn skipped.", "info");
        } catch (e: any) {
            addLog(e.message || "Skip failed", "danger");
            throw e;
        } finally {
            setIsTxPending(false);
        }
    }, []); // ABSOLUTELY STABLE

    const fetchInvestigationProofFromGM = useCallback(async (targetAddress: string) => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const targetChain = runtimeChainRef.current;
        if (!roomId || !myAddr || !targetChain) return null;
        try {
            const { client: activeWalletClient } = await getActiveWalletClient();
            return await GM.fetchInvestigationProofFromGM({
                roomId: roomId.toString(),
                detectiveAddress: myAddr,
                targetAddress,
                walletClient: activeWalletClient,
                chainId: targetChain.id,
                dayCount: dayCountRef.current
            });
        } catch (e) {
            console.error('[GM API] Failed to fetch investigation proof:', e);
            return null;
        }
    }, []); // ABSOLUTELY STABLE

    const getInvestigationResultOnChain = useCallback(async (detective: string, target: string) => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const targetChain = runtimeChainRef.current;
        if (isTestMode) {
            // Mock results for Testing
            if (target.toLowerCase().includes('4444')) {
                return { role: Role.MAFIA, isMafia: true };
            }
            return { role: Role.CIVILIAN, isMafia: false };
        }
        if (!roomId) return { role: Role.UNKNOWN, isMafia: false };

        try {
            const { client: activeWalletClient } = await getActiveWalletClient();
            console.log(`[Investigation API] Fetching result for ${detective} -> ${target}`);

            // Use signRequest to generate modern signature with nonce and timestamp
            // signRequest automatically handles session key vs walletClient
            const signed = await signRequest({
                address: detective,
                roomId: Number(roomId),
                walletClient: activeWalletClient,
                buildMessage: ({ nonce, timestamp }) => buildInvestigateMessage({
                    roomId: roomId.toString(),
                    dayCount: dayCountRef.current,
                    targetAddress: target,
                    nonce,
                    timestamp,
                }),
            });

            console.log(`[Investigation API] Signed with ${signed.signerAddress.toLowerCase() === detective.toLowerCase() ? 'main wallet' : 'session key'}: ${signed.signerAddress}`);

            const response = await fetch('/api/game/investigate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: roomId.toString(),
                    detectiveAddress: detective,
                    targetAddress: target,
                    dayCount: dayCountRef.current,
                    signature: signed.signature,
                    signerAddress: signed.signerAddress,
                    nonce: signed.nonce,
                    timestamp: signed.timestamp,
                    chainId: targetChain.id.toString(),
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch investigation result');
            }

            const data = await response.json();
            // ServerStore stores raw role numbers (1=MAFIA, 2=DOCTOR, 3=DETECTIVE, 4=CIVILIAN)
            // Do NOT use ShuffleService.roleNumberToRole — that expects card values with per-room offset
            const rawRole = Number(data.role);
            let role: Role;
            switch (rawRole) {
                case 1: role = Role.MAFIA; break;
                case 2: role = Role.DOCTOR; break;
                case 3: role = Role.DETECTIVE; break;
                case 4: role = Role.CIVILIAN; break;
                default:
                    console.warn(`[Investigation API] Unexpected raw role: ${rawRole}`);
                    role = Role.UNKNOWN;
            }

            return {
                role,
                isMafia: data.isMafia
            };
        } catch (e: any) {
            console.error('[Investigation API Failed]', e);
            addLog(`Investigation failed: ${e.message}`, "danger");
            return { role: Role.UNKNOWN, isMafia: false };
        }
    }, []); // ABSOLUTELY STABLE

    const forcePhaseTimeoutOnChain = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        const targetChain = runtimeChainRef.current;
        const pClient = publicClientRef.current;
        if (!roomId || !pClient) return;
        setIsTxPending(true);

        try {
            // GM Server Night Resolution interception
            if (phaseRef.current === GamePhase.NIGHT) {
                console.log(`[GM API] Resolving night manually...`);
                let signature: `0x${string}`;
                let callerAddress: string;

                if (!myAddr) {
                    throw new Error('No wallet for signing');
                }

                const { client: activeWalletClient } = await getActiveWalletClient();
                const signed = await signRequest({
                    address: myAddr,
                    roomId: Number(roomId),
                    walletClient: activeWalletClient,
                    buildMessage: ({ nonce, timestamp }) => buildResolveNightMessage({
                        roomId: roomId.toString(),
                        nonce,
                        timestamp,
                    }),
                });
                signature = signed.signature;
                callerAddress = signed.signerAddress;

                const res = await fetch('/api/game/resolve-night', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: roomId.toString(),
                        playerAddress: myAddr,
                        signature,
                        callerAddress,
                        nonce: signed.nonce,
                        timestamp: signed.timestamp,
                        chainId: targetChain.id,
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    const gmError = String(err?.error || 'GM resolve failed');

                    // Fallback path: if GM has no actions to resolve, force timeout on-chain
                    // so NIGHT still progresses to DAY instead of stalling.
                    // Also fallback if GM TX failed (insufficient gas etc)
                    if (
                        gmError.includes('No night actions submitted') ||
                        gmError.includes('No valid night actions from alive players') ||
                        gmError.includes('gas required') ||
                        gmError.includes('insufficient funds') ||
                        gmError.includes('Execution reverted')
                    ) {
                        console.warn('[GM API] No actions or GM TX failed, falling back to on-chain forcePhaseTimeout');
                        addLog('GM cannot resolve night. Forcing timeout on-chain...', 'warning');

                        const fallbackHash = await sendGameTransaction('forcePhaseTimeout', [roomId]);
                        await pClient.waitForTransactionReceipt({ hash: fallbackHash });
                        await refreshPlayersList(roomId);
                        return;
                    }

                    // Already resolved on server side — just refresh UI state.
                    if (gmError.includes('Night already resolved')) {
                        await refreshPlayersList(roomId);
                        return;
                    }

                    throw new Error(gmError);
                }

                addLog("Night resolved by GM!", "success");
                await refreshPlayersList(roomId);
                return;
            }

            // Normal On-chain timeout for other phases
            addLog("Forcing phase timeout on-chain...", "info");
            const hash = await sendGameTransaction('forcePhaseTimeout', [roomId]);
            await pClient.waitForTransactionReceipt({ hash });
            addLog("Phase timeout forced on-chain!", "success");
            await refreshPlayersList(roomId);
        } catch (e: any) {
            console.error('[Force Phase Timeout Failed]', e);
            addLog(e.shortMessage || e.message, "danger");
        } finally {
            setIsTxPending(false);
        }
    }, []); // ABSOLUTELY STABLE (Uses gameState.phase from Ref if available... Wait! I need phaseRef)

    // --- MAFIA CHAT (V4) ---

    // Load chat messages from contract
    const fetchMafiaChat = useCallback(async (roomId: bigint) => {
        const pClient = publicClientRef.current;
        if (!pClient) return;
        try {
            const messages = await pClient.readContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'getMafiaChat',
                args: [roomId]
            }) as any[];

            // Import helper locally to avoid closure issues if possible, or use from top level
            // We need hexToString from services/cryptoUtils

            const formattedMessages: MafiaChatMessage[] = await Promise.all(messages.map(async (msg: any, index: number) => {
                const hexContent = msg.encryptedMessage as string;
                let content = { type: 'text' as const, text: '' };

                try {
                    // Try to decrypt if we are Mafia
                    const myAddr = addressRef.current;
                    const isMafia = playersRef.current.some(p => p.address.toLowerCase() === myAddr?.toLowerCase() && p.role === Role.MAFIA);
                    
                    let decryptedStr = '';
                    if (isMafia && hexContent.length > 24) { // 12 bytes IV = 24 hex chars
                        const key = await getMafiaChatKey(roomId);
                        if (key) {
                            try {
                                const fullBytes = new Uint8Array(
                                    hexContent.startsWith('0x') ? 
                                    hexContent.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)) :
                                    hexContent.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
                                );
                                
                                // Last 12 bytes are IV
                                const iv = fullBytes.slice(-12);
                                const ciphertext = fullBytes.slice(0, -12);
                                
                                const decrypted = await crypto.subtle.decrypt(
                                    { name: 'AES-GCM', iv },
                                    key,
                                    ciphertext
                                );
                                decryptedStr = new TextDecoder().decode(decrypted);
                            } catch (decError) {
                                // Decryption failed, might be old plaintext message
                                console.debug('[MafiaChat] Decryption failed (old message?):', decError);
                            }
                        }
                    }

                    let str = '';
                    if (decryptedStr) {
                        str = decryptedStr;
                    } else if (hexContent.startsWith('0x')) {
                        const hex = hexContent.slice(2);
                        for (let i = 0; i < hex.length; i += 2) {
                            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
                        }
                    } else {
                        str = hexContent;
                    }

                    // Try parsing JSON
                    if (str.trim().startsWith('{')) {
                        content = JSON.parse(str);
                    } else {
                        content = { type: 'text', text: str };
                    }
                } catch (e) {
                    content = { type: 'text', text: hexContent };
                }

                // Resolve sender name — FIX #19: use playersRef to avoid stale closure
                const senderPlayer = playersRef.current.find(p => p.address.toLowerCase() === msg.sender.toLowerCase());
                const playerName = senderPlayer?.name || msg.sender.slice(0, 6);

                return {
                    id: `${index}-${msg.timestamp}`,
                    sender: msg.sender,
                    playerName,
                    content,
                    timestamp: Number(msg.timestamp) * 1000
                };
            }));

            setGameState(prev => ({ ...prev, mafiaMessages: formattedMessages }));
        } catch (e) {
            console.error("Error fetching mafia chat:", e);
        }
    }, [setGameState]); // FIX #19: Removed gameState.players from deps — use playersRef inside

    const sendMafiaMessageOnChain = useCallback(async (content: MafiaChatMessage['content']) => {
        const roomId = currentRoomIdRef.current;
        const myAddr = addressRef.current;
        if (!roomId) return;

        const myPlayer = playersRef.current.find(p => p.address.toLowerCase() === myAddr?.toLowerCase());
        const isMafia = myPlayer?.role === Role.MAFIA;
        
        // Inline stringToHex
        let hexData = '0x' as `0x${string}`;

        if (isMafia) {
            const key = await getMafiaChatKey(roomId);
            if (key) {
                try {
                    const jsonStr = JSON.stringify(content);
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const encrypted = await crypto.subtle.encrypt(
                        { name: 'AES-GCM', iv },
                        key,
                        new TextEncoder().encode(jsonStr)
                    );
                    
                    const encryptedBytes = new Uint8Array(encrypted);
                    const fullBytes = new Uint8Array(encryptedBytes.length + iv.length);
                    fullBytes.set(encryptedBytes);
                    fullBytes.set(iv, encryptedBytes.length);
                    
                    hexData = ('0x' + Array.from(fullBytes)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('')) as `0x${string}`;
                } catch (encErr) {
                    console.error('[MafiaChat] Encryption failed, falling back to plaintext:', encErr);
                }
            }
        }

        if (hexData === '0x') {
            const jsonStr = JSON.stringify(content);
            for (let i = 0; i < jsonStr.length; i++) {
                hexData += jsonStr.charCodeAt(i).toString(16).padStart(2, '0');
            }
        }

        // ⚡ INSTANT: Broadcast to other Mafia members via LiveKit (~50ms)
        // We broadcast ONLY if it's encrypted (mafia-to-mafia) or if it's the only way
        if (myAddr && roomId) {
            emitGameSignal({
                type: 'MAFIA_CHAT',
                sender: myAddr,
                encryptedData: hexData,
                roomId: roomId.toString()
            });
        }

        try {
            const hash = await sendGameTransaction('mafiaMessage', [roomId, hexData]);
            // OPTIMISTIC: Add message to local state immediately
            if (myAddr) {
                const playerForMatch = playersRef.current.find(p => p.address.toLowerCase() === myAddr.toLowerCase());
                setGameState(prev => ({
                    ...prev,
                    mafiaMessages: [...prev.mafiaMessages, {
                        id: `optimistic-${Date.now()}`,
                        sender: myAddr,
                        playerName: playerForMatch?.name || myAddr.slice(0, 6),
                        content,
                        timestamp: Date.now(),
                    }]
                }));
            }
            // Background: confirm + refresh chat from chain
            confirmInBackground(hash, 'mafiaMessage');
        } catch (e: any) {
            addLog(`Chat failed: ${e.shortMessage || e.message}`, "danger");
            throw e;
        }
    }, [addLog]); // ABSOLUTELY STABLE

    const handleIncomingMafiaSignal = useCallback(async (sender: string, encryptedHex: string) => {
        const roomId = currentRoomIdRef.current;
        if (!roomId) return;
        try {
            const key = await getMafiaChatKey(roomId);
            if (!key) return;
            const fullBytes = new Uint8Array(
                encryptedHex.startsWith('0x') ?
                    encryptedHex.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)) :
                    encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
            );
            const iv = fullBytes.slice(-12);
            const ciphertext = fullBytes.slice(0, -12);
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
            const decryptedStr = new TextDecoder().decode(decrypted);
            if (decryptedStr.trim().startsWith('{')) {
                const content = JSON.parse(decryptedStr);
                const senderPlayer = playersRef.current.find(p => p.address.toLowerCase() === sender.toLowerCase());
                setGameState(prev => {
                    const signalId = `signal-${sender}-${Date.now()}`;
                    const isDuplicate = prev.mafiaMessages.slice(-5).some(m => 
                        m.sender.toLowerCase() === sender.toLowerCase() && 
                        JSON.stringify(m.content) === JSON.stringify(content)
                    );
                    if (isDuplicate) return prev;
                    return {
                        ...prev,
                        mafiaMessages: [...prev.mafiaMessages, {
                            id: signalId,
                            sender,
                            playerName: senderPlayer?.name || sender.slice(0, 6),
                            content,
                            timestamp: Date.now(),
                        }]
                    };
                });
            }
        } catch (e) {
            console.warn('[MafiaSignaling] Failed to decrypt signal:', e);
        }
    }, [setGameState]);

    
    // ==================== TOURNAMENTS ====================

    const createTournamentOnChain = useCallback(async (params: {
        name: string;
        buyIn: string;
        maxPlayers: number;
        playersPerTable: number;
        password?: string;
        paymentToken: `0x${string}`;
        initialPrize: string;
        nonce?: number;
    }): Promise<bigint | null> => {
        const pClient = publicClientRef.current;
        const targetChain = runtimeChainRef.current;
        if (!pClient || !targetChain) return null;
        try {
            setIsTxPending(true);
            const { client, account } = await getActiveWalletClient();

            // Handle password hash
            let passwordHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
            if (params.password) {
                passwordHash = keccak256(toHex(params.password));
            }

            const isNative = params.paymentToken === '0x0000000000000000000000000000000000000000';
            const buyInUnits = parseEther(params.buyIn);
            const initialPrizeUnits = parseEther(params.initialPrize);
            const value = isNative ? initialPrizeUnits : 0n;

            // Gas Estimation
            let gasLimit = 600000n; 
            try {
                gasLimit = await pClient.estimateContractGas({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'createTournament',
                    args: [
                        params.name,
                        buyInUnits,
                        params.maxPlayers,
                        params.playersPerTable,
                        passwordHash,
                        params.paymentToken,
                        initialPrizeUnits
                    ],
                    account,
                    value,
                    nonce: params.nonce
                });
                gasLimit = (gasLimit * 120n) / 100n;
            } catch (e) {
                console.warn("[CreateTournament Gas] Estimation failed, using fallback:", e);
            }

            const hash = await client.writeContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'createTournament',
                nonce: params.nonce,
                args: [
                    params.name,
                    buyInUnits,
                    params.maxPlayers,
                    params.playersPerTable,
                    passwordHash,
                    params.paymentToken,
                    initialPrizeUnits
                ],
                account,
                value,
                gas: gasLimit,
                chain: targetChain,
            });

            addLog(`Tournament ${params.name} created!`, 'success');
            setIsTxConfirming(true);
            const receipt = await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);

            if (receipt) {
                const logs = parseEventLogs({
                    abi: MAFIA_ABI,
                    eventName: 'TournamentCreated',
                    logs: receipt.logs
                });

                if (logs.length > 0) {
                    return (logs[0] as any).args.tournamentId;
                }
            }
            return null;
        } catch (error) {
            console.error('Failed to create tournament:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Creation failed: ${msg.slice(0, 60)}...`, 'danger');
            return null;
        } finally {
            setIsTxPending(false);
        }
    }, [addLog]); // ABSOLUTELY STABLE

    const joinTournamentOnChain = useCallback(async (tournamentId: bigint, password?: string, amount?: string, nonce?: number): Promise<boolean> => {
        const pClient = publicClientRef.current;
        const targetChain = runtimeChainRef.current;
        if (!pClient || !targetChain) return false;
        try {
            setIsTxPending(true);
            const { client, account } = await getActiveWalletClient();
            const value = amount ? parseEther(amount) : 0n;

            // Gas Estimation
            let gasLimit = 400000n; 
            try {
                gasLimit = await pClient.estimateContractGas({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'joinTournament',
                    args: [tournamentId, password || ""],
                    account,
                    value,
                    nonce
                });
                gasLimit = (gasLimit * 120n) / 100n;
            } catch (e) {
                console.warn("[JoinTournament Gas] Estimation failed, using fallback:", e);
            }

            const hash = await client.writeContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'joinTournament',
                args: [tournamentId, password || ""],
                account,
                value,
                nonce,
                gas: gasLimit,
                chain: targetChain,
            });

            addLog(`Joined tournament #${tournamentId}`, 'success');
            setIsTxConfirming(true);
            await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);
            return true;
        } catch (error) {
            console.error('Failed to join tournament:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Join failed: ${msg.slice(0, 60)}...`, 'danger');
            return false;
        } finally {
            setIsTxPending(false);
        }
    }, [addLog]); // ABSOLUTELY STABLE

    const distributePrizesOnChain = useCallback(async (roomId: bigint) => {
        const pClient = publicClientRef.current;
        const targetChain = runtimeChainRef.current;
        if (!pClient || !targetChain) return;
        try {
            setIsTxPending(true);
            const { client, account } = await getActiveWalletClient();
            const hash = await client.writeContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'distributeMafiaPrizes',
                args: [roomId],
                account,
                chain: targetChain,
            });

            addLog(`Prizes distributed for room #${roomId}`, 'success');
            setIsTxConfirming(true);
            await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);
        } catch (error) {
            console.error('Failed to distribute prizes:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Distribution failed: ${msg.slice(0, 60)}...`, 'danger');
        } finally {
            setIsTxPending(false);
        }
    }, [addLog]); // ABSOLUTELY STABLE

    const cancelTournamentOnChain = useCallback(async (tournamentId: bigint) => {
        const pClient = publicClientRef.current;
        const targetChain = runtimeChainRef.current;
        if (!pClient || !targetChain) return;
        try {
            setIsTxPending(true);
            const { client, account } = await getActiveWalletClient();
            const hash = await client.writeContract({
                address: runtimeContractAddress,
                abi: MAFIA_ABI,
                functionName: 'cancelTournament',
                args: [tournamentId],
                account,
                chain: targetChain,
            });

            addLog(`Tournament #${tournamentId} cancelled & refunded`, 'info');
            setIsTxConfirming(true);
            await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);
        } catch (error) {
            console.error('Failed to cancel tournament:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Cancellation failed: ${msg.slice(0, 60)}...`, 'danger');
        } finally {
            setIsTxPending(false);
        }
    }, [addLog]); // ABSOLUTELY STABLE




    // FIX #19: Polling for Mafia Chat — use refs to avoid re-creation on every player list change
    const isMafiaRef = useRef(false);
    const gamePhaseRef = useRef(gameState.phase);
    useEffect(() => {
        const myAddr = address?.toLowerCase();
        isMafiaRef.current = playersRef.current.some(
            p => p.address.toLowerCase() === myAddr && p.role === Role.MAFIA
        );
        gamePhaseRef.current = gameState.phase;
    }, [gameState.players, gameState.phase, address]);

    useEffect(() => {
        if (!currentRoomId || !publicClient) return;

        const CHECK_INTERVAL = 3000;
        const roomIdForChat = currentRoomId; // capture

        const interval = setInterval(() => {
            if (isMafiaRef.current && gamePhaseRef.current >= GamePhase.DAY) {
                fetchMafiaChat(roomIdForChat);
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [fetchMafiaChat]);



    // Finalize voting day (elimination)
    const finalizeVotingOnChain = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        const pClient = publicClientRef.current;
        if (!roomId || !pClient) return;
        try {
            const hash = await sendGameTransaction('finalizeVoting', [roomId]);
            addLog("Voting finalized!", "success");
            await pClient.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        }
    }, []); // ABSOLUTELY STABLE

    // Helper to convert Role enum to number for contract
    const getRoleNumber = (role: Role): number => {
        switch (role) {
            case Role.MAFIA: return 1;
            case Role.DOCTOR: return 2;
            case Role.DETECTIVE: return 3;
            case Role.CIVILIAN: return 4;
            default: return 0; // NONE or UNKNOWN
        }
    };



    // V4: ZK End Game (Client generates proof of win)
    // V4: ZK End Game (Client generates proof of win via Server API)
    const endGameZK = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        const pClient = publicClientRef.current;
        const myAddr = addressRef.current;
        if (!roomId || !pClient || !myAddr) return;

        // --- 1. COORDINATION LOGIC ("Waterfall") ---
        // Sort active players by address to have a deterministic order
        const activePlayers = gameState.players
            .filter(p => p.isAlive)
            .sort((a, b) => a.address.localeCompare(b.address));

        const myIndex = activePlayers.findIndex(p => p.address.toLowerCase() === myAddr.toLowerCase());

        // If I am not found (shouldn't happen if alive), default to 0
        const delayIndex = myIndex >= 0 ? myIndex : 0;

        // Delay: 1st player = 0s, 2nd = 15s, 3rd = 30s...
        const delayMs = delayIndex * 15000;

        if (delayMs > 0) {
            console.log(`[ZK] Designated Submitter: I am #${delayIndex + 1}. Waiting ${delayMs / 1000}s before submission...`);
            addLog(`Waiting turn to submit proof (${delayMs / 1000}s)...`, "info");
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // FIX #6: Re-verify game state after delay — someone else may have ended it
            try {
                const freshRoom = await pClient.readContract({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'getRoom',
                    args: [roomId],
                }) as any;
                const currentPhase = Number(Array.isArray(freshRoom) ? freshRoom[3] : freshRoom.phase);
                if (currentPhase === GamePhase.ENDED) {
                    console.log('[ZK] Game already ended by another player. Aborting.');
                    addLog('Game already ended by another player.', 'info');
                    return;
                }
            } catch (e) {
                console.warn('[ZK] Could not re-verify game state, proceeding anyway:', e);
            }
        }

        setIsTxPending(true);
        addLog("Verifying victory conditions...", "info");

        try {
            // 1. Local counts
            let mCount = 0;
            let tCount = 0;
            gameState.players.forEach(p => {
                if (p.isAlive) {
                    if (p.role === Role.MAFIA) mCount++;
                    else tCount++;
                }
            });

            console.log("[ZK] Requesting proof for Room:", roomId.toString());

            // 2. Fetch Proof
            const zkData = await generateEndGameProof(roomId, mCount, tCount);

            console.log("[ZK] Proof received. Simulating transaction...");

            // 3. Form args
            const args = [
                roomId,
                zkData.a,
                zkData.b,
                zkData.c,
                zkData.inputs
            ] as const;

            // 4. Simulate
            try {
                await pClient.simulateContract({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'endGameZK',
                    args: args as any,
                    account: myAddr,
                });
                console.log("[ZK] Simulation SUCCESS");
            } catch (simError: any) {
                console.error("[ZK] Simulation FAILED:", simError.shortMessage || simError.message);
                throw new Error("Contract rejected the proof. Check log for details.");
            }

            // 5. DECIDE WALLET (Session vs Main)
            let useSessionKey = false;
            const session = loadSession();
            if (session && session.registeredOnChain && Date.now() < session.expiresAt && session.roomId === Number(roomId)) {
                useSessionKey = true;
                console.log(`[ZK] Using session key for endGameZK.`);
            }

            // 6. Send Transaction
            console.log(`[ZK] Sending transaction (Session: ${useSessionKey})...`);
            const hash = await sendGameTransaction('endGameZK', args as any, useSessionKey);

            const isTownWin = Number(zkData.inputs[0]) === 1;
            const isMafiaWin = Number(zkData.inputs[1]) === 1;
            
            let proactiveWinner: 'MAFIA' | 'TOWN' | 'DRAW' = 'DRAW';
            if (isTownWin) proactiveWinner = 'TOWN';
            else if (isMafiaWin) proactiveWinner = 'MAFIA';
            
            await pClient.waitForTransactionReceipt({ hash });
            
            setGameState(prev => ({
                ...prev,
                phase: GamePhase.ENDED,
                winner: proactiveWinner
            }));

            await refreshPlayersList(roomId);

            // DEBUG: Check deposit status after game end
            if (myAddr) {
                try {
                    const [deposit, room] = await Promise.all([
                        pClient.readContract({
                            address: runtimeContractAddress,
                            abi: MAFIA_ABI,
                            functionName: 'getPlayerDeposit',
                            args: [roomId, myAddr],
                        }) as Promise<bigint>,
                        pClient.readContract({
                            address: runtimeContractAddress,
                            abi: MAFIA_ABI,
                            functionName: 'getRoom',
                            args: [roomId],
                        }) as Promise<any>,
                    ]);
                    const depositPool = Array.isArray(room) ? room[room.length - 2] : room.depositPool;
                    const depositPerPlayer = Array.isArray(room) ? room[room.length - 1] : room.depositPerPlayer;
                    console.log(`[Deposit Debug] After endGameZK:`, {
                        myDeposit: formatEther(deposit) + ' STT',
                        depositPool: formatEther(depositPool) + ' STT',
                        depositPerPlayer: formatEther(depositPerPlayer) + ' STT',
                        canClaimRefund: deposit > 0n,
                        autoRefunded: deposit === 0n,
                    });
                    if (deposit === 0n) {
                        console.log(`[Deposit Debug] ✅ Contract AUTO-REFUNDED deposit during endGameZK. No manual claimRefund needed.`);
                    }
                } catch (depErr) {
                    console.warn('[Deposit Debug] Failed to check deposit after endGameZK:', depErr);
                }
            }

        } finally {
            setIsTxPending(false);
        }
    }, []); // ABSOLUTELY STABLE (Uses playersRef and other Refs inside)

    /**
     * TRIGGER AUTO WIN: A silent background check that pings the server
     * to see if a win condition has been met (since server knows all roles).
     */
    const triggerAutoWinCheck = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        const pClient = publicClientRef.current;
        const myAddr = addressRef.current;
        if (!roomId || !pClient) return;

        // FIX #23: Guard the entire check (including server fetch) with a ref
        if (checkWinInProgressRef.current) {
            console.log('[AutoWin] Check already in progress, skipping.');
            return;
        }
        checkWinInProgressRef.current = true;

        try {
            console.log(`[AutoWin] Checking for victory in Room #${roomId}...`);
            const response = await fetch('/api/game/check-win', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: roomId.toString() })
            });

            if (!response.ok) return;

            const data = await response.json();
            if (data.winDetected) {
                const { formatted } = data;
                const proofRoomId = formatted.inputs[2];

                if (BigInt(proofRoomId) !== BigInt(roomId)) {
                    console.warn(`[AutoWin] Room ID mismatch: Frontend=${roomId}, Proof=${proofRoomId}`);
                    return;
                }

                const formattedProof = {
                    a: [BigInt(formatted.a[0]), BigInt(formatted.a[1])],
                    b: [
                        [BigInt(formatted.b[0][0]), BigInt(formatted.b[0][1])],
                        [BigInt(formatted.b[1][0]), BigInt(formatted.b[1][1])]
                    ],
                    c: [BigInt(formatted.c[0]), BigInt(formatted.c[1])],
                    inputs: formatted.inputs.map((s: string) => BigInt(s)) as [bigint, bigint, bigint, bigint, bigint]
                };

                // DEBUG LOGGING
                console.log("[AutoWin ZK Debug] === endGameZK via AutoWin ===");
                console.log("[AutoWin ZK Debug] Room ID:", roomId.toString());
                console.log("[AutoWin ZK Debug] Result:", data.result);

                const args = [
                    roomId,
                    formattedProof.a,
                    formattedProof.b,
                    formattedProof.c,
                    formattedProof.inputs
                ] as const;

                // LOCK ONLY BEFORE SUBMITTING (use ref to avoid stale closure)
                if (autoWinLockRef.current) {
                    console.log("[AutoWin] Win detected, but another transaction is pending. Retrying shortly...");
                    return;
                }
                autoWinLockRef.current = true;
                setIsTxPending(true);

                // DECIDE WALLET (Session vs Main)
                let useSessionKey = false;
                const session = loadSession();
                if (session && session.registeredOnChain && Date.now() < session.expiresAt && session.roomId === Number(roomId)) {
                    useSessionKey = true;
                    console.log(`[AutoWin] Using session key for endGameZK.`);
                }

                const simulationAccount = useSessionKey ? (session!.address as `0x${string}`) : myAddr;

                // SIMULATE CONTRACT FIRST
                try {
                    await pClient.simulateContract({
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI,
                        functionName: 'endGameZK',
                        args: args as any,
                        account: simulationAccount,
                    });
                    console.log(`[AutoWin ZK Debug] Simulation SUCCESS (Session: ${useSessionKey})`);
                } catch (simErr: any) {
                    console.error("[AutoWin ZK Debug] Simulation FAILED!");
                    console.error("Reason:", simErr.reason || simErr.shortMessage || "Unknown revert");
                    console.error("Full Error:", simErr);
                    throw new Error(simErr.shortMessage || simErr.message || "Simulation failed");
                }

                addLog(`Auto-Win: ${data.result} detected! Ending game...`, "success");

                try {
                    // Send via session key if available, otherwise main wallet
                    console.log(`[AutoWin] Sending endGameZK (Session: ${useSessionKey})...`);
                    const hash = await sendGameTransaction('endGameZK', args as any, useSessionKey);

                    await pClient.waitForTransactionReceipt({ hash });
                    
                    // Proactively set winner from server result
                    const lowerRes = (data.result || '').toLowerCase();
                    const resolvedWinner: 'MAFIA' | 'TOWN' | 'DRAW' = 
                        lowerRes.includes('town') ? 'TOWN' :
                        lowerRes.includes('mafia') ? 'MAFIA' : 
                        'TOWN';
                    
                    setGameState(prev => ({
                        ...prev,
                        phase: GamePhase.ENDED,
                        winner: resolvedWinner
                    }));

                    addLog("Game ended automatically via Server ZK!", "phase");
                    await refreshPlayersList(roomId);

                    // DEBUG: Check deposit status after AutoWin endGame
                    if (myAddr) {
                        try {
                            const [deposit, room] = await Promise.all([
                                pClient.readContract({
                                    address: runtimeContractAddress,
                                    abi: MAFIA_ABI,
                                    functionName: 'getPlayerDeposit',
                                    args: [roomId, myAddr],
                                }) as Promise<bigint>,
                                pClient.readContract({
                                    address: runtimeContractAddress,
                                    abi: MAFIA_ABI,
                                    functionName: 'getRoom',
                                    args: [roomId],
                                }) as Promise<any>,
                            ]);
                            const depositPool = Array.isArray(room) ? room[room.length - 2] : room.depositPool;
                            const depositPerPlayer = Array.isArray(room) ? room[room.length - 1] : room.depositPerPlayer;
                            console.log(`[Deposit Debug] After AutoWin endGameZK:`, {
                                myDeposit: formatEther(deposit) + ' STT',
                                depositPool: formatEther(depositPool) + ' STT',
                                depositPerPlayer: formatEther(depositPerPlayer) + ' STT',
                                canClaimRefund: deposit > 0n,
                            });
                        } catch (depErr) {
                            console.warn('[Deposit Debug] Failed to check deposit after AutoWin:', depErr);
                        }
                    }
                } catch (txErr: any) {
                    console.error("[AutoWin ZK Debug] Transaction FAILED:", txErr);
                    addLog(`Auto-Win Failed: ${txErr.shortMessage || txErr.message}`, "danger");
                } finally {
                    autoWinLockRef.current = false;
                    setIsTxPending(false);
                }
            } else if (data.message && data.message !== 'Game continues') {
                // Log diagnostic messages if they aren't just "Game continues"
                console.log(`[AutoWinCheck] ${data.message}`);
            }
        } catch (e) {
            console.warn("[AutoWin] Silent check failed:", e);
        } finally {
            checkWinInProgressRef.current = false; // FIX #23: Always release
        }
    }, [sendGameTransaction, addLog, refreshPlayersList]);


    // --- UTILITY ---

    // V4: forcePhaseTimeout - kicks stalled player and advances phase
    const kickStalledPlayerOnChain = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        if (!roomId) return;
        // Delegate to forcePhaseTimeoutOnChain which handles GM Server interception for night phase
        await forcePhaseTimeoutOnChain();
    }, [forcePhaseTimeoutOnChain]);

    // --- UNIFIED EVENT POLLING (REAL-TIME VIA WEBSOCKET/SMART POLLER) ---
    // [CRITICAL OPTIMIZATION] Replaced interval polling with useWatchBlockNumber.
    // Reason: Somnia produces blocks every 100ms. We listen for new blocks via WS
    // and fetch events immediately. This enables sub-second reaction times.
    // The 'Smart Poller' logic (fromBlock->toBlock) remains to guarantee no data loss.

    const processedEventsRef = useRef<Set<string>>(new Set());
    const lastProcessedBlockRef = useRef<bigint | null>(null);

    // Initial block fetch on mount
    useEffect(() => {
        const roomId = currentRoomIdRef.current;
        const pClient = publicClientRef.current;
        if (!pClient || !roomId || lastProcessedBlockRef.current) return;
        pClient.getBlockNumber().then(b => {
            // Start from slightly earlier to catch immediate events? No, start from 'now'.
            // Actually, to be safe, maybe currentBlock - 1?
            // But existing logic was "start from now".
            lastProcessedBlockRef.current = b;
            console.log(`[Smart Poller] 🚀 Started for Room ${roomId} @ Block ${b}`);
        });
    }, []);

    // The polling function - stable reference
    const pollEvents = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        const pClient = publicClientRef.current;
        if (!pClient || !roomId || !lastProcessedBlockRef.current) return;

        try {
            const currentBlock = await pClient.getBlockNumber();

            // Don't poll if no new blocks (unlikely on Somnia)
            if (currentBlock < lastProcessedBlockRef.current) return;

            // 1. Fetch ALL logs for this room in one request
            // We use low-level topics filtering: [topic0=null (any event), topic1=roomId]
            const roomIdTopic = pad(toHex(roomId), { size: 32 });

            const MAX_BLOCK_RANGE = 500n; // Somnia/Fuji safe limit
            let allRawLogs: any[] = [];
            let chunkFrom = lastProcessedBlockRef.current!;

            while (chunkFrom <= currentBlock) {
                const chunkTo = chunkFrom + MAX_BLOCK_RANGE > currentBlock
                    ? currentBlock
                    : chunkFrom + MAX_BLOCK_RANGE;

                const chunk = await pClient.getLogs({
                    address: runtimeContractAddress,
                    // topics: [null, roomIdTopic] fallback for Somnia/Fuji nodes that might handle null poorly
                    topics: [
                        null, // Keep null for now as we don't have all hashes easily here, but ensure ID is stable
                        roomIdTopic
                    ],
                    fromBlock: chunkFrom,
                    toBlock: chunkTo
                } as any);

                allRawLogs = [...allRawLogs, ...chunk];
                chunkFrom = chunkTo + 1n;
            }
            const rawLogs = allRawLogs;

            // 2. Parse logs using viem
            const parsedLogs = parseEventLogs({
                abi: MAFIA_ABI,
                logs: rawLogs
            });

            // 3. Process events
            let hasChanges = false;
            for (const log of parsedLogs) {
                const txHash = log.transactionHash;
                const logId = `${txHash}-${log.logIndex}`; // Unique ID per event

                if (processedEventsRef.current.has(logId)) continue;

                // Memory Optimization: Prevent infinite growth of processedEvents set
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

                // --- EVENT HANDLERS SWITCH ---
                // FIX: All event cases now just set hasChanges=true and add logs.
                // refreshPlayersList is called ONCE at the end of the poll cycle.
                switch (eventName) {
                    case 'PlayerJoined':
                        break;

                    case 'GameStarted':
                        break;

                    case 'DayStarted':
                        addLog(`Day ${args.dayNumber} has begun`, "phase");
                        break;

                    case 'VotingStarted':
                        addLog("Voting Phase Started", "phase", 'VOTING_STARTED');
                        break;

                    case 'NightStarted':
                        // Log moved to VotingFinalized timeout
                        break;

                    case 'NightFinalized':
                        if (args.killed && args.killed !== '0x0000000000000000000000000000000000000000') {
                            const killedStr = (args.killed as string).toLowerCase();
                            const healedStr = args.healed ? (args.healed as string).toLowerCase() : '0x00';

                            // If Doctor saved the Mafia target, nobody dies
                            if (killedStr === healedStr) {
                                addLog("Night Result: No one died last night.", "success", 'NIGHT_RESULT', { isSafe: true });
                            } else {
                                let killedPlayer = playersRef.current.find(p => p.address.toLowerCase() === killedStr);

                                if (!killedPlayer) {
                                    console.warn("[NightFinalized] Killed player missing locally. Will refresh.");
                                }

                                const name = killedPlayer?.name || args.killed.slice(0, 6);
                                addLog(`Night Result: ${name} was killed by Mafia!`, "danger", 'NIGHT_RESULT', { isEliminated: true, playerName: name });
                            }
                        } else {
                            // No mafia target at all
                            addLog("Night Result: No one died last night.", "success", 'NIGHT_RESULT', { isSafe: true });
                        }
                        // Note: Don't log "Doctor saved" publicly — reveals doctor's role
                        break;

                    case 'PlayerEliminated': {
                        const elimStr = (args.player as string).toLowerCase();
                        const elimPlayer = playersRef.current.find(p => p.address.toLowerCase() === elimStr);
                        const elimName = elimPlayer?.name || args.player?.slice(0, 6) || "Unknown";
                        if (args.reason !== 'Killed at night') {
                            addLog(`${elimName} eliminated: ${args.reason}`, "danger");
                        }
                        break;
                    }

                    case 'GameEnded': {
                        const winCondition = args.winCondition as string || '';
                        const lower = winCondition.toLowerCase();
                        
                        // ✅ ROBUST PARSING: Explicitly check for both sides.
                        // We prioritize TOWN check as fallback to match user's recommended pattern.
                        const gameWinner: 'MAFIA' | 'TOWN' | 'DRAW' = 
                            lower.includes('town') ? 'TOWN' : 
                            lower.includes('mafia') ? 'MAFIA' : 
                            lower.includes('draw') ? 'DRAW' :
                            'TOWN'; // Final fallback
                        
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

                            // Use ref for local lookup to avoid stale closure
                            const voter = playersRef.current.find(p => p.address.toLowerCase() === voterStr);
                            const target = playersRef.current.find(p => p.address.toLowerCase() === targetStr);

                            const voterName = voter?.name || args.voter.slice(0, 6);
                            const targetName = target?.name || args.target.slice(0, 6);

                            addLog(`${voterName} voted for ${targetName}`, "info", 'PLAYER_VOTED', { playerName: voterName, targetName });

                            // Update the global vote map so other players' votes become visible immediately
                            setVoteMap(prev => ({ ...prev, [voterStr]: targetStr }));
                        } catch (e) {
                            console.error("[VoteCast] Error logging:", e);
                        }
                        break;

                    case 'VotingFinalized':
                        if (args.eliminated !== '0x0000000000000000000000000000000000000000') {
                            const elimStr = (args.eliminated as string).toLowerCase();
                            const elimPlayer = playersRef.current.find(p => p.address.toLowerCase() === elimStr);
                            const elimName = elimPlayer?.name || (args.eliminated as string).slice(0, 6) || "Unknown";
                            addLog(`Voting Finalized: ${elimName} was eliminated!`, "danger", 'VOTING_RESULT', { isEliminated: true, playerName: elimName });
                        } else {
                            addLog(`Voting Finalized: No one was eliminated.`, "warning", 'VOTING_RESULT', { isSafe: true });
                        }

                        // NEW: Trigger Voting Results Phase (10s delay with cancellation ref)
                        console.log("[VotingFinalized] Triggering 10s results phase...");
                        setShowVotingResults(true);

                        if (votingFinalizedTimerRef.current) clearTimeout(votingFinalizedTimerRef.current);
                        votingFinalizedTimerRef.current = setTimeout(() => {
                            console.log("[VotingFinalized] Results phase ended. Proceeding to Night.");
                            setShowVotingResults(false);
                            addLog("Night has fallen...", "night", 'NIGHT_FALLS');
                            // Clear votes directly at the end of the results phase
                            setVoteMap({});
                            votingFinalizedTimerRef.current = null;
                        }, 10000); // 10 seconds

                        break;
                }
            }

            // FIX: Batch refresh — call refreshPlayersList ONCE per poll cycle, not per event
            if (hasChanges && roomId) {
                refreshPlayersListDebounced(roomId);
            }

            // Advance block cursor
            lastProcessedBlockRef.current = currentBlock + 1n;

        } catch (e) {
            console.error("[Smart Poller] Error:", e);
        }
    }, [addLog, refreshPlayersListDebounced]); // Using pClientRef and roomId (ref) inside

    // FIX: Poll events every 2 seconds instead of on every block (Somnia: 100ms blocks = 10 calls/sec!)
    // This reduces RPC spam from ~20 calls/sec to 1 call/2sec while keeping sub-3s event latency.
    // IMPORTANT: Do NOT stop polling when phase=ENDED but winner is still unknown.
    // There is a race where refreshPlayersList sets phase=ENDED before pollEvents
    // processes the GameEnded event (which carries winCondition). If we stop too early,
    // winner stays null and those players see infinite loading on the GameOver screen.
    useEffect(() => {
        if (!publicClientRef.current || !currentRoomId) return;
        // Only stop if we have reached the end of the game AND have a winner confirmed
        if (gameState.phase === GamePhase.ENDED && gameState.winner) return;

        const interval = setInterval(pollEvents, 2000);
        return () => clearInterval(interval);
    }, [pollEvents, currentRoomId, gameState.phase, gameState.winner]);





    // Check if current player can act on target
    const canActOnPlayer = useCallback((target: Player) => {
        // Must be alive to act
        if (!myPlayer?.isAlive) return false;

        // Target must be alive
        if (!target.isAlive) return false;

        // NEW: Player cannot target themselves in any action (voting or night)
        if (target.address.toLowerCase() === myPlayer?.address.toLowerCase()) {
            return false;
        }

        if (gameState.phase === GamePhase.VOTING) {
            return true;
        }

        if (gameState.phase === GamePhase.NIGHT) {
            // Block everything if already committed
            if (myPlayer?.hasNightCommitted) return false;

            // Only roles with night abilities can act
            const myRole = myPlayer?.role;
            if (myRole === Role.MAFIA || myRole === Role.DETECTIVE || myRole === Role.DOCTOR) {
                // NEW: Mafia cannot target other Mafia members
                if (myRole === Role.MAFIA && target.role === Role.MAFIA) {
                    return false;
                }

                // All night roles are now blocked from targeting self by the check above
                return true;
            }
            return false; // Civilians cannot act at night
        }

        return false;
    }, [gameState.phase, gameState.players]); // Removed myPlayer dependency, use it from players inside? No, keep it or use ref for myPlayer if it flickers. Wait, gameState is okay because it doesn't cause #300 alone.


    // Helper для UI - works for both VOTING and NIGHT phases
    const handlePlayerAction = useCallback((targetId: `0x${string}`) => {
        const targetPlayer = gameState.players.find(p => p.address.toLowerCase() === targetId.toLowerCase());
        if (!targetPlayer || !canActOnPlayer(targetPlayer)) {
            console.log("Action not allowed on this player");
            return;
        }

        if (gameState.phase === GamePhase.VOTING || gameState.phase === GamePhase.NIGHT) {
            setSelectedTarget(prev => prev === targetId ? null : targetId);
        } else {
            console.log("Cannot select player in this phase");
        }
    }, [gameState.phase, gameState.players, canActOnPlayer]);

    // Запрашиваем зашифрованную роль от GM при переходе в фазу DAY (первый день)
    const prevPhaseForRoleRef = useRef<GamePhase>(GamePhase.LOBBY);
    useEffect(() => {
        const prev = prevPhaseForRoleRef.current;
        const curr = gameState.phase;
        prevPhaseForRoleRef.current = curr;

        if (curr === GamePhase.DAY && prev !== GamePhase.DAY) {
            setTimeout(() => {
                fetchMyRoleFromGM();
            }, 2000);
        }
    }, [gameState.phase, fetchMyRoleFromGM]);

    const getActionLabel = useCallback(() => {
        if (gameState.phase === GamePhase.VOTING) return "VOTE";
        if (gameState.phase === GamePhase.NIGHT) return "TARGET";
        return "SELECT";
    }, [gameState.phase]);

    const contextValue = useMemo<GameContextType>(() => ({
        playerName, setPlayerName, avatarUrl, setAvatarUrl, lobbyName, setLobbyName,
        gameState, setGameState, isTxPending, isTxConfirming, currentRoomId,
        createLobbyOnChain, joinLobbyOnChain,
        startGameOnChain, commitDeckOnChain, revealDeckOnChain,
        shareKeysToAllOnChain, commitRoleOnChain, confirmRoleOnChain,
        commitAndConfirmRoleOnChain,
        startVotingOnChain, voteOnChain,
        submitNightActionToGM,
        skipNightActionToGM,
        fetchInvestigationProofFromGM,
        getInvestigationResultOnChain, syncSecretWithServer, 
        finalizeVotingOnChain, endGameZK, forcePhaseTimeoutOnChain,
        sendMafiaMessageOnChain, handleIncomingMafiaSignal, getMafiaChatKey,
        kickStalledPlayerOnChain, refreshPlayersList,
        addLog, handlePlayerAction, myPlayer, canActOnPlayer, getActionLabel,
        selectedTarget, setSelectedTarget,
        showVotingResults, setShowVotingResults,
        isTestMode, setIsTestMode,
        setIsTxPending,
        playerMarks, setPlayerMark,
        voteMap, setVoteMap,
        runtimeContractAddress,
        currencySymbol: runtimeChain.nativeCurrency.symbol,
        setCurrentRoomId,
        decryptMyRoleFromGM,
        lobbyPassword,
        setLobbyPassword,
        createTournamentOnChain,
        joinTournamentOnChain,
        distributePrizesOnChain,
        cancelTournamentOnChain,
        publicClient,
        address
    }), [
        playerName, avatarUrl, lobbyName, gameState, isTxPending, isTxConfirming, currentRoomId,
        createLobbyOnChain, joinLobbyOnChain, startGameOnChain,
        commitDeckOnChain, revealDeckOnChain, shareKeysToAllOnChain,
        commitRoleOnChain, confirmRoleOnChain, commitAndConfirmRoleOnChain,
        startVotingOnChain, voteOnChain, submitNightActionToGM,
        skipNightActionToGM, fetchInvestigationProofFromGM,
        getInvestigationResultOnChain, finalizeVotingOnChain, forcePhaseTimeoutOnChain,
        endGameZK, syncSecretWithServer, sendMafiaMessageOnChain,
        handleIncomingMafiaSignal, getMafiaChatKey,
        kickStalledPlayerOnChain, refreshPlayersList, addLog,
        handlePlayerAction, myPlayer, canActOnPlayer, getActionLabel,
        isTestMode, setIsTestMode,
        selectedTarget,
        showVotingResults, setShowVotingResults,
        playerMarks, setPlayerMark,
        voteMap, setVoteMap,
        runtimeChain.nativeCurrency.symbol,
        setCurrentRoomId,
        decryptMyRoleFromGM,
        lobbyPassword,
        setLobbyPassword,
        createTournamentOnChain,
        joinTournamentOnChain,
        distributePrizesOnChain,
        cancelTournamentOnChain,
        publicClient,
        address
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
