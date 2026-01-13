import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAccount, useWriteContract, usePublicClient, useWatchContractEvent } from 'wagmi';
import { GamePhase, GameState, Player, Role, LogEntry } from '../types';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../contracts/config';
import { generateKeyPair, exportPublicKey } from '../services/cryptoUtils';

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

    // Lobby
    createLobbyOnChain: () => Promise<void>;
    joinLobbyOnChain: (roomId: number) => Promise<void>;
    
    // Shuffle
    startGameOnChain: () => Promise<void>;
    submitDeckOnChain: (deck: string[]) => Promise<void>;
    
    // Reveal
    shareKeyOnChain: (to: string, encryptedKey: string) => Promise<void>;
    confirmRoleOnChain: () => Promise<void>;
    
    // Day/Voting
    startVotingOnChain: () => Promise<void>;
    voteOnChain: (targetAddress: string) => Promise<void>;
    finalizeVotingOnChain: () => Promise<void>;
    
    // Night
    commitNightActionOnChain: (hash: string) => Promise<void>;
    revealNightActionOnChain: (action: number, target: string, salt: string) => Promise<void>;
    finalizeNightOnChain: () => Promise<void>;
    
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
    useEffect(() => {
        if (address) setGameState(prev => ({ ...prev, myPlayerId: address }));
    }, [address]);

    const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        setGameState(prev => ({
            ...prev,
            logs: [...prev.logs, { id: Math.random().toString(36).substr(2, 9), timestamp: timeString, message, type }]
        }));
    }, []);

    // --- DATA SYNC ---
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
                functionName: 'rooms',
                args: [roomId],
            }) as any;

            const formattedPlayers: Player[] = data.map((p: any) => ({
                id: p.wallet,
                name: p.nickname,
                address: p.wallet,
                role: Role.UNKNOWN,
                isAlive: p.isActive,
                hasConfirmedRole: p.hasConfirmedRole,
                avatarUrl: `https://picsum.photos/seed/${p.wallet}/200`,
                votesReceived: 0,
                status: p.isActive ? 'connected' : 'slashed'
            }));

            // roomData tuple: [id, host, phase, maxPlayers, playersCount, dayCount, currentShufflerIndex, lastActionTimestamp]
            const phase = Number(roomData[2]) as GamePhase;
            const dayCount = Number(roomData[5]);

            setGameState(prev => ({ 
                ...prev, 
                players: formattedPlayers,
                phase,
                dayCount
            }));
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

    // --- LOBBY ACTIONS ---

    const createLobbyOnChain = async () => {
        if (!playerName) return alert("Enter name!");
        setIsTxPending(true);
        try {
            const keyPair = await generateKeyPair();
            setKeys(keyPair);
            const pubKey = await exportPublicKey(keyPair.publicKey);

            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'createRoom',
                args: [BigInt(16), playerName, pubKey],
            });
            addLog("Creating room...", "warning");
            await publicClient?.waitForTransactionReceipt({ hash });
            
            const nextId = await publicClient?.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'nextRoomId',
            }) as bigint;
            const newId = nextId - 1n;
            setCurrentRoomId(newId);
            await refreshPlayersList(newId);
            addLog(`Room #${newId} created!`, "success");
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    const joinLobbyOnChain = async (roomId: number) => {
        if (!playerName) return alert("Enter name!");
        setIsTxPending(true);
        try {
            const keyPair = await generateKeyPair();
            setKeys(keyPair);
            const pubKey = await exportPublicKey(keyPair.publicKey);

            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'joinRoom',
                args: [BigInt(roomId), playerName, pubKey],
            });
            addLog("Joining...", "info");
            await publicClient?.waitForTransactionReceipt({ hash });
            setCurrentRoomId(BigInt(roomId));
            await refreshPlayersList(BigInt(roomId));
            addLog("Joined successfully!", "success");
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
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'startShuffle',
                args: [currentRoomId],
            });
            addLog("Starting Shuffle...", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    const submitDeckOnChain = async (deck: string[]) => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'submitDeck',
                args: [currentRoomId, deck],
            });
            addLog("Deck submitted!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    // --- REVEAL PHASE ---

    const shareKeyOnChain = async (to: string, encryptedKey: string) => {
        if (!currentRoomId) return;
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'shareKey',
                args: [currentRoomId, to, encryptedKey],
            });
            addLog(`Key shared with ${to.slice(0,6)}...`, "info");
            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
        }
    };

    const confirmRoleOnChain = async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'confirmRole',
                args: [currentRoomId],
            });
            addLog("Role confirmed.", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    // --- DAY & VOTING ---

    const startVotingOnChain = async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'startVoting',
                args: [currentRoomId],
            });
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
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'vote',
                args: [currentRoomId, targetAddress],
            });
            addLog(`Voted for ${targetAddress.slice(0,6)}...`, "warning");
            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
        }
    };

    const finalizeVotingOnChain = async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'finalizeVoting',
                args: [currentRoomId],
            });
            addLog("Voting finalized!", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    // --- NIGHT PHASE ---

    const commitNightActionOnChain = async (hash: string) => {
        if (!currentRoomId) return;
        try {
            const txHash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'commitNightAction',
                args: [currentRoomId, hash as `0x${string}`],
            });
            addLog("Night action committed!", "info");
            await publicClient?.waitForTransactionReceipt({ hash: txHash });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
        }
    };

    const revealNightActionOnChain = async (action: number, target: string, salt: string) => {
        if (!currentRoomId) return;
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'revealNightAction',
                args: [currentRoomId, action, target, salt],
            });
            addLog("Night action revealed!", "success");
            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
        }
    };

    const finalizeNightOnChain = async () => {
        if (!currentRoomId) return;
        setIsTxPending(true);
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'finalizeNight',
                args: [currentRoomId],
            });
            addLog("Night finalized!", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
            await refreshPlayersList(currentRoomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
        }
    };

    // --- UTILITY ---

    const kickStalledPlayerOnChain = async () => {
        if (!currentRoomId) return;
        try {
            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'kickStalledPlayer',
                args: [currentRoomId],
            });
            addLog("Kick initiated...", "danger");
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
                addLog(`${victim.slice(0,6)}... ${reason}!`, "danger");
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
                addLog(`${kicked.slice(0,6)}... was kicked (AFK)!`, "danger");
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
                addLog(`${player.slice(0,6)}... confirmed role`, "info");
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
                addLog(`${player.slice(0,6)}... shuffled the deck`, "info");
                refreshPlayersList(roomId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS, 
        abi: MAFIA_ABI, 
        eventName: 'KeyShared',
        onLogs: (logs: any) => {
            const roomId = currentRoomIdRef.current;
            if (!roomId) return;
            
            if (BigInt(logs[0].args.roomId) === roomId) {
                const from = logs[0].args.from;
                const to = logs[0].args.to;
                // Только логируем если ключ отправлен мне
                if (to.toLowerCase() === address?.toLowerCase()) {
                    addLog(`Key received from ${from.slice(0,6)}...`, "success");
                }
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
                addLog(`${voter.slice(0,6)}... voted for ${target.slice(0,6)}...`, "warning");
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
                addLog(`${player.slice(0,6)}... committed night action`, "info");
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
                addLog(`${player.slice(0,6)}... revealed action`, "success");
            }
        }
    });

    // Helper для UI
    const handlePlayerAction = (targetId: string) => {
        if (gameState.phase === GamePhase.VOTING) {
            voteOnChain(targetId);
        } else {
            console.log("Not voting phase");
        }
    };

    const myPlayer = gameState.players.find(p => p.address.toLowerCase() === address?.toLowerCase());
    const getActionLabel = () => gameState.phase === GamePhase.VOTING ? "VOTE" : "SELECT";
    const canActOnPlayer = (target: Player) => gameState.phase === GamePhase.VOTING && target.isAlive;

    return (
        <GameContext.Provider value={{
            playerName, setPlayerName, avatarUrl, setAvatarUrl, lobbyName, setLobbyName,
            gameState, setGameState, isTxPending, currentRoomId,
            createLobbyOnChain, joinLobbyOnChain, 
            startGameOnChain, submitDeckOnChain,
            shareKeyOnChain, confirmRoleOnChain,
            startVotingOnChain, voteOnChain, finalizeVotingOnChain,
            commitNightActionOnChain, revealNightActionOnChain, finalizeNightOnChain,
            kickStalledPlayerOnChain, refreshPlayersList,
            addLog, handlePlayerAction, myPlayer, canActOnPlayer, getActionLabel
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