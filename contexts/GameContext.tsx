import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

    createLobbyOnChain: () => Promise<void>;
    joinLobbyOnChain: (roomId: number) => Promise<void>;
    startGameOnChain: () => Promise<void>;
    confirmRoleOnChain: () => Promise<void>;

    handleNextPhase: () => void;
    addLog: (message: string, type?: LogEntry['type']) => void;
    handlePlayerAction: (targetId: string) => void;
    myPlayer: Player | undefined;
    getActionLabel: () => string;
    canActOnPlayer: (target: Player) => boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [playerName, setPlayerName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [lobbyName, setLobbyName] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState<bigint | null>(null);
    const [keys, setKeys] = useState<CryptoKeyPair | null>(null);

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

    // Синхронизируем myPlayerId с адресом кошелька
    useEffect(() => {
        if (address) {
            setGameState(prev => ({ ...prev, myPlayerId: address }));
        }
    }, [address]);

    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        setGameState(prev => ({
            ...prev,
            logs: [...prev.logs, { id: Math.random().toString(36).substr(2, 9), timestamp: timeString, message, type }]
        }));
    };

    // Вспомогательная функция для обновления списка игроков из блокчейна
    const refreshPlayersList = async (roomId: bigint) => {
        if (!publicClient) return;
        try {
            const data = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getPlayers',
                args: [roomId],
            }) as any[];

            const formattedPlayers: Player[] = data.map((p: any) => ({
                id: p.wallet,
                name: p.nickname,
                address: p.wallet,
                role: Role.UNKNOWN,
                isAlive: true,
                avatarUrl: `https://picsum.photos/seed/${p.wallet}/200`,
                votesReceived: 0,
                status: 'connected'
            }));

            setGameState(prev => ({ ...prev, players: formattedPlayers }));
        } catch (e) {
            console.error("Failed to fetch players:", e);
        }
    };

    // 1. Создать Лобби
    const createLobbyOnChain = async () => {
        if (!playerName || !address) return alert("Setup profile first!");
        setIsTxPending(true);

        try {
            const keyPair = await generateKeyPair();
            const pubKey = await exportPublicKey(keyPair.publicKey);

            console.log("Creating room with:", { playerName, pubKey }); // Лог для отладки

            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'createRoom',
                args: [BigInt(16), playerName, pubKey],
            });

            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            console.error("Full error object:", e);
            addLog(e.shortMessage || "User rejected or internal error", "danger");
            setIsTxPending(false);
        }
    };
    // 2. Войти в Лобби
    const joinLobbyOnChain = async (roomId: number) => {
        if (!playerName) return alert("Please set your name in Profile first!");
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
            setCurrentRoomId(BigInt(roomId));
            addLog(`Joining room #${roomId}...`, "info");
            await publicClient?.waitForTransactionReceipt({ hash });

            await refreshPlayersList(BigInt(roomId));
        } catch (e: any) {
            addLog(e.message, "danger");
            setIsTxPending(false);
        }
    };

    // 3. Старт игры (только хост)
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
            addLog("Initiating on-chain shuffle...", "phase");
            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            addLog(e.message, "danger");
            setIsTxPending(false);
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
            await publicClient?.waitForTransactionReceipt({ hash });
        } catch (e: any) {
            addLog(e.message, "danger");
            setIsTxPending(false);
        }
    };

    // --- СЛУШАТЕЛИ СОБЫТИЙ (Real-time Sync) ---

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'RoomCreated',
        onLogs(logs: any) {
            const log = logs[0];
            if (log.args.host.toLowerCase() === address?.toLowerCase()) {
                const newId = log.args.roomId;
                setCurrentRoomId(newId);
                setIsTxPending(false);
                addLog(`Room #${newId} created successfully!`, "success");
                refreshPlayersList(newId);
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'PlayerJoined',
        onLogs(logs: any) {
            logs.forEach((log: any) => {
                if (currentRoomId && BigInt(log.args.roomId) === currentRoomId) {
                    addLog(`${log.args.nickname} joined the room.`, "info");
                    refreshPlayersList(currentRoomId); // Перечитываем список при каждом входе
                }
            });
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'GameStarted',
        onLogs(logs: any) {
            if (currentRoomId && BigInt(logs[0].args.roomId) === currentRoomId) {
                setGameState(prev => ({ ...prev, phase: GamePhase.SHUFFLING }));
                setIsTxPending(false);
                addLog("Shuffle started! Check your roles soon...", "phase");
            }
        }
    });

    useWatchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        eventName: 'DayStarted',
        onLogs(logs: any) {
            if (currentRoomId && BigInt(logs[0].args.roomId) === currentRoomId) {
                setGameState(prev => ({
                    ...prev,
                    phase: GamePhase.DAY,
                    dayCount: Number(logs[0].args.dayNumber)
                }));
                addLog(`Day ${logs[0].args.dayNumber} has begun.`, "success");
            }
        }
    });

    // --- UI HELPERS ---

    const handlePlayerAction = (id: string) => {
        addLog(`Action targeted at: ${id.slice(0, 6)}...`, "info");
    };

    const handleNextPhase = () => {
        // В будущем это будет вызов контракта, пока оставим локально для тестов UI
        addLog("Dev: Manual phase shift", "warning");
    };

    const myPlayer = gameState.players.find(p => p.address.toLowerCase() === address?.toLowerCase());

    const getActionLabel = () => {
        if (gameState.phase === GamePhase.VOTING) return "VOTE";
        if (myPlayer?.role === Role.MAFIA) return "KILL";
        return "SELECT";
    };

    const canActOnPlayer = (_target: Player) => {
        return gameState.phase !== GamePhase.LOBBY;
    };

    return (
        <GameContext.Provider value={{
            playerName, setPlayerName, avatarUrl, setAvatarUrl, lobbyName, setLobbyName,
            gameState, setGameState, isTxPending, currentRoomId,
            createLobbyOnChain, joinLobbyOnChain, startGameOnChain, confirmRoleOnChain,
            addLog, handlePlayerAction, handleNextPhase, myPlayer, canActOnPlayer, getActionLabel
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGameContext = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error("useGameContext must be used within a GameProvider");
    return context;
};