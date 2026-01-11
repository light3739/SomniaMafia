import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { GamePhase, GameState, Player, Role, LogEntry } from '../types';

// --- MOCK DATA ---
const MOCK_PLAYERS: Player[] = Array.from({ length: 8 }).map((_, i) => ({
    id: `p-${i}`,
    name: `Player ${i + 1}`,
    nickname: `User${i + 1}`,
    address: `0x${Math.random().toString(16).slice(2, 42)}`,
    role: Role.CIVILIAN, // Will be shuffled
    isAlive: true,
    avatarUrl: `https://picsum.photos/seed/${i + 200}/200`,
    votesReceived: 0,
    status: 'connected'
}));

interface GameContextType {
    // Session State
    playerName: string;
    setPlayerName: (name: string) => void;
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    lobbyName: string;
    setLobbyName: (name: string) => void;

    // Game State
    gameState: GameState;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>; // Expose setter for advanced usage if needed
    isZkGenerating: boolean;

    // Actions
    addLog: (message: string, type?: LogEntry['type']) => void;
    startGame: () => Promise<void>;
    handleNextPhase: () => Promise<void>;
    handlePlayerAction: (targetId: string) => void;
    myPlayer: Player | undefined;

    // Helper
    getActionLabel: () => string;
    canActOnPlayer: (target: Player) => boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // --- Session State ---
    const [playerName, setPlayerName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [lobbyName, setLobbyName] = useState('');

    // --- Game State ---
    const [gameState, setGameState] = useState<GameState>({
        phase: GamePhase.LOBBY,
        dayCount: 0,
        players: [],
        myPlayerId: null,
        logs: [],
        winner: null
    });
    const [isZkGenerating, setIsZkGenerating] = useState(false);
    const { address, isConnected } = useAccount();

    // --- LOGGING ---
    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        setGameState(prev => ({
            ...prev,
            logs: [...prev.logs, {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: timeString,
                message,
                type
            }]
        }));
    };

    // --- CONNECTION EFFECT ---
    useEffect(() => {
        if (isConnected && address && !gameState.myPlayerId) {
            const myId = 'p-0';
            // Update our player with real address
            const realPlayers = MOCK_PLAYERS.map((p, i) =>
                i === 0 ? { ...p, address: address, name: playerName || p.name } : p
            );

            setGameState(prev => ({
                ...prev,
                players: realPlayers,
                myPlayerId: myId
            }));
            addLog(`Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`, 'success');
        } else if (!isConnected && gameState.myPlayerId) {
            setGameState(prev => ({
                ...prev,
                myPlayerId: null,
                players: []
            }));
            addLog("Wallet disconnected.", 'warning');
        }
    }, [isConnected, address, gameState.myPlayerId, playerName]);

    // --- GAME ACTIONS ---
    const startGame = async () => {
        if (isZkGenerating) return;
        setIsZkGenerating(true);

        // 1. ZK Initialization with Threshold Logic
        addLog("TX: joinGame() submitted...", 'phase');
        await new Promise(r => setTimeout(r, 500));
        addLog("TX Confirmed: Staked 0.01 ETH", 'success');

        addLog("Phase: SHUFFLE started on-chain.", 'phase');

        // Simulate player 7 being slow/offline
        setGameState(prev => ({
            ...prev,
            players: prev.players.map((p, i) => i === 7 ? { ...p, status: 'syncing' } : p)
        }));

        addLog("Generating ZK-SNARK Proof (Groth16)...", 'info');
        await new Promise(r => setTimeout(r, 1200));

        addLog("TX: submitShuffleProof(0x4a...2b) sent.", 'info');
        await new Promise(r => setTimeout(r, 800));
        addLog("Contract: Proof Verified. State Updated.", 'success');

        // Simulate timeout warning
        addLog("Contract: Waiting for Player 8...", 'warning');
        await new Promise(r => setTimeout(r, 1000));

        addLog("TX: slashTimeout(Player8) triggered by Validator.", 'danger');

        setGameState(prev => ({
            ...prev,
            players: prev.players.map((p, i) => i === 7 ? { ...p, status: 'slashed', isAlive: false } : { ...p, status: 'connected' })
        }));

        await new Promise(r => setTimeout(r, 800));
        addLog("Contract: Roles Assigned. Moving to Reveal.", 'success');

        // 2. Assign Roles (Logic)
        const newPlayers = [...gameState.players];
        const roles = [Role.MAFIA, Role.MAFIA, Role.DOCTOR, Role.DETECTIVE, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN];
        roles.sort(() => Math.random() - 0.5);

        newPlayers.forEach((p, i) => {
            if (p.status !== 'slashed') {
                p.role = roles[i];
            } else {
                p.role = Role.UNKNOWN;
            }
        });

        const myPlayerCalc = newPlayers.find(p => p.id === gameState.myPlayerId);

        setGameState(prev => ({
            ...prev,
            players: newPlayers,
            phase: GamePhase.ROLE_REVEAL,
            dayCount: 1
        }));

        setIsZkGenerating(false);
        addLog(`Decrypted Role: ${myPlayerCalc?.role}`, 'success');
    };

    const handleNextPhase = async () => {
        let nextPhase = gameState.phase;
        let updatedPlayers = [...gameState.players];

        // State Machine Logic
        if (gameState.phase === GamePhase.ROLE_REVEAL) {
            nextPhase = GamePhase.NIGHT;
            addLog(`Contract: Phase changed to NIGHT.`, 'phase');

        } else if (gameState.phase === GamePhase.NIGHT) {
            nextPhase = GamePhase.DAY;
            // Simulate Night Actions
            const aliveCivilians = updatedPlayers.filter(p => p.isAlive && p.role !== Role.MAFIA && p.status !== 'slashed');

            if (aliveCivilians.length > 0) {
                const victimIndex = Math.floor(Math.random() * aliveCivilians.length);
                const victim = aliveCivilians[victimIndex];
                const actualIdx = updatedPlayers.findIndex(p => p.id === victim.id);

                updatedPlayers[actualIdx].isAlive = false;
                addLog(`Oracle: Player ${victim.name} is DEAD.`, 'danger');
            } else {
                addLog("Oracle: No deaths recorded.", 'success');
            }

        } else if (gameState.phase === GamePhase.DAY) {
            nextPhase = GamePhase.VOTING;
            addLog("Contract: Phase changed to VOTING.", 'phase');

        } else if (gameState.phase === GamePhase.VOTING) {
            nextPhase = GamePhase.NIGHT;
            // Simulate Voting Result
            const alive = updatedPlayers.filter(p => p.isAlive && p.status !== 'slashed');
            const exiledIndex = Math.floor(Math.random() * alive.length);
            const exiled = alive[exiledIndex];
            const actualIdx = updatedPlayers.findIndex(p => p.id === exiled.id);
            updatedPlayers[actualIdx].isAlive = false;

            addLog(`Contract: Vote finalized. ${exiled.name} exiled.`, 'danger');

            // Update Day Count
            setGameState(prev => ({ ...prev, dayCount: prev.dayCount + 1 }));
        }

        setGameState(prev => ({
            ...prev,
            phase: nextPhase,
            players: updatedPlayers
        }));
    };

    const handlePlayerAction = (targetId: string) => {
        const target = gameState.players.find(p => p.id === targetId);
        if (!target) return;

        if (gameState.phase === GamePhase.VOTING) {
            addLog(`TX: vote(${target.address}) pending...`, 'info');
            setTimeout(() => addLog("TX Confirmed: Vote cast.", 'success'), 500);
        } else {
            addLog(`TX: submitAction(${target.address}) encrypted...`, 'info');
        }
    };

    const myPlayer = gameState.players.find(p => p.id === gameState.myPlayerId);

    const canActOnPlayer = (target: Player) => {
        if (gameState.phase === GamePhase.VOTING && myPlayer?.isAlive) return true;
        if (gameState.phase === GamePhase.NIGHT && myPlayer?.role === Role.MAFIA && myPlayer.isAlive) return true;
        if (gameState.phase === GamePhase.NIGHT && myPlayer?.role === Role.DOCTOR && myPlayer.isAlive) return true;
        if (gameState.phase === GamePhase.NIGHT && myPlayer?.role === Role.DETECTIVE && myPlayer.isAlive) return true;
        return false;
    };

    const getActionLabel = () => {
        if (gameState.phase === GamePhase.VOTING) return "VOTE";
        if (myPlayer?.role === Role.MAFIA) return "KILL";
        if (myPlayer?.role === Role.DOCTOR) return "SAVE";
        if (myPlayer?.role === Role.DETECTIVE) return "CHECK";
        return "SELECT";
    };

    return (
        <GameContext.Provider value={{
            playerName, setPlayerName,
            avatarUrl, setAvatarUrl,
            lobbyName, setLobbyName,
            gameState, setGameState,
            isZkGenerating,
            addLog, startGame, handleNextPhase, handlePlayerAction,
            myPlayer, canActOnPlayer, getActionLabel
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGameContext = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error("useGameContext must be used within a GameProvider");
    }
    return context;
};
