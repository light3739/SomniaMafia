import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAccount, useWriteContract, usePublicClient, useWatchContractEvent } from 'wagmi';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GamePhase, GameState, Player, Role, LogEntry } from '../types';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI, somniaChain } from '../contracts/config';
import { generateKeyPair, exportPublicKey } from '../services/cryptoUtils';
import { loadSession, createNewSession, markSessionRegistered } from '../services/sessionKeyService';

import shotSound from '../assets/mafia_shot.wav';

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
    selectedTarget: string | null;
    setSelectedTarget: (target: string | null) => void;

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
    voteOnChain: (targetAddress: string) => Promise<void>;

    // Night (V4: Mafia uses consensus, Doctor/Detective use commit-reveal)
    commitNightActionOnChain: (hash: string) => Promise<void>;
    revealNightActionOnChain: (action: number, target: string, salt: string) => Promise<void>;
    // Mafia consensus kill (V4)
    commitMafiaTargetOnChain: (targetHash: string) => Promise<void>;
    revealMafiaTargetOnChain: (target: string, salt: string) => Promise<void>;
    endNightOnChain: () => Promise<void>;
    endGameAutomaticallyOnChain: () => Promise<void>;
    // Utility
    kickStalledPlayerOnChain: () => Promise<void>;
    refreshPlayersList: (roomId: bigint) => Promise<void>;

    addLog: (message: string, type?: LogEntry['type']) => void;
    handlePlayerAction: (targetId: string) => void;
    myPlayer: Player | undefined;
    getActionLabel: () => string;
    canActOnPlayer: (target: Player) => boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Session
    const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [lobbyName, setLobbyName] = useState(sessionStorage.getItem('lobbyName') || '');
    const [currentRoomId, setCurrentRoomId] = useState<bigint | null>(
        sessionStorage.getItem('currentRoomId') ? BigInt(sessionStorage.getItem('currentRoomId')!) : null
    );
    const [keys, setKeys] = useState<CryptoKeyPair | null>(null);
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

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

    // Функция для получения session wallet client (вызывается при каждой транзакции)
    const getSessionWalletClient = useCallback(() => {
        const session = loadSession();
        if (!session || !session.registeredOnChain || Date.now() >= session.expiresAt) {
            return null;
        }

        try {
            const account = privateKeyToAccount(session.privateKey);
            return createWalletClient({
                account,
                chain: somniaChain,
                transport: http(),
            });
        } catch {
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

        console.log(`[TX Debug] canUseSession: ${canUseSession}`);

        if (canUseSession) {
            const sessionClient = getSessionWalletClient();
            console.log(`[TX Debug] sessionClient exists: ${!!sessionClient}, address: ${sessionClient?.account?.address}`);
            if (sessionClient) {
                // Используем session key - без попапа!
                console.log(`[Session TX] ${functionName} via session key`);
                try {
                    // Dynamic gas limit based on function type
                    let gasLimit = 500_000n; // Standard for simple actions (vote, commit)

                    if (functionName === 'revealDeck' || functionName === 'shareKeysToAll') {
                        gasLimit = 5_000_000n; // High buffer for heavy shuffle/reveal actions
                    }

                    console.log(`[Session TX] Using dynamic gas limit: ${gasLimit} for ${functionName}`);

                    const hash = await sessionClient.writeContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI as any,
                        functionName,
                        args,
                        gas: gasLimit,
                    });
                    console.log(`[Session TX] Success! Hash: ${hash}`);
                    return hash;
                } catch (err: any) {
                    console.error('[Session TX] Failed:', err.message || err);
                    // Если session key не работает - fallback на main wallet
                    console.log('[Session TX] Falling back to main wallet...');
                }
            }
        }

        // Fallback на main wallet (с попапом)
        console.log(`[Main Wallet TX] ${functionName} - requires signature`);
        return writeContractAsync({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName,
            args,
        });
    }, [getSessionWalletClient, writeContractAsync]);

    const [gameState, setGameState] = useState<GameState>({
        phase: GamePhase.LOBBY,
        dayCount: 0,
        players: [],
        myPlayerId: null,
        logs: [],
        winner: null
    });

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
        if (!publicClient) return;
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

            // V3 GameRoom: {id, host, phase, maxPlayers, playersCount, aliveCount, dayCount, currentShufflerIndex, lastActionTimestamp, confirmedCount, votedCount, committedCount, revealedCount}
            const phase = Number(roomData.phase) as GamePhase;
            const dayCount = Number(roomData.dayCount);

            // DEBUG: Log current phase from contract
            console.log('[Phase Sync]', {
                contractPhase: phase,
                phaseName: GamePhase[phase],
                dayCount,
                aliveCount: Number(roomData.aliveCount),
                committedCount: Number(roomData.committedCount),
                revealedCount: Number(roomData.revealedCount)
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
                        avatarUrl: `https://picsum.photos/seed/${p.wallet}/200`,
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
                    winner: winner || prev.winner // Сохраняем победителя
                };
            });
        } catch (e) {
            console.error("Sync error:", e);
        }
    }, [publicClient]);

    // Initial load
    useEffect(() => {
        if (currentRoomId && publicClient) {
            refreshPlayersList(currentRoomId);
        }
    }, [currentRoomId, publicClient, refreshPlayersList]);

    // Polling для регулярного обновления состояния (backup для events)
    useEffect(() => {
        if (!currentRoomId || !publicClient) return;

        const interval = setInterval(() => {
            refreshPlayersList(currentRoomId);
        }, 5000); // Каждые 5 секунд

        return () => clearInterval(interval);
    }, [currentRoomId, publicClient, refreshPlayersList]);

    // --- LOBBY ACTIONS (V3: createRoom only, then joinRoom with session) ---

    const createLobbyOnChain = async () => {
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

            // 4. АТОМАРНАЯ ТРАНЗАКЦИЯ (Create + Join + Fund)
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'createAndJoin', // <--- НОВАЯ ФУНКЦИЯ
                args: [
                    lobbyName,      // string roomName
                    16,             // uint8 maxPlayers
                    playerName,     // string nickname
                    pubKeyHex,      // bytes publicKey
                    sessionAddress  // address sessionAddress
                ],
                value: parseEther('0.05'), // Деньги для бота (0.02 ETH according to V4)
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
    };

    const joinLobbyOnChain = async (roomId: number) => {
        if (!playerName || !address || !publicClient) return alert("Enter name and connect wallet!");
        setIsTxPending(true);
        try {
            // 1. Generate crypto keys
            const keyPair = await generateKeyPair();
            setKeys(keyPair);
            const pubKeyHex = await exportPublicKey(keyPair.publicKey);

            // 2. Generate session key
            const { sessionAddress } = createNewSession(address, roomId);

            // 3. Join room with session key + fund it (V3: all in one tx)
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'joinRoom',
                args: [BigInt(roomId), playerName, pubKeyHex, sessionAddress],
                value: parseEther('0.05'), // Fund session key (enough for ~30-50 txs)
            });
            addLog("Joining with auto-sign...", "info");
            await publicClient?.waitForTransactionReceipt({ hash });

            // 4. Mark session as registered
            markSessionRegistered();

            setCurrentRoomId(BigInt(roomId));
            await refreshPlayersList(BigInt(roomId));
            addLog("Joined with auto-sign enabled!", "success");
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    // --- SHUFFLE PHASE ---

    const startGameOnChain = async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            // V3: function is 'startGame' not 'startShuffle'
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'startGame',
                args: [currentRoomId],
            });
            addLog("Starting game...", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    // V4: Deck commit-reveal
    const commitDeckOnChain = async (deckHash: string) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('commitDeck', [currentRoomId, deckHash]);
            addLog("Deck committed!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    const revealDeckOnChain = async (deck: string[], salt: string) => {
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
    };

    // --- REVEAL PHASE (V3: batch share keys) ---

    const shareKeysToAllOnChain = async (recipients: string[], encryptedKeys: string[]) => {
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
    };

    const commitRoleOnChain = async (role: number, salt: string) => {
        if (!currentRoomId) return;

        // Если соль уже есть в localStorage, значит мы уже успешно коммитили
        const existingSalt = localStorage.getItem(`role_salt_${currentRoomId}_${address}`);
        if (existingSalt) {
            console.log("Role already committed locally, skipping transaction.");
            return; // Просто выходим, считаем что успех
        }

        setIsTxPending(true);
        try {
            // Импортируем ShuffleService через getShuffleService не получится для статик методов
            const { ShuffleService } = await import('../services/shuffleService');
            const hash = ShuffleService.createRoleCommitHash(role, salt);

            const txHash = await sendGameTransaction('commitRole', [currentRoomId, hash]);
            addLog("Role committed securely on-chain.", "info");
            await publicClient?.waitForTransactionReceipt({ hash: txHash });

            // ВАЖНО: Сохраняем соль в localStorage, иначе в конце игры нас убьют!
            localStorage.setItem(`role_salt_${currentRoomId}_${address}`, salt);

            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || "Role commit failed", "danger");
            setIsTxPending(false);
            throw e;
        }
    };

    const confirmRoleOnChain = async () => {
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
    };

    const commitAndConfirmRoleOnChain = async (role: number, salt: string) => {
        if (!currentRoomId) return;

        // Защита от дурака (если уже есть соль, значит уже отправляли)
        const savedSalt = localStorage.getItem(`role_salt_${currentRoomId}_${address}`);
        if (savedSalt) {
            console.log("Role already committed locally.");
            return;
        }

        setIsTxPending(true);
        try {
            // Импорт сервиса для хеширования
            const { ShuffleService } = await import('../services/shuffleService');
            const hash = ShuffleService.createRoleCommitHash(role, salt);

            // АТОМАРНАЯ ТРАНЗАКЦИЯ (Commit + Confirm)
            const txHash = await sendGameTransaction('commitAndConfirmRole', [currentRoomId, hash]);

            addLog("Role committed & confirmed on-chain!", "success");
            await publicClient?.waitForTransactionReceipt({ hash: txHash });

            // Сохраняем соль
            localStorage.setItem(`role_salt_${currentRoomId}_${address}`, salt);

            // Обновляем список, чтобы UI увидел галочку
            await refreshPlayersList(currentRoomId);

            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || "Confirmation failed", "danger");
            setIsTxPending(false);
            throw e;
        }
    };

    // --- DAY & VOTING ---

    const startVotingOnChain = async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await sendGameTransaction('startVoting', [currentRoomId]);
            addLog("Voting started!", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    const voteOnChain = async (targetAddress: string) => {
        if (!currentRoomId) return;
        try {
            const hash = await sendGameTransaction('vote', [currentRoomId, targetAddress]);
            addLog(`Voted for ${targetAddress.slice(0, 6)}...`, "warning");
            await publicClient?.waitForTransactionReceipt({ hash });
            // V3: auto-finalize when all voted - just refresh
            await refreshPlayersList(currentRoomId);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
        }
    };

    // V3: finalizeVoting removed - auto-triggers on last vote

    // --- NIGHT PHASE (V3: auto-finalize) ---

    const commitNightActionOnChain = async (hash: string) => {
        if (!currentRoomId) return;
        try {
            const txHash = await sendGameTransaction('commitNightAction', [currentRoomId, hash as `0x${string}`]);
            addLog("Night action committed!", "info");
            await publicClient?.waitForTransactionReceipt({ hash: txHash });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            throw e; // Re-throw so caller knows it failed
        }
    };

    const revealNightActionOnChain = async (action: number, target: string, salt: string) => {
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
    };

    // --- V4: MAFIA CONSENSUS KILL FUNCTIONS ---

    const commitMafiaTargetOnChain = async (targetHash: string) => {
        if (!currentRoomId) return;
        try {
            const hash = await sendGameTransaction('commitMafiaTarget', [currentRoomId, targetHash as `0x${string}`]);
            addLog("Mafia target committed!", "info");
            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        }
    };

    const revealMafiaTargetOnChain = async (target: string, salt: string) => {
        if (!currentRoomId) return;
        try {
            const hash = await sendGameTransaction('revealMafiaTarget', [currentRoomId, target, salt]);
            addLog("Mafia target revealed!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        }
    };

    const endNightOnChain = async () => {
        if (!currentRoomId) return;
        try {
            const hash = await sendGameTransaction('endNight', [currentRoomId]);
            addLog("Night ended!", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        }
    };

    const endGameAutomaticallyOnChain = async () => {
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
    };

    // --- UTILITY ---

    // V4: forcePhaseTimeout - kicks stalled player and advances phase
    const kickStalledPlayerOnChain = async () => {
        if (!currentRoomId) return;
        try {
            const hash = await sendGameTransaction('forcePhaseTimeout', [currentRoomId]);
            addLog("Force timeout initiated...", "danger");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
        }
    };

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
                    addLog(`${log.args.nickname} joined!`, "info");
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
                addLog("Shuffle started!", "phase");
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
                addLog("Voting has started!", "phase");
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
                addLog("Night falls...", "phase");
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
        eventName: 'RoleConfirmed',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const player = logs[0].args.player;
                addLog(`${player.slice(0, 6)}... confirmed role`, "info");
                refreshPlayersList(roomId);
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
                addLog("All roles confirmed! Day begins...", "phase");
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
                addLog("All players shared keys! Decrypt your role.", "success");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'DeckSubmitted',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const player = logs[0].args.byPlayer;
                const nextIndex = Number(logs[0].args.nextIndex);
                addLog(`${player.slice(0, 6)}... shuffled the deck`, "info");
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
                addLog(`${from.slice(0, 6)}... shared decryption keys`, "success");
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
                addLog(`${voter.slice(0, 6)}... voted for ${target.slice(0, 6)}...`, "warning");
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
                    addLog(`${eliminated.slice(0, 6)}... was eliminated with ${voteCount} votes!`, "danger");
                } else {
                    addLog("No one was eliminated - no majority reached.", "warning");
                }
                refreshPlayersList(roomId);
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
                        addLog(`Someone was saved by the doctor!`, "success");
                    } else {
                        addLog(`${killed.slice(0, 6)}... was killed during the night!`, "danger");
                    }
                } else {
                    addLog("The night passes peacefully...", "info");
                }
                refreshPlayersList(roomId);
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
                addLog(`${player.slice(0, 6)}... committed night action`, "info");

                // Play shot sound
                try {
                    const audio = new Audio(shotSound);
                    audio.volume = 0.2;
                    audio.play().catch(e => console.error("Audio play failed:", e));
                } catch (e) {
                    console.error("Audio error:", e);
                }
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'NightActionRevealed',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;

            if (BigInt(logs[0].args.roomId) === roomId) {
                const player = logs[0].args.player;
                addLog(`${player.slice(0, 6)}... revealed action`, "success");
            }
        }
    });

    // Helper для UI - works for both VOTING and NIGHT phases
    const handlePlayerAction = (targetId: string) => {
        if (gameState.phase === GamePhase.VOTING || gameState.phase === GamePhase.NIGHT) {
            setSelectedTarget(prev => prev === targetId ? null : targetId);
        } else {
            console.log("Cannot select player in this phase");
        }
    };

    // Ищем myPlayer: если myPlayerId установлен (тестовый режим), используем его, иначе - адрес кошелька
    const myPlayerById = gameState.myPlayerId
        ? gameState.players.find(p => p.address.toLowerCase() === gameState.myPlayerId?.toLowerCase())
        : null;
    const myPlayerByWallet = gameState.players.find(p => p.address.toLowerCase() === address?.toLowerCase());
    // Приоритет: myPlayerId (тестовый режим) > адрес кошелька
    const myPlayer = myPlayerById || myPlayerByWallet;

    const getActionLabel = () => {
        if (gameState.phase === GamePhase.VOTING) return "VOTE";
        if (gameState.phase === GamePhase.NIGHT) return "TARGET";
        return "SELECT";
    };

    // Check if current player can act on target
    const canActOnPlayer = (target: Player) => {
        if (!target.isAlive) return false;

        if (gameState.phase === GamePhase.VOTING) {
            return true;
        }

        if (gameState.phase === GamePhase.NIGHT) {
            // Only roles with night abilities can act
            const myRole = myPlayer?.role;
            if (myRole === Role.MAFIA || myRole === Role.DETECTIVE || myRole === Role.DOCTOR) {
                // Doctor can target self, others cannot
                if (myRole !== Role.DOCTOR && target.address.toLowerCase() === myPlayer?.address.toLowerCase()) {
                    return false;
                }
                return true;
            }
            return false; // Civilians cannot act at night
        }

        return false;
    };

    return (
        <GameContext.Provider value={{
            playerName, setPlayerName, avatarUrl, setAvatarUrl, lobbyName, setLobbyName,
            gameState, setGameState, isTxPending, currentRoomId,
            createLobbyOnChain, joinLobbyOnChain,
            startGameOnChain, commitDeckOnChain, revealDeckOnChain,
            shareKeysToAllOnChain, commitRoleOnChain, confirmRoleOnChain,
            commitAndConfirmRoleOnChain,
            startVotingOnChain, voteOnChain,
            commitNightActionOnChain, revealNightActionOnChain,
            commitMafiaTargetOnChain, revealMafiaTargetOnChain,
            endNightOnChain, endGameAutomaticallyOnChain,
            kickStalledPlayerOnChain, refreshPlayersList,
            addLog, handlePlayerAction, myPlayer, canActOnPlayer, getActionLabel,
            selectedTarget, setSelectedTarget
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGameContext = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error("GameProvider error");
    return context;
};