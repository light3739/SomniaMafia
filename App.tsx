import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GamePhase, GameState, Player, Role, LogEntry } from './types';
import { PlayerCard } from './components/PlayerCard';
import { SystemLog } from './components/Narrator';
import { GameControls } from './components/GameControls';
import { Wallet, Play, Cpu, ShieldCheck, Lock, Users, FileCode, CheckCircle, Code } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

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

// Placeholder for the contract code to display in UI
const CONTRACT_CODE_SNIPPET = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IZKVerifier {
    function verifyProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool);
}

contract SomniaMafia {
    enum GamePhase { LOBBY, SHUFFLE, NIGHT, DAY, VOTING, ENDED }

    struct Player {
        address wallet;
        uint256 stake;
        bool isAlive;
        bool hasActed;
    }

    uint256 public constant MIN_STAKE = 0.01 ether;
    uint256 public constant ACTION_TIMEOUT = 120 seconds;
    uint8 public constant MAX_PLAYERS = 8;

    GamePhase public currentPhase;
    uint256 public lastPhaseChangeTime;
    address[] public playerAddresses;
    
    mapping(address => Player) public players;
    mapping(address => bool) public hasJoined;
    mapping(address => address) public votes;
    mapping(address => uint256) public voteCounts;

    IZKVerifier public verifier;

    event PlayerJoined(address indexed player, uint256 stake);
    event PhaseChanged(GamePhase newPhase);
    event ActionSubmitted(address indexed player, string actionType);
    event PlayerSlashed(address indexed player, uint256 amount);
    event PlayerEliminated(address indexed player);
    event GameReset();

    constructor(address _verifier) {
        verifier = IZKVerifier(_verifier);
        currentPhase = GamePhase.LOBBY;
    }

    modifier onlyPhase(GamePhase _phase) {
        require(currentPhase == _phase, "Invalid phase");
        _;
    }

    modifier onlyAlive() {
        require(players[msg.sender].isAlive, "Player is dead");
        _;
    }

    function joinGame() external payable {
        require(currentPhase == GamePhase.LOBBY, "Game active");
        require(msg.value >= MIN_STAKE, "Stake too low");
        require(!hasJoined[msg.sender], "Already joined");
        require(playerAddresses.length < MAX_PLAYERS, "Lobby full");

        players[msg.sender] = Player({
            wallet: msg.sender,
            stake: msg.value,
            isAlive: true,
            hasActed: false
        });

        hasJoined[msg.sender] = true;
        playerAddresses.push(msg.sender);

        emit PlayerJoined(msg.sender, msg.value);

        if (playerAddresses.length == MAX_PLAYERS) {
            _setPhase(GamePhase.SHUFFLE);
        }
    }

    function submitShuffleProof(bytes calldata proof, uint256[] calldata inputs) external onlyPhase(GamePhase.SHUFFLE) onlyAlive {
        require(!players[msg.sender].hasActed, "Already submitted");
        require(verifier.verifyProof(proof, inputs), "Invalid ZK proof");

        players[msg.sender].hasActed = true;
        emit ActionSubmitted(msg.sender, "SHUFFLE");

        if (_checkAllActed()) {
            _setPhase(GamePhase.NIGHT);
        }
    }

    function commitNightAction(bytes32 actionHash) external onlyPhase(GamePhase.NIGHT) onlyAlive {
        require(!players[msg.sender].hasActed, "Already acted");
        
        players[msg.sender].hasActed = true;
        emit ActionSubmitted(msg.sender, "NIGHT_COMMIT");

        if (_checkAllActed()) {
            _setPhase(GamePhase.DAY);
        }
    }

    function castVote(address target) external onlyPhase(GamePhase.VOTING) onlyAlive {
        require(players[target].isAlive, "Target dead");
        require(votes[msg.sender] == address(0), "Already voted");

        votes[msg.sender] = target;
        voteCounts[target]++;
        players[msg.sender].hasActed = true;
        
        emit ActionSubmitted(msg.sender, "VOTE");

        if (_checkAllActed()) {
            _resolveVoting();
        }
    }

    function slashTimeout(address target) external {
        require(currentPhase != GamePhase.LOBBY && currentPhase != GamePhase.ENDED, "Cannot slash");
        require(block.timestamp > lastPhaseChangeTime + ACTION_TIMEOUT, "Timeout not reached");
        require(players[target].isAlive && !players[target].hasActed, "Invalid target");

        uint256 slashedAmount = players[target].stake;
        players[target].stake = 0;
        players[target].isAlive = false;
        
        emit PlayerSlashed(target, slashedAmount);

        if (_checkAllActed()) {
             _advancePhase();
        }
    }

    function _setPhase(GamePhase _nextPhase) internal {
        currentPhase = _nextPhase;
        lastPhaseChangeTime = block.timestamp;
        _resetTurn();
        emit PhaseChanged(_nextPhase);
    }

    function _resetTurn() internal {
        for (uint i = 0; i < playerAddresses.length; i++) {
            address p = playerAddresses[i];
            players[p].hasActed = false;
            votes[p] = address(0);
            voteCounts[p] = 0;
        }
    }

    function _checkAllActed() internal view returns (bool) {
        for (uint i = 0; i < playerAddresses.length; i++) {
            if (players[playerAddresses[i]].isAlive && !players[playerAddresses[i]].hasActed) {
                return false;
            }
        }
        return true;
    }

    function _resolveVoting() internal {
        address maxVoted = address(0);
        uint256 maxCount = 0;
        bool tie = false;

        for (uint i = 0; i < playerAddresses.length; i++) {
            address p = playerAddresses[i];
            if (players[p].isAlive) {
                if (voteCounts[p] > maxCount) {
                    maxCount = voteCounts[p];
                    maxVoted = p;
                    tie = false;
                } else if (voteCounts[p] == maxCount && maxCount > 0) {
                    tie = true;
                }
            }
        }

        if (maxVoted != address(0) && !tie) {
            players[maxVoted].isAlive = false;
            emit PlayerEliminated(maxVoted);
        }

        _setPhase(GamePhase.NIGHT);
    }

    function _advancePhase() internal {
        if (currentPhase == GamePhase.SHUFFLE) _setPhase(GamePhase.NIGHT);
        else if (currentPhase == GamePhase.NIGHT) _setPhase(GamePhase.DAY);
        else if (currentPhase == GamePhase.DAY) _setPhase(GamePhase.VOTING);
        else if (currentPhase == GamePhase.VOTING) _resolveVoting();
    }
}`;

const App: React.FC = () => {
    // Game State
    const [gameState, setGameState] = useState<GameState>({
        phase: GamePhase.LOBBY,
        dayCount: 0,
        players: [],
        myPlayerId: null,
        logs: [],
        winner: null
    });

    const [activeTab, setActiveTab] = useState<'game' | 'contract'>('game');
    const [isZkGenerating, setIsZkGenerating] = useState(false);

    // --- LOGGING SYSTEM ---
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

    // --- ACTIONS ---

    const { address, isConnected } = useAccount();

    useEffect(() => {
        if (isConnected && address && !gameState.myPlayerId) {
            const myId = 'p-0';
            // Update our player with real address
            const realPlayers = MOCK_PLAYERS.map((p, i) =>
                i === 0 ? { ...p, address: address } : p
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
    }, [isConnected, address, gameState.myPlayerId]);



    const startGame = async () => {
        if (isZkGenerating) return;
        setIsZkGenerating(true);
        setActiveTab('game');

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

        const myPlayer = newPlayers.find(p => p.id === gameState.myPlayerId);

        setGameState(prev => ({
            ...prev,
            players: newPlayers,
            phase: GamePhase.ROLE_REVEAL,
            dayCount: 1
        }));

        setIsZkGenerating(false);

        addLog(`Decrypted Role: ${myPlayer?.role}`, 'success');
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

    // --- HELPERS ---
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
        <div className="min-h-screen bg-black text-white selection:bg-green-500 selection:text-black pb-20 font-sans">

            {/* Header */}
            <header className="p-6 flex justify-between items-center border-b border-white/10 bg-[#0a0a0a]">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-green-500 blur-sm opacity-50"></div>
                        <div className="w-8 h-8 bg-black border border-green-500/50 rounded flex items-center justify-center relative z-10">
                            <ShieldCheck className="w-5 h-5 text-green-500" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight font-mono">SOMNIA_MAFIA<span className="text-green-500 animate-pulse">_ZK</span></h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {gameState.myPlayerId && (
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded border border-white/10">
                            <Users className="w-3 h-3 text-purple-400" />
                            <span className="text-[10px] uppercase text-gray-400 font-mono">Peers: 7/8</span>
                        </div>
                    )}
                    <ConnectButton />
                </div>
            </header>

            {/* Tabs */}
            <div className="container mx-auto px-4 mt-6 border-b border-white/10 flex gap-6">
                <button
                    onClick={() => setActiveTab('game')}
                    className={`pb-3 font-mono text-sm font-bold transition-colors border-b-2 ${activeTab === 'game' ? 'text-green-400 border-green-500' : 'text-gray-500 border-transparent hover:text-white'}`}
                >
                    GAME_INTERFACE
                </button>
                <button
                    onClick={() => setActiveTab('contract')}
                    className={`pb-3 font-mono text-sm font-bold transition-colors border-b-2 ${activeTab === 'contract' ? 'text-purple-400 border-purple-500' : 'text-gray-500 border-transparent hover:text-white'}`}
                >
                    SMART_CONTRACT.sol
                </button>
            </div>

            <main className="container mx-auto px-4 pt-8">

                {/* CONTRACT VIEW */}
                {activeTab === 'contract' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl mx-auto"
                    >
                        <div className="bg-[#111] rounded-xl border border-white/10 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <FileCode className="w-4 h-4 text-purple-400" />
                                    <span className="text-sm font-mono text-gray-300">contracts/SomniaMafia.sol</span>
                                </div>
                                <div className="flex items-center gap-2 px-2 py-1 bg-green-900/20 rounded border border-green-900/50">
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                    <span className="text-[10px] text-green-400 font-mono">COMPILED</span>
                                </div>
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <pre className="text-xs md:text-sm font-mono text-gray-300 leading-relaxed">
                                    {CONTRACT_CODE_SNIPPET}
                                </pre>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* GAME INTERFACE */}
                {activeTab === 'game' && (
                    <>
                        {gameState.phase === GamePhase.LOBBY && (
                            <div className="flex flex-col items-center justify-center min-h-[50vh] relative">
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="mb-6 p-4 rounded-full bg-white/5 border border-white/10">
                                        <Code className="w-12 h-12 text-gray-400" />
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-6 font-mono tracking-tighter">
                                        SOMNIA <span className="text-purple-500">ZK-MAFIA</span>
                                    </h2>
                                    <p className="text-gray-400 mb-8 max-w-md text-center font-light leading-relaxed">
                                        Interact with the smart contract logic directly from the UI.
                                        Uses <span className="text-green-400 font-mono">ethers.js</span> and mock ZK-SNARKs.
                                    </p>

                                    {gameState.myPlayerId && (
                                        <button
                                            onClick={startGame}
                                            disabled={isZkGenerating}
                                            className={`px-10 py-4 bg-green-600 hover:bg-green-500 text-black rounded font-mono font-bold text-lg flex items-center gap-3 transition-all shadow-xl shadow-green-900/20 ${isZkGenerating ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            {isZkGenerating ? (
                                                <>
                                                    <Cpu className="w-5 h-5 animate-spin" /> EXECUTING TXs...
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-5 h-5" /> START_GAME_ON_CHAIN
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {gameState.phase !== GamePhase.LOBBY && (
                            <>
                                <SystemLog logs={gameState.logs} />

                                {/* Grid of Players */}
                                <motion.div
                                    layout
                                    className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-24"
                                >
                                    {gameState.players.map((player) => (
                                        <PlayerCard
                                            key={player.id}
                                            player={player}
                                            isMe={player.id === gameState.myPlayerId}
                                            onAction={handlePlayerAction}
                                            canAct={canActOnPlayer(player)}
                                            actionLabel={getActionLabel()}
                                        />
                                    ))}
                                </motion.div>

                                {/* Sticky Controls */}
                                <div className="fixed bottom-0 left-0 right-0 z-50 px-4 md:px-8 pb-4">
                                    <div className="max-w-4xl mx-auto shadow-2xl shadow-black rounded-xl overflow-hidden border border-white/10">
                                        <GameControls
                                            phase={gameState.phase}
                                            myRole={myPlayer?.role || null}
                                            dayCount={gameState.dayCount}
                                            onNextPhase={handleNextPhase}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </main>

            {/* Grid Overlay */}
            <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20"
                style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>

        </div>
    );
};

export default App;