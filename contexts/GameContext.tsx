"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { useAccount, useWriteContract, usePublicClient, useWatchContractEvent } from 'wagmi';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GamePhase, GameState, Player, Role, LogEntry, MafiaChatMessage } from '../types';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI, somniaChain } from '../contracts/config';
import { generateKeyPair, exportPublicKey } from '../services/cryptoUtils';
import { loadSession, createNewSession, markSessionRegistered } from '../services/sessionKeyService';
import { generateEndGameProof } from '../services/zkProof';
import { ShuffleService } from '../services/shuffleService';

const shotSound = "/assets/mafia_shot.mp3";

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
    currentRoomId: bigint | null;
    selectedTarget: `0x${string}` | null;
    setSelectedTarget: (target: `0x${string}` | null) => void;

    // Lobby
    createLobbyOnChain: () => Promise<void>;
    joinLobbyOnChain: (roomId: number) => Promise<void>;

    // Shuffle (V4: commit-reveal)
    startGameOnChain: () => Promise<void>;
    commitDeckOnChain: (deckHash: string) => Promise<void>;
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
    commitNightActionOnChain: (hash: string) => Promise<void>;
    revealNightActionOnChain: (action: number, target: `0x${string}`, salt: string) => Promise<void>;

    revealRoleOnChain: (role: number, salt: string) => Promise<void>;
    tryEndGame: () => Promise<void>;
    claimVictory: () => Promise<void>;
    sendMafiaMessageOnChain: (content: MafiaChatMessage['content']) => Promise<void>;
    // Mafia consensus kill (V4)
    commitMafiaTargetOnChain: (targetHash: string) => Promise<void>;
    revealMafiaTargetOnChain: (target: `0x${string}`, salt: string) => Promise<void>;
    forcePhaseTimeoutOnChain: () => Promise<void>;
    endGameAutomaticallyOnChain: () => Promise<void>;
    endGameZK: () => Promise<void>;
    getInvestigationResultOnChain: (detective: string, target: string) => Promise<{ role: Role; isMafia: boolean }>;
    setCurrentRoomId: (id: bigint | null) => void;

    // Utility
    kickStalledPlayerOnChain: () => Promise<void>;
    refreshPlayersList: (roomId: bigint) => Promise<void>;
    // Mafia Chat

    addLog: (message: string, type?: LogEntry['type']) => void;
    handlePlayerAction: (targetId: `0x${string}`) => void;
    myPlayer: Player | undefined;
    getActionLabel: () => string;
    canActOnPlayer: (target: Player) => boolean;
    setIsTestMode: (val: boolean) => void;
    isTestMode: boolean;
    setIsTxPending: (val: boolean) => void;
    playerMarks: Record<string, 'mafia' | 'civilian' | 'question' | null>;
    setPlayerMark: (address: string, mark: 'mafia' | 'civilian' | 'question' | null) => void;
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
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [lobbyName, setLobbyName] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lobbyName') || '';
        }
        return '';
    });
    const [currentRoomId, setCurrentRoomId] = useState<bigint | null>(() => {
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem('currentRoomId');
            return stored ? BigInt(stored) : null;
        }
        return null;
    });
    const [keys, setKeys] = useState<CryptoKeyPair | null>(null);
    const [selectedTarget, setSelectedTarget] = useState<`0x${string}` | null>(null);

    // Ref для currentRoomId чтобы избежать проблем с замыканием в callbacks
    const currentRoomIdRef = useRef<bigint | null>(currentRoomId);
    useEffect(() => {
        currentRoomIdRef.current = currentRoomId;
    }, [currentRoomId]);

    // Web3
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [isTxPending, setIsTxPending] = useState(false);
    const [isTestMode, setIsTestMode] = useState(false);
    const [playerMarks, setPlayerMarks] = useState<Record<string, 'mafia' | 'civilian' | 'question' | null>>({});

    const setPlayerMark = useCallback((address: string, mark: 'mafia' | 'civilian' | 'question' | null) => {
        setPlayerMarks(prev => ({
            ...prev,
            [address.toLowerCase()]: mark
        }));
    }, []);

    // Функция для получения session wallet client (вызывается при каждой транзакции)
    const getSessionWalletClient = useCallback(() => {
        const session = loadSession();
        if (!session || !session.registeredOnChain || Date.now() >= session.expiresAt) {
            return null;
        }

        try {
            const account = privateKeyToAccount(session.privateKey);
            console.log(`[Session Debug] Client created for ${account.address}`);
            return createWalletClient({
                account,
                chain: somniaChain,
                transport: http(),
            });
        } catch (err) {
            console.error("[Session Debug] Failed to create client:", err);
            return null;
        }
    }, []);

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
        const canUseSession = useSessionKeyParam &&
            session &&
            session.registeredOnChain &&
            Date.now() < session.expiresAt &&
            roomId !== null &&
            session.roomId === Number(roomId);

        console.log(`[TX Debug] Final canUseSession for ${functionName}: ${canUseSession}`);

        // === TEST MODE SIMULATION ===
        if (isTestMode && ['commitNightAction', 'revealNightAction', 'commitMafiaTarget', 'revealMafiaTarget', 'commitRole'].includes(functionName)) {
            console.log(`[Test Mode] Simulating transaction for ${functionName}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
            return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`;
        }

        // Determine which account to use for gas estimation
        const sessionClient = getSessionWalletClient();
        const accountToUse = (canUseSession && sessionClient) ? sessionClient.account : address;

        if (!accountToUse || !publicClient) {
            console.error("[Gas Estimation] Missing account or publicClient.");
            throw new Error("Cannot estimate gas: account or publicClient missing.");
        }

        // === АВТОМАТИЧЕСКИЙ РАСЧЕТ ГАЗА ===
        let calculatedGas = 1_000_000n; // Fallback на случай сбоя оценки

        try {
            console.log(`[Gas] Estimating for ${functionName}...`);

            // 1. Спрашиваем у ноды, сколько нужно газа
            const gasEstimate = await publicClient.estimateContractGas({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: functionName as any,
                args: args as any,
                account: accountToUse,
            });

            // 2. Добавляем буфер безопасности +50% (x1.5)
            calculatedGas = (gasEstimate * 150n) / 100n;

            // 3. Safety cap - if gas is crazy (revert symptom), don't scare MetaMask
            const safetyCap = functionName === 'endGameZK' ? 150_000_000n : 30_000_000n;
            if (calculatedGas > safetyCap) {
                console.warn(`[Gas] Estimate too high (${calculatedGas}), capping at ${safetyCap} to avoid balance error (likely contract revert).`);
                calculatedGas = safetyCap;
            }

            console.log(`[Gas] Estimated for ${functionName}: ${gasEstimate}, With Buffer: ${calculatedGas}`);
        } catch (e) {
            console.warn(`[Gas] Estimation failed for ${functionName}, using safe fallback.`, e);
            // Если оценка упала, используем высокий лимит для тяжелых функций
            if (['revealDeck', 'commitDeck', 'shareKeysToAll', 'createAndJoin', 'joinRoom', 'endGameZK'].includes(functionName)) {
                calculatedGas = functionName === 'endGameZK' ? 100_000_000n : 30_000_000n;
            } else {
                calculatedGas = 5_000_000n;
            }
        }

        // === ОТПРАВКА ТРАНЗАКЦИИ ===
        if (canUseSession && sessionClient) {
            console.log(`[Session TX] Sending ${functionName} with gas ${calculatedGas}...`);

            const attemptSend = async (retry: boolean = true): Promise<`0x${string}`> => {
                try {
                    const hash = await sessionClient.writeContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI as any,
                        functionName: functionName as any,
                        args: args as any,
                        gas: calculatedGas,
                    });
                    console.log(`[Session TX] Success! Hash: ${hash}`);
                    return hash;
                } catch (err: any) {
                    const errMsg = err.message || '';
                    if (retry && (errMsg.includes('nonce too low') || errMsg.includes('Nonce provided for the transaction is lower'))) {
                        console.warn(`[Session TX] Nonce too low for ${functionName}. Retrying with fresh nonce...`);

                        // Wait a bit for RPC to sync or mempool to update
                        await new Promise(resolve => setTimeout(resolve, 1000));

                        // Explicitly fetch next nonce if possible, or just let viem try again
                        // Most reliable is to just retry once, viem will call getTransactionCount again
                        return attemptSend(false);
                    }
                    console.error('[Session TX] Failed:', err.message || err);
                    throw err;
                }
            };

            return attemptSend();
        } else {
            // Fallback на основной кошелек (MetaMask)
            console.log(`[Main Wallet TX] ${functionName} - requires signature | Gas: ${calculatedGas}`);
            return writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: functionName as any,
                args: args as any,
                gas: calculatedGas,
            });
        }
    }, [getSessionWalletClient, writeContractAsync, publicClient, address, isTestMode]);

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
        winner: null
    });

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
        if (currentRoomId) {
            sessionStorage.setItem('currentRoomId', currentRoomId.toString());
            sessionStorage.setItem('lobbyName', lobbyName);
        }
    }, [currentRoomId, lobbyName]);
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

    const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        setGameState(prev => ({
            ...prev,
            logs: [...prev.logs, { id: Math.random().toString(36).substr(2, 9), timestamp: timeString, message, type }]
        }));
    }, []);

    // --- DATA SYNC ---
    // V3 flag constants (must match contract)
    const FLAG_CONFIRMED_ROLE = 1;
    const FLAG_ACTIVE = 2;

    // Check win condition on frontend (since contract doesn't know roles)
    const checkWinCondition = useCallback((players: Player[], contractPhase: GamePhase): 'MAFIA' | 'TOWN' | null => {
        // Don't check in early phases
        if (contractPhase < GamePhase.DAY) return null;

        const alivePlayers = players.filter(p => p.isAlive);
        if (alivePlayers.length === 0) return 'TOWN'; // Draw technically, but contract handles this

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

    const refreshPlayersList = useCallback(async (roomId: bigint) => {
        if (isTestMode || !publicClient) return;
        try {
            const data = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getPlayers',
                args: [roomId],
            }) as any[];

            const roomData = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getRoom',
                args: [roomId],
            }) as any;

            // DEBUG: Log entire raw structure to debug alignment
            console.log('[Phase Sync] Raw RoomData:', roomData);

            // ROBUST PARSING: Handle Array vs Object return
            let phase: GamePhase;
            let dayCount: number;
            let aliveCount: number;
            let committedCount: number;
            let revealedCount: number;
            let phaseDeadline: number;

            if (Array.isArray(roomData)) {
                // [id, host, roomName, phase, maxPlayers, playersCount, aliveCount, dayCount, currentShufflerIndex, ...]
                // phase is index 3
                // aliveCount is index 6
                // dayCount is index 7
                // committedCount is index 13
                // revealedCount is index 14
                phase = Number(roomData[3]) as GamePhase;
                aliveCount = Number(roomData[6]);
                dayCount = Number(roomData[7]);
                committedCount = Number(roomData[13]);
                revealedCount = Number(roomData[14]);
                phaseDeadline = Number(roomData[10]);
            } else {
                phase = Number(roomData.phase) as GamePhase;
                dayCount = Number(roomData.dayCount);
                aliveCount = Number(roomData.aliveCount);
                committedCount = Number(roomData.committedCount);
                revealedCount = Number(roomData.revealedCount);
                phaseDeadline = Number(roomData.phaseDeadline);
            }

            // Fetch Mafia Consensus counts
            const [mafiaCommitted, mafiaRevealed] = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getMafiaConsensus',
                args: [roomId],
            }) as [number, number, string];

            const mafiaCommittedCount = Number(mafiaCommitted);
            const mafiaRevealedCount = Number(mafiaRevealed);

            // DEBUG: Log current phase from contract
            console.log('[Phase Sync]', {
                contractPhase: phase,
                phaseName: GamePhase[phase],
                dayCount,
                aliveCount,
                committedCount,
                revealedCount
            });

            setGameState(prev => {
                // Сохраняем текущие роли игроков (они известны только локально после расшифровки)
                const existingRoles = new Map<string, Role>();
                prev.players.forEach(p => {
                    if (p.role !== Role.UNKNOWN) {
                        existingRoles.set(p.address.toLowerCase(), p.role);
                    }
                });

                // V4: Player struct has flags instead of separate bools
                const formattedPlayers: Player[] = data.map((p: any) => {
                    const flags = Number(p.flags);

                    // Битовые маски из контракта (см. SomniaMafiaV4.sol):
                    // FLAG_CONFIRMED_ROLE = 1, FLAG_ACTIVE = 2, FLAG_HAS_VOTED = 4,
                    // FLAG_HAS_COMMITTED = 8, FLAG_HAS_REVEALED = 16, FLAG_HAS_SHARED_KEYS = 32,
                    // FLAG_DECK_COMMITTED = 64, FLAG_CLAIMED_MAFIA = 128

                    // Preserve existing avatar or use uploaded one for current player
                    const existingPlayer = gameState.players.find(
                        ep => ep.address.toLowerCase() === p.wallet.toLowerCase()
                    );
                    const isMe = p.wallet.toLowerCase() === address?.toLowerCase();
                    // Priority: 1. Existing avatar, 2. Uploaded avatar (for me), 3. Picsum fallback
                    const playerAvatar = existingPlayer?.avatarUrl ||
                        (isMe && avatarUrl) ||
                        `https://picsum.photos/seed/${p.wallet}/200`;

                    return {
                        id: p.wallet,
                        name: p.nickname,
                        address: p.wallet,
                        role: existingRoles.get(p.wallet.toLowerCase()) || Role.UNKNOWN,
                        isAlive: (flags & FLAG_ACTIVE) !== 0,
                        hasConfirmedRole: (flags & FLAG_CONFIRMED_ROLE) !== 0,
                        hasDeckCommitted: (flags & 64) !== 0,
                        hasVoted: (flags & 4) !== 0,           // Voting phase
                        hasNightCommitted: (flags & 8) !== 0,  // Night phase commit
                        hasNightRevealed: (flags & 16) !== 0,  // Night phase reveal
                        avatarUrl: playerAvatar,
                        votesReceived: 0,
                        status: (flags & FLAG_ACTIVE) !== 0 ? 'connected' : 'slashed'
                    };
                });

                // Check win condition on frontend (contract doesn't know roles)
                const winner = checkWinCondition(formattedPlayers, phase);

                // ВАЖНО: Верим контракту. Переходим в ENDED только если контракт сказал ENDED,
                // ЛИБО если мы на 100% уверены в победе (но лучше верить контракту).
                let finalPhase = phase;

                if (winner && phase !== GamePhase.ENDED) {
                    console.log('[Win Condition Calculated Local]', winner);
                    finalPhase = GamePhase.ENDED;
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
                    winner: winner || prev.winner
                };
            });
        } catch (e) {
            console.error("Sync error:", e);
        }
    }, [publicClient, checkWinCondition]);

    // Initial load
    useEffect(() => {
        if (isTestMode || !currentRoomId || !publicClient) return;
        refreshPlayersList(currentRoomId);
    }, [currentRoomId, publicClient, refreshPlayersList, isTestMode]);

    // Polling для регулярного обновления состояния (backup для events)
    useEffect(() => {
        if (isTestMode || !currentRoomId || !publicClient) return;

        const interval = setInterval(() => {
            refreshPlayersList(currentRoomId);
        }, 5000); // Каждые 5 секунд

        return () => clearInterval(interval);
    }, [currentRoomId, publicClient, refreshPlayersList, isTestMode]);




    // Auto-check win condition after player list updates (after eliminations)
    // This triggers tryEndGame when a win condition is locally detected
    const tryEndGameRef = useRef<(() => Promise<void>) | null>(null);

    // Local win check is disabled because Town players don't know all roles.
    // We rely on Server-Side "Smart Polling" triggerAutoWinCheck instead.

    // --- LOBBY ACTIONS (V3: createRoom only, then joinRoom with session) ---

    const createLobbyOnChain = useCallback(async () => {
        if (!playerName || !address || !lobbyName || !publicClient) return alert("Enter details and connect wallet!");
        setIsTxPending(true);
        try {
            // 1. Предсказываем ID комнаты (читаем nextRoomId)
            const nextId = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'nextRoomId',
            }) as bigint;
            const newRoomId = Number(nextId);

            // 2. Генерируем ключи
            const keyPair = await generateKeyPair();
            setKeys(keyPair);
            const pubKeyHex = await exportPublicKey(keyPair.publicKey);

            // 3. Сессия
            const { sessionAddress } = createNewSession(address, newRoomId);

            // 4. Оценка газа с буфером
            let gasLimit = 5_000_000n;
            try {
                const gasEstimate = await publicClient.estimateContractGas({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'createAndJoin',
                    args: [lobbyName, 16, playerName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`],
                    account: address,
                    value: parseEther('0.1'),
                });
                gasLimit = (gasEstimate * 150n) / 100n;
                console.log(`[Gas] createAndJoin estimated: ${gasEstimate}, with buffer: ${gasLimit}`);
            } catch (e) {
                console.warn('[Gas] createAndJoin estimation failed, using fallback', e);
            }

            // 5. АТОМАРНАЯ ТРАНЗАКЦИЯ (Create + Join + Fund)
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'createAndJoin',
                args: [
                    lobbyName,      // string roomName
                    16,             // uint8 maxPlayers
                    playerName,     // string nickname
                    pubKeyHex as `0x${string}`,      // bytes publicKey
                    sessionAddress as `0x${string}`  // address sessionAddress
                ],
                value: parseEther('0.1'),
                gas: gasLimit,
            });

            addLog(`Creating room "${lobbyName}"...`, "info");
            await publicClient?.waitForTransactionReceipt({ hash });

            markSessionRegistered();
            setCurrentRoomId(BigInt(newRoomId));
            await refreshPlayersList(BigInt(newRoomId));
            addLog("Lobby created successfully!", "success");
            setIsTxPending(false);
        } catch (e: any) {
            console.error(e);
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [playerName, address, lobbyName, publicClient, writeContractAsync, addLog, refreshPlayersList]);

    const joinLobbyOnChain = useCallback(async (roomId: number) => {
        if (!playerName || !address || !publicClient) return alert("Enter name and connect wallet!");
        setIsTxPending(true);
        try {
            // 1. Generate crypto keys
            const keyPair = await generateKeyPair();
            setKeys(keyPair);
            const pubKeyHex = await exportPublicKey(keyPair.publicKey);

            // 2. Generate session key
            const { sessionAddress } = createNewSession(address, roomId);

            // 3. Оценка газа с буфером
            let gasLimit = 5_000_000n;
            try {
                const gasEstimate = await publicClient.estimateContractGas({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'joinRoom',
                    args: [BigInt(roomId), playerName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`],
                    account: address,
                    value: parseEther('0.1'),
                });
                gasLimit = (gasEstimate * 150n) / 100n;
                console.log(`[Gas] joinRoom estimated: ${gasEstimate}, with buffer: ${gasLimit}`);
            } catch (e) {
                console.warn('[Gas] joinRoom estimation failed, using fallback', e);
            }

            // 4. Join room with session key + fund it
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'joinRoom',
                args: [BigInt(roomId), playerName, pubKeyHex as `0x${string}`, sessionAddress as `0x${string}`],
                value: parseEther('0.1'),
                gas: gasLimit,
            });
            // addLog("Joining with auto-sign...", "info");
            await publicClient?.waitForTransactionReceipt({ hash });

            // 5. Mark session as registered
            markSessionRegistered();

            setCurrentRoomId(BigInt(roomId));
            await refreshPlayersList(BigInt(roomId));
            // addLog("Joined with auto-sign enabled!", "success");
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [playerName, address, publicClient, writeContractAsync, addLog, refreshPlayersList]);

    // --- SHUFFLE PHASE ---

    const startGameOnChain = useCallback(async () => {
        if (!currentRoomId || !publicClient || !address) return;
        setIsTxPending(true);
        try {
            // Оценка газа с буфером
            let gasLimit = 2_000_000n;
            try {
                const gasEstimate = await publicClient.estimateContractGas({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'startGame',
                    args: [currentRoomId],
                    account: address,
                });
                gasLimit = (gasEstimate * 150n) / 100n;
                console.log(`[Gas] startGame estimated: ${gasEstimate}, with buffer: ${gasLimit}`);
            } catch (e) {
                console.warn('[Gas] startGame estimation failed, using fallback', e);
            }

            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'startGame',
                args: [currentRoomId],
                gas: gasLimit,
            });
            addLog("Starting game...", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [currentRoomId, publicClient, address, addLog, refreshPlayersList, writeContractAsync]);

    // V4: Deck commit-reveal
    const commitDeckOnChain = useCallback(async (deckHash: string) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('commitDeck', [currentRoomId, deckHash]);
            addLog("Deck hash committed!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    const revealDeckOnChain = useCallback(async (deck: string[], salt: string) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('revealDeck', [currentRoomId, deck, salt]);
            addLog("Deck revealed!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    // --- REVEAL PHASE (V3: batch share keys) ---

    const shareKeysToAllOnChain = useCallback(async (recipients: string[], encryptedKeys: string[]) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            // V3: shareKeysToAll - one transaction for all keys
            const hash = await sendGameTransaction('shareKeysToAll', [
                currentRoomId,
                recipients,
                encryptedKeys.map(k => k as `0x${string}`) // Convert to bytes
            ]);
            addLog(`Keys shared to ${recipients.length} players!`, "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient]);

    const commitRoleOnChain = useCallback(async (role: number, salt: string) => {
        if (!currentRoomId) return;

        const existingSalt = localStorage.getItem(`role_salt_${currentRoomId}_${address}`);
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
                    const roleHash = ShuffleService.createRoleCommitHash(role, saltToUse);
                    const txHash = await sendGameTransaction('commitRole', [currentRoomId, roleHash]);
                    addLog("Role committed!", "success");
                    await publicClient?.waitForTransactionReceipt({ hash: txHash });
                    localStorage.setItem(`role_salt_${currentRoomId}_${address}`, saltToUse);
                } catch (txErr: any) {
                    if (txErr.message?.includes("AlreadyCommitted") || txErr.message?.includes("AlreadyConfirmed")) {
                        console.log("Role already on-chain, proceeding to server sync.");
                    } else {
                        throw txErr;
                    }
                }
            }

            // SYNC WITH SERVER-SIDE DB (for automated win-checking)
            try {
                await fetch('/api/game/reveal-secret', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: currentRoomId.toString(),
                        address,
                        role,
                        salt: saltToUse
                    })
                });
                console.log("[Status] Secret synced with server DB.");
            } catch (err) {
                console.warn("[Warning] Failed to sync secret with server DB.", err);
            }

            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || "Role commit failed", "danger");
            setIsTxPending(false);
            throw e;
        }
    }, [currentRoomId, address, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    const confirmRoleOnChain = useCallback(async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('confirmRole', [currentRoomId]);
            addLog("Role confirmed.", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    const commitAndConfirmRoleOnChain = useCallback(async (role: number, salt: string) => {
        if (!currentRoomId) return;

        const savedSalt = localStorage.getItem(`role_salt_${currentRoomId}_${address}`);
        let saltToUse = salt;

        // Check if we are already confirmed on chain to avoid redundant txs
        const isConfirmedOnChain = myPlayer?.hasConfirmedRole;

        if (savedSalt) {
            saltToUse = savedSalt;
            console.log("Role already committed locally.");
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
                    const hash = await sendGameTransaction('confirmRole', [currentRoomId]);
                    addLog("Role confirmed (fallback).", "success");
                    await publicClient?.waitForTransactionReceipt({ hash });
                } catch (err: any) {
                    // If confirm fails, maybe we never actually committed? 
                    // Hard to distinguish without checking hasCommitted flag, but let's assume if this fails we might need manual intervention or reset.
                    console.error("Fallback confirm failed:", err);
                    throw err;
                }
            } else {
                // Normal flow: No salt, not confirmed -> Commit + Confirm
                try {
                    const { ShuffleService } = await import('../services/shuffleService');
                    const roleHash = ShuffleService.createRoleCommitHash(role, saltToUse);
                    const txHash = await sendGameTransaction('commitAndConfirmRole', [currentRoomId, roleHash]);
                    addLog("Role committed & confirmed on-chain!", "success");
                    await publicClient?.waitForTransactionReceipt({ hash: txHash });
                    localStorage.setItem(`role_salt_${currentRoomId}_${address}`, saltToUse);
                } catch (txErr: any) {
                    const errMsg = (txErr.message || "").toLowerCase();
                    const shortMsg = (txErr.shortMessage || "").toLowerCase();

                    // Check for RoleAlreadyCommitted (revert)
                    if (errMsg.includes("rolealreadycommitted") || shortMsg.includes("rolealreadycommitted") ||
                        errMsg.includes("alreadycommitted") || shortMsg.includes("alreadycommitted")) {

                        console.warn("Role already committed. Checking confirmation status...");

                        // Check if we are already confirmed
                        const flags = await publicClient?.readContract({
                            address: MAFIA_CONTRACT_ADDRESS,
                            abi: MAFIA_ABI,
                            functionName: 'getPlayerFlags',
                            args: [currentRoomId, address as `0x${string}`],
                        }) as unknown as any[]; // returns tuple of bools

                        // Tuple index 1 is hasConfirmedRole (see RoleReveal)
                        // [isActive, hasConfirmedRole, hasVoted, hasCommitted, hasRevealed, hasSharedKeys, hasClaimedMafia]
                        const isConfirmed = flags?.[1];

                        if (!isConfirmed) {
                            console.log("Role committed but NOT confirmed. Calling confirmRole...");
                            addLog("Role previously committed. Confirming now...", "info");
                            // Determine gas for confirmRole
                            const confirmHash = await sendGameTransaction('confirmRole', [currentRoomId]);
                            await publicClient?.waitForTransactionReceipt({ hash: confirmHash });
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
            try {
                await fetch('/api/game/reveal-secret', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: currentRoomId.toString(),
                        address,
                        role,
                        salt: saltToUse
                    })
                });
                console.log("[Status] Secret synced with server DB.");
            } catch (err) {
                console.warn("[Warning] Failed to sync secret with server DB.", err);
            }

            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            console.error("Confirmation error:", e);
            addLog(e.shortMessage || "Confirmation failed", "danger");
            setIsTxPending(false);
            throw e;
        }
    }, [currentRoomId, address, publicClient, sendGameTransaction, addLog, refreshPlayersList, myPlayer?.hasConfirmedRole]);

    // --- DAY & VOTING ---

    const startVotingOnChain = useCallback(async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('startVoting', [currentRoomId]);
            addLog("Voting phase started!", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    const voteOnChain = useCallback(async (targetAddress: string) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('vote', [currentRoomId, targetAddress]);
            const targetPlayer = gameState.players.find(p => p.address.toLowerCase() === targetAddress.toLowerCase());
            const targetName = targetPlayer ? (targetPlayer.name || `Player ${gameState.players.indexOf(targetPlayer) + 1}`) : targetAddress.slice(0, 6);
            addLog(`🗳️ You voted for ${targetName}`, "warning");
            await publicClient?.waitForTransactionReceipt({ hash });
            // V3: auto-finalize when all voted - just refresh
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    // V3: finalizeVoting removed - auto-triggers on last vote

    // --- NIGHT PHASE (V3: auto-finalize) ---

    const commitNightActionOnChain = useCallback(async (hash: string) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const txHash = await sendGameTransaction('commitNightAction', [currentRoomId, hash as `0x${string}`]);
            addLog("Night action committed!", "info");
            await publicClient?.waitForTransactionReceipt({ hash: txHash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            throw e; // Re-throw so caller knows it failed
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    const revealNightActionOnChain = useCallback(async (action: number, target: string, salt: string) => {
        if (!currentRoomId) return;

        // DEBUG: Log what we're sending to contract
        console.log('[Reveal TX]', {
            roomId: Number(currentRoomId),
            action,
            target,
            salt,
            saltLength: salt.length
        });

        try {
            const hash = await sendGameTransaction('revealNightAction', [currentRoomId, action, target, salt]);
            addLog("Night action revealed!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            // V3: auto-finalize when all revealed - just refresh
            await refreshPlayersList(currentRoomId);
        } catch (e: any) {
            console.error('[Reveal TX Failed]', e);
            addLog(e.shortMessage || e.message, "danger");
            throw e; // Re-throw so caller knows it failed
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    // --- V4: MAFIA CONSENSUS KILL FUNCTIONS ---

    const commitMafiaTargetOnChain = useCallback(async (targetHash: string) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('commitMafiaTarget', [currentRoomId, targetHash as `0x${string}`]);
            addLog("Mafia target committed!", "info");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            throw e;
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    const revealMafiaTargetOnChain = useCallback(async (target: string, salt: string) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('revealMafiaTarget', [currentRoomId, target, salt]);
            addLog("Mafia target revealed!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            throw e;
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    const getInvestigationResultOnChain = useCallback(async (detective: string, target: string) => {
        if (isTestMode) {
            // Mock results for Testing
            if (target.toLowerCase().includes('4444')) {
                return { role: Role.MAFIA, isMafia: true };
            }
            return { role: Role.CIVILIAN, isMafia: false };
        }
        if (!currentRoomId) return { role: Role.UNKNOWN, isMafia: false };

        try {
            console.log(`[Investigation API] Fetching result for ${detective} -> ${target}`);
            const response = await fetch('/api/game/investigate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: currentRoomId.toString(),
                    detectiveAddress: detective,
                    targetAddress: target
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch investigation result');
            }

            const data = await response.json();
            // Convert numerical role to Role enum
            const role = ShuffleService.roleNumberToRole(data.role.toString());

            return {
                role,
                isMafia: data.isMafia
            };
        } catch (e: any) {
            console.error('[Investigation API Failed]', e);
            addLog(`Investigation failed: ${e.message}`, "danger");
            return { role: Role.UNKNOWN, isMafia: false };
        }
    }, [currentRoomId, addLog]);

    const forcePhaseTimeoutOnChain = useCallback(async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('forcePhaseTimeout', [currentRoomId]);
            addLog("Phase timeout triggered!", "warning");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            throw e;
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    // --- MAFIA CHAT (V4) ---

    // Load chat messages from contract
    const fetchMafiaChat = useCallback(async (roomId: bigint) => {
        if (!publicClient) return;
        try {
            const messages = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getMafiaChat',
                args: [roomId]
            }) as any[];

            // Import helper locally to avoid closure issues if possible, or use from top level
            // We need hexToString from services/cryptoUtils

            const formattedMessages: MafiaChatMessage[] = messages.map((msg: any, index: number) => {
                const hexContent = msg.encryptedMessage;
                let content = { type: 'text' as const, text: '' };

                try {
                    // Try to decode hex -> string -> JSON
                    // We need to make sure hexToString is available
                    // Use simple hex to string if function not imported, but it is imported as hexToString
                    let str = '';
                    if (hexContent.startsWith('0x')) {
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

                // Resolve sender name
                const senderPlayer = gameState.players.find(p => p.address.toLowerCase() === msg.sender.toLowerCase());
                const playerName = senderPlayer?.name || msg.sender.slice(0, 6);

                return {
                    id: `${index}-${msg.timestamp}`,
                    sender: msg.sender,
                    playerName,
                    content,
                    timestamp: Number(msg.timestamp) * 1000
                };
            });

            setGameState(prev => ({ ...prev, mafiaMessages: formattedMessages }));
        } catch (e) {
            console.error("Error fetching mafia chat:", e);
        }
    }, [publicClient, gameState.players, setGameState]); // Removed hexToString dependency to avoid complex scope issues, inline implementation

    const sendMafiaMessageOnChain = async (content: MafiaChatMessage['content']) => {
        if (!currentRoomId) return;

        // Encode content to JSON then Hex
        const jsonStr = JSON.stringify(content);
        // Inline stringToHex
        let hexData = '0x' as `0x${string}`;
        for (let i = 0; i < jsonStr.length; i++) {
            hexData += jsonStr.charCodeAt(i).toString(16).padStart(2, '0');
        }

        try {
            const hash = await sendGameTransaction('sendMafiaMessage', [currentRoomId, hexData]);
            await publicClient?.waitForTransactionReceipt({ hash });
            fetchMafiaChat(currentRoomId);
        } catch (e: any) {
            addLog(`Chat failed: ${e.shortMessage || e.message}`, "danger");
            throw e;
        }
    };




    // Polling for Mafia Chat
    useEffect(() => {
        if (!currentRoomId || !publicClient) return;

        const CHECK_INTERVAL = 3000; // Check chat every 3s

        const interval = setInterval(() => {
            // Only fetch if we are mafia
            const isMafia = gameState.myPlayerId ?
                gameState.players.find(p => p.address.toLowerCase() === gameState.myPlayerId?.toLowerCase())?.role === Role.MAFIA :
                gameState.players.find(p => p.address.toLowerCase() === address?.toLowerCase())?.role === Role.MAFIA;

            if (isMafia && gameState.phase >= GamePhase.DAY) {
                fetchMafiaChat(currentRoomId);
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [currentRoomId, publicClient, fetchMafiaChat, gameState.players, gameState.myPlayerId, address, gameState.phase]);


    const endGameAutomaticallyOnChain = useCallback(async () => {
        if (!currentRoomId) return;
        try {
            const hash = await sendGameTransaction('endGameAutomatically', [currentRoomId]);
            addLog("Game ended automatically!", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    // Reveal role on-chain (used at game end to allow contract to verify win condition)
    const revealRoleOnChain = useCallback(async (role: number, salt: string) => {
        if (!currentRoomId) return;
        try {
            const hash = await sendGameTransaction('revealRole', [currentRoomId, role, salt]);
            addLog("Role revealed on-chain!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            // Ignore "already revealed" errors
            if (e.message.includes("RoleAlreadyRevealed")) return;
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient]);

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

    // Automatically reveal my role on-chain after game ends (for trustless verification)
    const revealMyRoleAfterGameEnd = useCallback(async () => {
        if (!currentRoomId || !myPlayer || !address) return;

        try {
            // Get saved salt from localStorage (set during commitRole phase)
            const salt = localStorage.getItem(`role_salt_${currentRoomId}_${address}`);
            if (!salt) {
                console.warn("[RoleReveal] No salt found in localStorage, skipping reveal");
                return;
            }

            // Get role from myPlayer (locally decrypted)
            const roleNum = getRoleNumber(myPlayer.role);
            if (roleNum === 0) {
                console.warn("[RoleReveal] Unknown role, skipping reveal");
                return;
            }

            addLog("Revealing your role on-chain...", "info");
            await revealRoleOnChain(roleNum, salt);
            addLog(`Role revealed: ${myPlayer.role}`, "success");

        } catch (e: any) {
            // Ignore "already revealed" errors - might have been revealed before
            if (e.message?.includes("RoleAlreadyRevealed")) {
                console.log("[RoleReveal] Already revealed, skipping");
                return;
            }
            console.warn("[RoleReveal] Failed:", e);
        }
    }, [currentRoomId, myPlayer, address, revealRoleOnChain, addLog]);


    // V4: ZK End Game (Client generates proof of win)
    // V4: ZK End Game (Client generates proof of win via Server API)
    const endGameZK = useCallback(async () => {
        if (!currentRoomId || !publicClient) return;

        // --- 1. COORDINATION LOGIC ("Waterfall") ---
        // Sort active players by address to have a deterministic order
        const activePlayers = gameState.players
            .filter(p => p.isAlive)
            .sort((a, b) => a.address.localeCompare(b.address));

        const myIndex = activePlayers.findIndex(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());

        // If I am not found (shouldn't happen if alive), default to 0
        const delayIndex = myIndex >= 0 ? myIndex : 0;

        // Delay: 1st player = 0s, 2nd = 15s, 3rd = 30s...
        const delayMs = delayIndex * 15000;

        if (delayMs > 0) {
            console.log(`[ZK] Designated Submitter: I am #${delayIndex + 1}. Waiting ${delayMs / 1000}s before submission...`);
            addLog(`Waiting turn to submit proof (${delayMs / 1000}s)...`, "info");
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // Re-check if game ended while waiting
            // We can check if we are still on the same room/state, but ideally we check if the game is OVER.
            // However, endGameZK is usually called when we *think* it's over.
            // A simple check is if another tx is pending or if phase changed (though phase won't change until tx confirms)
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

            console.log("[ZK] Requesting proof for Room:", currentRoomId.toString());

            // 2. Fetch Proof
            const zkData = await generateEndGameProof(currentRoomId, mCount, tCount);

            console.log("[ZK] Proof received. Simulating transaction...");

            // 3. Form args
            const args = [
                currentRoomId,
                zkData.a,
                zkData.b,
                zkData.c,
                zkData.inputs
            ] as const;

            // 4. Simulate
            try {
                await publicClient.simulateContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'endGameZK',
                    args: args as any,
                    account: address,
                });
                console.log("[ZK] Simulation SUCCESS");
            } catch (simError: any) {
                console.error("[ZK] Simulation FAILED:", simError.shortMessage || simError.message);
                throw new Error("Contract rejected the proof. Check log for details.");
            }

            // 5. DECIDE WALLET (Session vs Main) based on balance
            let useSessionKey = false;
            const session = loadSession();
            if (session && session.registeredOnChain && Date.now() < session.expiresAt && session.roomId === Number(currentRoomId)) {
                try {
                    const balance = await publicClient.getBalance({ address: session.address as `0x${string}` });
                    const MIN_BALANCE = 5_000_000_000_000_000n; // 0.005 ETH
                    if (balance >= MIN_BALANCE) {
                        useSessionKey = true;
                        console.log(`[ZK] Session Key has balance (${balance}), optimizing submission.`);
                    } else {
                        console.warn(`[ZK] Session Key balance too low (${balance}), falling back to Main Wallet.`);
                    }
                } catch (e) {
                    console.error("[ZK] Failed to check session balance:", e);
                }
            }

            // 6. Send Transaction
            console.log(`[ZK] Sending transaction (Session: ${useSessionKey})...`);
            const hash = await sendGameTransaction('endGameZK', args as any, useSessionKey);

            const isTownWin = zkData.inputs[0] === 1n;
            // addLog(`ZK Proof submitted! Winner: ${isTownWin ? "TOWN" : "MAFIA"}`, "success"); // Removed tech log

            await publicClient.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);

            // Auto-reveal my role on-chain for trustless verification
            await revealMyRoleAfterGameEnd();

        } catch (txErr: any) {
            console.error("[ZK] Transaction Failed:", txErr);
            addLog(`ZK Error: ${txErr.shortMessage || txErr.message}`, "danger");
        } finally {
            setIsTxPending(false);
        }
    }, [currentRoomId, gameState.players, sendGameTransaction, addLog, publicClient, refreshPlayersList, address, myPlayer?.address, revealMyRoleAfterGameEnd]);

    /**
     * TRIGGER AUTO WIN: A silent background check that pings the server
     * to see if a win condition has been met (since server knows all roles).
     */
    const triggerAutoWinCheck = useCallback(async () => {
        const roomId = currentRoomIdRef.current;
        if (!roomId || !publicClient) return;

        // Note: We don't block the CHECK (server fetch) if isTxPending is true,
        // because the transaction that is pending might be the one that triggers the win!
        // We only block the SUBMISSION of the endGameZK transaction.

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

                // BLOCK POLLING IMMEDIATELY
                setIsTxPending(true);

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

                // LOCK ONLY BEFORE SUBMITTING
                if (isTxPending) {
                    console.log("[AutoWin] Win detected, but another transaction is pending. Retrying shortly...");
                    return;
                }
                setIsTxPending(true);

                // SIMULATE CONTRACT FIRST
                try {
                    await publicClient.simulateContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'endGameZK',
                        args: args as any,
                        account: address,
                    });
                    console.log("[AutoWin ZK Debug] Simulation SUCCESS");
                } catch (simErr: any) {
                    console.error("[AutoWin ZK Debug] Simulation FAILED!");
                    console.error("Reason:", simErr.reason || simErr.shortMessage || "Unknown revert");
                    console.error("Full Error:", simErr);
                }

                addLog(`Auto-Win: ${data.result} detected! Ending game...`, "success");

                try {
                    // Send with a very generous gas limit for ZK verification on Somnia
                    const hash = await sendGameTransaction('endGameZK', args as any, false);

                    await publicClient.waitForTransactionReceipt({ hash });
                    addLog("Game ended automatically via Server ZK!", "phase");
                    await refreshPlayersList(roomId);

                    // Auto-reveal my role on-chain for trustless verification
                    await revealMyRoleAfterGameEnd();
                } catch (txErr: any) {
                    console.error("[AutoWin ZK Debug] Transaction FAILED:", txErr);
                    addLog(`Auto-Win Failed: ${txErr.shortMessage || txErr.message}`, "danger");
                } finally {
                    setIsTxPending(false);
                }
            } else if (data.message && data.message !== 'Game continues') {
                // Log diagnostic messages if they aren't just "Game continues"
                console.log(`[AutoWinCheck] ${data.message}`);
            }
        } catch (e) {
            console.warn("[AutoWin] Silent check failed:", e);
        }
    }, [publicClient, sendGameTransaction, addLog, refreshPlayersList, isTxPending, address, revealMyRoleAfterGameEnd]);

    // Manual triggers for victory claim (reveals role + checks win condition)
    const claimVictory = useCallback(async () => {
        if (!currentRoomId || !myPlayer) return;

        try {
            const salt = localStorage.getItem(`role_salt_${currentRoomId}_${address}`);
            if (salt) {
                try {
                    const roleNum = getRoleNumber(myPlayer.role);
                    addLog("Revealing role for victory claim...", "info");
                    await revealRoleOnChain(roleNum, salt);
                } catch (e: any) {
                    if (!e.message.includes("RoleAlreadyRevealed")) {
                        console.warn("Reveal role failed during claim:", e);
                    }
                }
            }

            // TRY ZK PATH FIRST (More reliable, doesn't need all roles revealed)
            try {
                addLog("Triggering ZK win check for victory claim...", "info");
                await triggerAutoWinCheck();
            } catch (zkErr: any) {
                console.error("[claimVictory] ZK path failed, trying fallback:", zkErr);
                try {
                    await endGameAutomaticallyOnChain();
                    addLog("Game ended via fallback!", "phase");
                } catch (e: any) {
                    if (e.message.includes("NotAllRolesRevealed")) {
                        addLog("Victory claimed! Waiting for other survivors to claim...", "info");
                    } else {
                        addLog(e.shortMessage || e.message, "danger");
                    }
                }
            }
        } catch (e) {
            console.error("Claim victory failed:", e);
            addLog("Failed to claim victory.", "danger");
        }
    }, [currentRoomId, myPlayer, address, revealRoleOnChain, endGameAutomaticallyOnChain, triggerAutoWinCheck, addLog]);


    // === SMART POLLING ===
    useEffect(() => {
        if (isTestMode || !currentRoomId || !publicClient) return;
        if (gameState.phase < GamePhase.DAY || gameState.phase === GamePhase.ENDED) return;

        const interval = setInterval(() => {
            // Check if a transaction is already in progress to avoid double popups
            if (isTxPending) return;

            triggerAutoWinCheck().catch(err =>
                console.warn("[AutoWin] Check failed silently:", err)
            );
        }, 5000); // Check every 5 seconds

        return () => clearInterval(interval);
    }, [currentRoomId, publicClient, isTestMode, gameState.phase, isTxPending, triggerAutoWinCheck]);

    // Try to end the game by first revealing our role on-chain, then calling endGameAutomatically
    const tryEndGame = useCallback(async () => {
        if (!currentRoomId || !address) return;

        // Check if we have win condition locally
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        let aliveMafia = 0;
        let aliveTown = 0;
        let unknownRoles = 0;

        for (const player of alivePlayers) {
            if (player.role === Role.MAFIA) aliveMafia++;
            else if (player.role === Role.UNKNOWN) unknownRoles++;
            else aliveTown++;
        }

        // Can't determine winner if we don't know all roles locally
        if (unknownRoles > 0) {
            console.log("[tryEndGame] Can't determine winner - unknown roles exist");
            return;
        }

        // Check win conditions
        const mafiaWins = aliveMafia > 0 && aliveMafia >= aliveTown;
        const townWins = aliveMafia === 0 && aliveTown > 0;

        if (!mafiaWins && !townWins) {
            console.log("[tryEndGame] No win condition met yet");
            return;
        }

        console.log("[tryEndGame] Win condition detected!", { mafiaWins, townWins, aliveMafia, aliveTown });

        // Try to reveal our role on-chain (required for contract to verify)
        const myRole = gameState.players.find(p => p.address.toLowerCase() === address.toLowerCase())?.role;
        const savedSalt = localStorage.getItem(`role_salt_${currentRoomId}_${address}`);

        if (myRole && myRole !== Role.UNKNOWN && savedSalt) {
            const roleMap: Record<string, number> = {
                [Role.MAFIA]: 1,
                [Role.DOCTOR]: 2,
                [Role.DETECTIVE]: 3,
                [Role.CIVILIAN]: 4,
            };
            const roleNum = roleMap[myRole] || 4;

            try {
                addLog("Revealing role for game end...", "info");
                await revealRoleOnChain(roleNum, savedSalt);
            } catch (e) {
                console.error("[tryEndGame] Failed to reveal role:", e);
                // Continue anyway - maybe role was already revealed
            }
        }

        // Try to end the game on-chain
        try {
            // First try ZK path by triggering a manual check-win which produces a proof
            addLog("Triggering final ZK win check...", "info");
            await triggerAutoWinCheck();
        } catch (e: any) {
            console.error("[tryEndGame] ZK path failed, trying fallback:", e);
            try {
                await endGameAutomaticallyOnChain();
                addLog("Game ended on-chain!", "phase");
            } catch (fallbackErr: any) {
                console.error("[tryEndGame] Fallback failed:", fallbackErr);
                // If contract rejects, force frontend transition to ENDED
                if (mafiaWins || townWins) {
                    addLog("Transitioning to Game Over...", "phase");
                    setGameState(prev => ({
                        ...prev,
                        phase: GamePhase.ENDED,
                        winner: mafiaWins ? 'MAFIA' : 'TOWN'
                    }));
                }
            }
        }
    }, [currentRoomId, address, gameState.players, revealRoleOnChain, endGameAutomaticallyOnChain, addLog, setGameState, triggerAutoWinCheck]);



    // Set ref for auto-trigger useEffect 
    useEffect(() => {
        tryEndGameRef.current = tryEndGame;
    }, [tryEndGame]);

    // --- UTILITY ---

    // V4: forcePhaseTimeout - kicks stalled player and advances phase
    const kickStalledPlayerOnChain = useCallback(async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('forcePhaseTimeout', [currentRoomId]);
            addLog("Force timeout initiated...", "danger");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    }, [currentRoomId, sendGameTransaction, addLog, publicClient, refreshPlayersList]);

    // --- EVENTS (используем ref чтобы избежать проблем с замыканием) ---

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'PlayerJoined',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            logs.forEach((log: any) => {
                if (BigInt(log.args.roomId) === roomId) {
                    // addLog(`${log.args.nickname} joined!`, "info");
                    refreshPlayersList(roomId);
                }
            });
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'GameStarted',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                // addLog("Shuffle started!", "phase");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'DayStarted',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                addLog(`Day ${logs[0].args.dayNumber} has begun!`, "phase");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'VotingStarted',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                addLog("Voting Phase Started", "phase");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'NightStarted',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                addLog("Night started", "phase");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'PlayerEliminated',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const victim = logs[0].args.player;
                const reason = logs[0].args.reason;
                addLog(`${victim.slice(0, 6)}... ${reason}!`, "danger");
                refreshPlayersList(roomId);
                // Trigger win check in case the Mafia was eliminated
                triggerAutoWinCheck();
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'PlayerKicked',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const kicked = logs[0].args.player;
                addLog(`${kicked.slice(0, 6)}... was kicked (AFK)!`, "danger");
                refreshPlayersList(roomId);
                // Trigger win check in case the kicked player was Mafia
                triggerAutoWinCheck();
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'GameEnded',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                addLog(`Game Over: ${logs[0].args.reason}`, "phase");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'VotingFinalized',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                console.log("[Event] Voting Finalized. Triggering immediate win check.");
                refreshPlayersList(roomId);
                triggerAutoWinCheck();
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'NightFinalized',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                console.log("[Event] Night Finalized. Triggering immediate win check.");
                refreshPlayersList(roomId);
                triggerAutoWinCheck();
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'RoleConfirmed',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const player = logs[0].args.player;
                // addLog(`${player.slice(0, 6)}... confirmed role`, "info");
                refreshPlayersList(roomId);
                // Trigger auto-win check because this might be the last reveal needed
                triggerAutoWinCheck();
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'AllRolesConfirmed',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                // addLog("All roles confirmed! Day begins...", "phase");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'AllKeysShared',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                // addLog("All players shared keys! Decrypt your role.", "success");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'DeckCommitted',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const player = logs[0].args.byPlayer;
                const nextIndex = Number(logs[0].args.nextIndex);
                // addLog(`${player.slice(0, 6)}... shuffled the deck`, "info");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'KeysSharedToAll',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const from = logs[0].args.from;
                const fromPlayer = gameState.players.find(p => p.address.toLowerCase() === from.toLowerCase());
                const name = fromPlayer ? (fromPlayer.name || `Player ${gameState.players.indexOf(fromPlayer) + 1}`) : from.slice(0, 6);
                // addLog(`🔑 ${name} shared decryption keys`, "success");
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'VoteCast',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const voter = logs[0].args.voter;
                const target = logs[0].args.target;
                const voterPlayer = gameState.players.find(p => p.address.toLowerCase() === voter.toLowerCase());
                const targetPlayer = gameState.players.find(p => p.address.toLowerCase() === target.toLowerCase());
                const voterLabel = voterPlayer ? (voterPlayer.name || `Player ${gameState.players.indexOf(voterPlayer) + 1}`) : voter.slice(0, 6);
                const targetLabel = targetPlayer ? (targetPlayer.name || `Player ${gameState.players.indexOf(targetPlayer) + 1}`) : target.slice(0, 6);
                addLog(`${voterLabel} voted for ${targetLabel}`, "warning");
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'VotingFinalized',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const eliminated = logs[0].args.eliminated;
                const voteCount = Number(logs[0].args.voteCount);
                if (eliminated !== '0x0000000000000000000000000000000000000000') {
                    const elPlayer = gameState.players.find(p => p.address.toLowerCase() === eliminated.toLowerCase());
                    const name = elPlayer ? (elPlayer.name || `Player ${gameState.players.indexOf(elPlayer) + 1}`) : eliminated.slice(0, 6);
                    addLog(`Execution: ${name} was eliminated with ${voteCount} votes!`, "danger");
                } else {
                    addLog("No one was eliminated - no majority reached.", "warning");
                }
                refreshPlayersList(roomId);
                // Trigger auto-win check because an elimination might end the game
                triggerAutoWinCheck();
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'NightFinalized',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const killed = logs[0].args.killed;
                const healed = logs[0].args.healed;
                if (killed !== '0x0000000000000000000000000000000000000000') {
                    if (killed === healed) {
                        // addLog(`🛡️ Someone was saved by the doctor!`, "success");
                    } else {
                        const kPlayer = gameState.players.find(p => p.address.toLowerCase() === killed.toLowerCase());
                        const name = kPlayer ? (kPlayer.name || `Player ${gameState.players.indexOf(kPlayer) + 1}`) : killed.slice(0, 6);
                        addLog(`Tragedy: ${name} was killed during the night!`, "danger");
                    }
                } else {
                    addLog("The night passes peacefully...", "info");
                }
                refreshPlayersList(roomId);
                // Trigger auto-win check because a night kill might end the game
                triggerAutoWinCheck();
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'NightActionCommitted',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const player = logs[0].args.player;
                const p = gameState.players.find(pl => pl.address.toLowerCase() === player.toLowerCase());
                const name = p ? (p.name || `Player ${gameState.players.indexOf(p) + 1}`) : player.slice(0, 6);
                // addLog(`🌙 ${name} committed a night action`, "info");

                // Play shot sound
                try {
                    const audio = new Audio(shotSound);
                    audio.volume = 0.2;
                    // audio.play().catch(e => console.error("Audio play failed:", e));
                } catch (e) {
                    console.error("Audio error:", e);
                }
            }
        }
    });



    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'MafiaMessageSent',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                // Refresh chat when new message arrives
                fetchMafiaChat(roomId);
            }
        }
    });


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
    }, [gameState.phase, myPlayer]);


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



    // AUTO-END GAME CHECKER (Safe Hybrid Approach)
    useEffect(() => {
        if (!currentRoomId || !myPlayer || !myPlayer.isAlive) return;

        const checkAndClaim = async () => {
            // 1. MAFIA LOGIC (Automatic but Conservative)
            // We only auto-claim if we are mathematically certain of victory.
            // Since we might not know teammates (hidden roles), we count conservatively.
            if (myPlayer.role === Role.MAFIA) {
                const alivePlayers = gameState.players.filter(p => p.isAlive);
                let knownMafia = 0;
                let potentialTown = 0;

                alivePlayers.forEach(p => {
                    // We know OUR role is Mafia.
                    // Others are UNKNOWN (potential Town) unless revealed.
                    if (p.role === Role.MAFIA) knownMafia++;
                    else potentialTown++;
                });

                // If Known Mafia >= Potential Town, we have won (or tied for win).
                // In this case, revealing is safe because the game is effectively over.
                if (knownMafia > 0 && knownMafia >= knownMafia + potentialTown - knownMafia) { // Simplifies to knownMafia >= potentialTown
                    if (knownMafia >= potentialTown) {
                        await claimVictory();
                    }
                }
            }

            // 2. TOWN LOGIC (Manual Only)
            // Town players cannot know for sure if they won (dead roles are hidden).
            // Auto-revealing risks doxxing innocent players.
            // Town must use the manual "Claim Victory" button.
        };

        const timer = setTimeout(checkAndClaim, 3000);
        return () => clearTimeout(timer);
    }, [gameState.phase, gameState.players, currentRoomId, myPlayer]);



    const getActionLabel = useCallback(() => {
        if (gameState.phase === GamePhase.VOTING) return "VOTE";
        if (gameState.phase === GamePhase.NIGHT) return "TARGET";
        return "SELECT";
    }, [gameState.phase]);


    const contextValue = useMemo(() => ({
        playerName, setPlayerName, avatarUrl, setAvatarUrl, lobbyName, setLobbyName,
        gameState, setGameState, isTxPending, currentRoomId,
        createLobbyOnChain, joinLobbyOnChain,
        startGameOnChain, commitDeckOnChain, revealDeckOnChain,
        shareKeysToAllOnChain, commitRoleOnChain, confirmRoleOnChain,
        commitAndConfirmRoleOnChain,
        startVotingOnChain, voteOnChain,
        commitNightActionOnChain, revealNightActionOnChain,
        commitMafiaTargetOnChain, revealMafiaTargetOnChain,
        forcePhaseTimeoutOnChain, getInvestigationResultOnChain, endGameAutomaticallyOnChain,
        revealRoleOnChain, tryEndGame, claimVictory, endGameZK,
        sendMafiaMessageOnChain,
        kickStalledPlayerOnChain, refreshPlayersList,
        addLog, handlePlayerAction, myPlayer, canActOnPlayer, getActionLabel,
        selectedTarget, setSelectedTarget,
        isTestMode, setIsTestMode,
        setIsTxPending,
        playerMarks, setPlayerMark,
        setCurrentRoomId
    }), [
        playerName, avatarUrl, lobbyName, gameState, isTxPending, currentRoomId,
        createLobbyOnChain, joinLobbyOnChain, startGameOnChain,
        commitDeckOnChain, revealDeckOnChain, shareKeysToAllOnChain,
        commitRoleOnChain, confirmRoleOnChain, commitAndConfirmRoleOnChain,
        startVotingOnChain, voteOnChain, commitNightActionOnChain,
        revealNightActionOnChain, commitMafiaTargetOnChain, revealMafiaTargetOnChain,
        forcePhaseTimeoutOnChain, getInvestigationResultOnChain, endGameAutomaticallyOnChain, revealRoleOnChain,
        tryEndGame, claimVictory, endGameZK, sendMafiaMessageOnChain,
        kickStalledPlayerOnChain, refreshPlayersList, addLog,
        handlePlayerAction, myPlayer, canActOnPlayer, getActionLabel,
        isTestMode, setIsTestMode,
        selectedTarget,
        playerMarks, setPlayerMark,
        setCurrentRoomId
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