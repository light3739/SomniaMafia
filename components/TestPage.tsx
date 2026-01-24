import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { BackButton } from './ui/BackButton';
import { PlayerCard } from './PlayerCard';

import { SystemLog } from './Narrator';
import { MainPage } from './MainPage';
import { SetupProfile } from './lobby_flow/SetupProfile';
import { CreateLobby } from './lobby_flow/CreateLobby';
import { JoinLobby } from './lobby_flow/JoinLobby';
import { WaitingRoom } from './lobby_flow/WaitingRoom';
import { GameLayout } from './game/GameLayout';
import { ShufflePhase } from './game/ShufflePhase';
import { RoleReveal } from './game/RoleReveal';
import { PlayerSpot } from './game/PlayerSpot';
import { GamePhase, Role, Player, MafiaChatMessage } from '../types';
import { VotingAnnouncement } from './game/VotingAnnouncement';
import { NightAnnouncement } from './game/NightAnnouncement';
import { MafiaChat } from './game/MafiaChat';
import { useGameContext } from '../contexts/GameContext';
import { Skull, Shield, Search, Users, EyeOff } from 'lucide-react';

// Wrapper for testing VotingAnnouncement state
const VotingAnnouncementWrapper = () => {
    const [show, setShow] = useState(false);
    return (
        <div className="flex flex-col items-center gap-4">
            <Button onClick={() => setShow(true)}>Trigger Voting Animation</Button>
            <VotingAnnouncement show={show} onComplete={() => setShow(false)} />
        </div>
    );
};

// Wrapper for testing NightAnnouncement state
const NightAnnouncementWrapper = () => {
    const [show, setShow] = useState(false);
    return (
        <div className="flex flex-col items-center gap-4">
            <Button onClick={() => setShow(true)}>Trigger Night Animation</Button>
            <NightAnnouncement show={show} onComplete={() => setShow(false)} />
        </div>
    );
};

// === TEST WRAPPERS FOR NIGHT PHASE WITH SPECIFIC ROLES ===

// Generate mock players for testing
const generateMockPlayers = (myRole: Role, myAddress: `0x${string}`): Player[] => {
    return [
        { id: '1', name: 'You (Test)', role: myRole, isAlive: true, address: myAddress, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
        { id: '2', name: 'Alice (Civilian)', role: Role.CIVILIAN, isAlive: true, address: '0x2222222222222222222222222222222222222222' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: true, hasNightRevealed: true },
        { id: '3', name: 'Bob (Civilian)', role: Role.CIVILIAN, isAlive: true, address: '0x3333333333333333333333333333333333333333' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
        { id: '4', name: 'Charlie (Mafia)', role: Role.MAFIA, isAlive: true, address: '0x4444444444444444444444444444444444444444' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: true, hasNightRevealed: true },
        { id: '5', name: 'Diana (Doctor)', role: Role.DOCTOR, isAlive: true, address: '0x5555555555555555555555555555555555555555' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: true, hasNightRevealed: true },
        { id: '6', name: 'Eve (Detective)', role: Role.DETECTIVE, isAlive: true, address: '0x6666666666666666666666666666666666666666' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    ];
};

const TEST_ADDRESS: `0x${string}` = '0x1111111111111111111111111111111111111111';

// Wrapper that sets up GameLayout for Night phase with a specific role
const NightPhaseTestWrapper: React.FC<{ testRole: Role }> = ({ testRole }) => {
    const { setGameState, gameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Set up test game state with Night phase and proper role
        setGameState({
            phase: GamePhase.NIGHT,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(testRole, TEST_ADDRESS),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Night falls...', type: 'phase' },
                { id: '2', timestamp: '12:00:01', message: `You are a ${testRole}`, type: 'info' }
            ],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: []
        });
        // Small delay to ensure state is propagated
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState, testRole]);

    // Wait for state to be set up before rendering GameLayout
    if (!isReady) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
                    <p>Setting up {testRole} test...</p>
                </div>
            </div>
        );
    }

    // Verify state was set correctly
    const myPlayer = gameState.players.find(p => p.address.toLowerCase() === TEST_ADDRESS.toLowerCase());
    console.log('[Test Debug]', {
        phase: gameState.phase,
        myPlayerId: gameState.myPlayerId,
        myPlayerRole: myPlayer?.role,
        expectedRole: testRole,
        playersCount: gameState.players.length
    });

    return <GameLayout />;
};

// Wrapper for Day phase testing
const DayPhaseTestWrapper: React.FC = () => {
    const { setGameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setGameState({
            phase: GamePhase.DAY,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Day 1 begins!', type: 'phase' }
            ],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: []
        });
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState]);

    if (!isReady) {
        return <div className="w-full h-full flex items-center justify-center text-white">Loading Day Phase...</div>;
    }

    return <GameLayout />;
};

// Wrapper for Voting phase testing
const VotingPhaseTestWrapper: React.FC = () => {
    const { setGameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setGameState({
            phase: GamePhase.VOTING,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Voting has started!', type: 'phase' }
            ],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: []
        });
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState]);

    if (!isReady) {
        return <div className="w-full h-full flex items-center justify-center text-white">Loading Voting Phase...</div>;
    }

    return <GameLayout />;
};

// Mock Props
const mockPlayer = {
    id: '1',
    name: 'Test Player',
    role: 'Mafia',
    isAlive: true,
    avatarUrl: 'https://placehold.co/80x80',
    address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    votesReceived: 0,
    status: 'connected'
};

const mockPlayers = [
    { id: '1', name: 'Player 1', role: 'Villager', isAlive: true, address: '0x1111111111111111111111111111111111111111' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected' },
    { id: '2', name: 'Player 2', role: 'Mafia', isAlive: true, address: '0x2222222222222222222222222222222222222222' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected' },
    { id: '3', name: 'Player 3', role: 'Doctor', isAlive: false, address: '0x3333333333333333333333333333333333333333' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'offline' },
];

const mockLogs = [
    { id: '1', message: 'Game started', type: 'system', timestamp: Date.now() },
    { id: '2', message: 'Player 1 was killed', type: 'error', timestamp: Date.now() }
];

// Mock Mafia Chat messages for testing
const mockMafiaChatMessages: MafiaChatMessage[] = [
    { id: '1', sender: '0x1111', playerName: 'Godfather', content: { type: 'suggest', targetName: 'Alice' }, timestamp: Date.now() - 5000 },
    { id: '2', sender: '0x2222', playerName: 'Hitman', content: { type: 'agree', targetName: 'Alice' }, timestamp: Date.now() - 3000 },
    { id: '3', sender: '0x3333', playerName: 'Consigliere', content: { type: 'disagree', targetName: 'Alice' }, timestamp: Date.now() - 1000 },
];

// Test wrapper for MafiaChat component
const MafiaChatTestWrapper: React.FC = () => {
    const [messages, setMessages] = useState<MafiaChatMessage[]>(mockMafiaChatMessages);
    const [selectedTarget, setSelectedTarget] = useState<`0x${string}` | null>(null);

    const mockPlayers: Player[] = [
        { id: '1', name: 'Alice', role: Role.CIVILIAN, isAlive: true, address: '0xAAAA' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
        { id: '2', name: 'Bob', role: Role.DOCTOR, isAlive: true, address: '0xBBBB' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
        { id: '3', name: 'Charlie', role: Role.DETECTIVE, isAlive: true, address: '0xCCCC' as `0x${string}`, avatarUrl: '', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    ];

    const handleSendMessage = async (content: MafiaChatMessage['content']) => {
        const newMsg: MafiaChatMessage = {
            id: Date.now().toString(),
            sender: '0x1111',
            playerName: 'You (Godfather)',
            content,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMsg]);
    };

    return (
        <div className="w-[400px]">
            <MafiaChat
                myName="You (Godfather)"
                teammates={['0x2222' as `0x${string}`, '0x3333' as `0x${string}`]}
                players={mockPlayers}
                selectedTarget={selectedTarget}
                onSuggestTarget={(addr) => setSelectedTarget(addr)}
                messages={messages}
                onSendMessage={handleSendMessage}
            />
            <div className="mt-4 flex gap-2 flex-wrap">
                {mockPlayers.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setSelectedTarget(p.address)}
                        className={`px-3 py-1 rounded text-sm ${selectedTarget === p.address ? 'bg-red-600 text-white' : 'bg-white/10 text-white/70'}`}
                    >
                        {p.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

// Test wrapper for Mafia Consensus panel
const MafiaConsensusTestWrapper: React.FC = () => {
    const [committed, setCommitted] = useState(2);
    const [revealed, setRevealed] = useState(1);
    const [consensusTarget, setConsensusTarget] = useState<string | null>('Alice');

    return (
        <div className="w-[400px] space-y-4">
            {/* Mafia Consensus Panel (matches NightPhase.tsx styling) */}
            <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-400">👥</span>
                    <span className="text-red-300 text-sm font-medium">Mafia Consensus</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-red-200/60">Committed: {committed}</span>
                    <span className="text-red-200/60">Revealed: {revealed}</span>
                </div>
                {consensusTarget && (
                    <div className="mt-2 p-2 bg-red-900/30 rounded-lg">
                        <span className="text-xs text-red-300">Consensus Target: </span>
                        <span className="text-red-200 font-medium">{consensusTarget}</span>
                    </div>
                )}
                {revealed === committed && revealed > 0 && !consensusTarget && (
                    <div className="mt-2 p-2 bg-yellow-900/30 rounded-lg">
                        <span className="text-xs text-yellow-300">⚠️ No consensus - targets don't match!</span>
                    </div>
                )}
            </div>

            {/* Controls for testing */}
            <div className="p-3 bg-white/5 rounded-lg space-y-2">
                <p className="text-white/50 text-xs mb-2">Test Controls:</p>
                <div className="flex gap-2">
                    <button onClick={() => setCommitted(c => Math.max(0, c - 1))} className="px-2 py-1 bg-white/10 text-white rounded text-xs">- Committed</button>
                    <button onClick={() => setCommitted(c => c + 1)} className="px-2 py-1 bg-white/10 text-white rounded text-xs">+ Committed</button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setRevealed(r => Math.max(0, r - 1))} className="px-2 py-1 bg-white/10 text-white rounded text-xs">- Revealed</button>
                    <button onClick={() => setRevealed(r => r + 1)} className="px-2 py-1 bg-white/10 text-white rounded text-xs">+ Revealed</button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setConsensusTarget('Alice')} className="px-2 py-1 bg-green-900/50 text-green-300 rounded text-xs">Set Target: Alice</button>
                    <button onClick={() => setConsensusTarget(null)} className="px-2 py-1 bg-yellow-900/50 text-yellow-300 rounded text-xs">No Consensus</button>
                </div>
            </div>
        </div>
    );
};

type ComponentEntry = {
    name: string;
    group: string;
    component: React.ReactNode;
};

export // Wrapper for testing phase timeout transition
    const TimeoutTestWrapper: React.FC = () => {
        const { setGameState } = useGameContext();
        const [isReady, setIsReady] = useState(false);

        useEffect(() => {
            // Now + 10 seconds
            const deadline = Math.floor(Date.now() / 1000) + 10;

            setGameState({
                phase: GamePhase.NIGHT,
                dayCount: 1,
                myPlayerId: TEST_ADDRESS,
                players: generateMockPlayers(Role.MAFIA, TEST_ADDRESS),
                logs: [
                    { id: '1', timestamp: '12:00:00', message: 'Night falls (Timeout Test Mode)', type: 'phase' },
                    { id: '2', timestamp: '12:00:01', message: `Wait 10 seconds for auto-transition`, type: 'info' }
                ],
                revealedCount: 0,
                mafiaCommittedCount: 0,
                mafiaRevealedCount: 0,
                phaseDeadline: deadline,
                winner: null,
                mafiaMessages: []
            });
            setTimeout(() => setIsReady(true), 50);
        }, [setGameState]);

        if (!isReady) {
            return <div className="w-full h-full flex items-center justify-center text-white">Loading Timeout Test...</div>;
        }

        return <GameLayout />;
    };

// Wrapper for testing investigation results directly
const InvestigationResultTestWrapper: React.FC<{ isMafia: boolean }> = ({ isMafia }) => {
    const { setGameState, setIsTestMode } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        console.log('[InvestigationTest] Initializing test mode...');
        setIsTestMode(true);
        setGameState({
            phase: GamePhase.NIGHT,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.DETECTIVE, TEST_ADDRESS),
            logs: [],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: []
        });
        setTimeout(() => setIsReady(true), 100);
    }, [setGameState, isMafia, setIsTestMode]);

    if (!isReady) return null;

    const targetAddr = isMafia
        ? '0x4444444444444444444444444444444444444444'
        : '0x2222222222222222222222222222222222222222';

    const initialNightState = {
        hasCommitted: true,
        hasRevealed: true,
        salt: 'test-salt',
        investigationResult: isMafia ? Role.MAFIA : Role.CIVILIAN,
        committedTarget: targetAddr
    };

    return <GameLayout initialNightState={initialNightState} />;
};

// Wrapper for testing Game Over phase
const GameOverTestWrapper: React.FC<{ winner: 'MAFIA' | 'TOWN' }> = ({ winner }) => {
    const { setGameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setGameState({
            phase: GamePhase.ENDED,
            dayCount: 3,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(winner === 'MAFIA' ? Role.MAFIA : Role.CIVILIAN, TEST_ADDRESS).map(p => {
                // Adjust alive status for visual impact
                if (winner === 'MAFIA') {
                    if (p.role === Role.CIVILIAN || p.role === Role.DOCTOR || p.role === Role.DETECTIVE) {
                        return { ...p, isAlive: false };
                    }
                } else {
                    if (p.role === Role.MAFIA) {
                        return { ...p, isAlive: false };
                    }
                }
                return p;
            }),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'The game has ended.', type: 'phase' },
                { id: '2', timestamp: '12:00:01', message: `${winner === 'MAFIA' ? 'Mafia' : 'Town'} has won!`, type: winner === 'MAFIA' ? 'danger' : 'success' }
            ],
            revealedCount: 6,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: 0,
            winner: winner,
            mafiaMessages: []
        });
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState, winner]);

    if (!isReady) return null;

    return <GameLayout />;
};

// === TEST WRAPPERS FOR EARLY GAME PHASES ===

// Animated Shuffle Phase - simulates players shuffling one by one
const ShufflePhaseAnimatedTest: React.FC = () => {
    const { setGameState, gameState } = useGameContext();
    const [currentShuffler, setCurrentShuffler] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);

    const players = generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS);

    useEffect(() => {
        setGameState({
            phase: GamePhase.SHUFFLING,
            dayCount: 0,
            myPlayerId: TEST_ADDRESS,
            players: players.map((p, idx) => ({
                ...p,
                hasDeckCommitted: idx < currentShuffler,
            })),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Shuffling deck...', type: 'phase' }
            ],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 120,
            winner: null,
            mafiaMessages: []
        });
    }, [setGameState, currentShuffler]);

    // Auto-play simulation
    useEffect(() => {
        if (!isAutoPlaying) return;
        if (currentShuffler >= players.length) {
            setIsAutoPlaying(false);
            return;
        }
        const timer = setTimeout(() => {
            setCurrentShuffler(prev => prev + 1);
        }, 1500);
        return () => clearTimeout(timer);
    }, [isAutoPlaying, currentShuffler, players.length]);

    return (
        <div className="w-full flex flex-col items-center gap-4">
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => { setCurrentShuffler(0); setIsAutoPlaying(true); }}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
                >
                    ▶ Play Animation
                </button>
                <button
                    onClick={() => setCurrentShuffler(prev => Math.min(prev + 1, players.length))}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                    Next Player →
                </button>
                <button
                    onClick={() => setCurrentShuffler(0)}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                    Reset
                </button>
            </div>
            <p className="text-white/50 text-sm">Player {currentShuffler} of {players.length} completed</p>
            <div className="w-full max-w-xl">
                <ShufflePhase />
            </div>
        </div>
    );
};

// Animated Role Reveal - simulates the key collection and role reveal flow  
const RoleRevealAnimatedTest: React.FC = () => {
    const { setGameState } = useGameContext();
    const [keysCollected, setKeysCollected] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role>(Role.MAFIA);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);

    const players = generateMockPlayers(selectedRole, TEST_ADDRESS);
    const totalKeys = players.length;

    useEffect(() => {
        setGameState({
            phase: GamePhase.REVEAL,
            dayCount: 0,
            myPlayerId: TEST_ADDRESS,
            players: players.map((p, idx) => ({
                ...p,
                hasConfirmedRole: isRevealed && idx < keysCollected,
            })),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Revealing roles...', type: 'phase' }
            ],
            revealedCount: keysCollected,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 120,
            winner: null,
            mafiaMessages: []
        });
    }, [setGameState, keysCollected, isRevealed, selectedRole]);

    // Auto-play simulation
    useEffect(() => {
        if (!isAutoPlaying) return;
        if (keysCollected < totalKeys) {
            const timer = setTimeout(() => {
                setKeysCollected(prev => prev + 1);
            }, 800);
            return () => clearTimeout(timer);
        } else if (!isRevealed) {
            const timer = setTimeout(() => {
                setIsRevealed(true);
                setIsAutoPlaying(false);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isAutoPlaying, keysCollected, totalKeys, isRevealed]);

    const startAnimation = () => {
        setKeysCollected(0);
        setIsRevealed(false);
        setIsAutoPlaying(true);
    };

    return (
        <div className="w-full flex flex-col items-center gap-4">
            <div className="flex gap-2 mb-2 flex-wrap justify-center">
                <button
                    onClick={startAnimation}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
                >
                    ▶ Play Animation
                </button>
                <button
                    onClick={() => setKeysCollected(prev => Math.min(prev + 1, totalKeys))}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                    Add Key
                </button>
                <button
                    onClick={() => setIsRevealed(true)}
                    disabled={keysCollected < totalKeys}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50"
                >
                    Reveal Role
                </button>
                <button
                    onClick={() => { setKeysCollected(0); setIsRevealed(false); }}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                    Reset
                </button>
            </div>
            <div className="flex gap-2">
                {[Role.MAFIA, Role.DETECTIVE, Role.DOCTOR, Role.CIVILIAN].map(role => (
                    <button
                        key={role}
                        onClick={() => { setSelectedRole(role); setKeysCollected(0); setIsRevealed(false); }}
                        className={`px-3 py-1 rounded text-sm ${selectedRole === role ? 'bg-amber-600 text-white' : 'bg-white/10 text-white/70'}`}
                    >
                        {role}
                    </button>
                ))}
            </div>
            <p className="text-white/50 text-sm">Keys: {keysCollected}/{totalKeys} | Revealed: {isRevealed ? 'Yes' : 'No'}</p>
            <div className="w-full max-w-2xl">
                <RoleReveal />
            </div>
        </div>
    );
};

// Role Card Showcase - shows the role card moment (when player sees their role)
const RoleCardShowcaseTest: React.FC = () => {
    const [selectedRole, setSelectedRole] = useState<Role>(Role.MAFIA);
    const [countdown, setCountdown] = useState(10);
    const [isCountingDown, setIsCountingDown] = useState(false);

    // Role configurations using Lucide icons (matching RoleReveal.tsx)
    const roleConfigs: Record<Role, { icon: React.ReactNode; color: string; bgColor: string; description: string }> = {
        [Role.MAFIA]: {
            icon: <Skull className="w-16 h-16" />,
            color: 'text-rose-500',
            bgColor: 'from-rose-950/50 to-rose-900/30',
            description: 'Eliminate all civilians to win. Vote by day, kill by night.'
        },
        [Role.DOCTOR]: {
            icon: <Shield className="w-16 h-16" />,
            color: 'text-teal-500',
            bgColor: 'from-teal-950/50 to-teal-900/30',
            description: 'Save one player each night from the mafia attack.'
        },
        [Role.DETECTIVE]: {
            icon: <Search className="w-16 h-16" />,
            color: 'text-sky-500',
            bgColor: 'from-sky-950/50 to-sky-900/30',
            description: 'Investigate one player each night to reveal their alignment.'
        },
        [Role.CIVILIAN]: {
            icon: <Users className="w-16 h-16" />,
            color: 'text-amber-500',
            bgColor: 'from-amber-950/50 to-amber-900/30',
            description: 'Find and vote out the mafia during the day to survive.'
        },
        [Role.UNKNOWN]: {
            icon: <EyeOff className="w-16 h-16" />,
            color: 'text-gray-500',
            bgColor: 'from-gray-950/50 to-gray-900/30',
            description: 'Role unknown'
        }
    };

    const config = roleConfigs[selectedRole];

    // Countdown timer
    useEffect(() => {
        if (!isCountingDown || countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [isCountingDown, countdown]);

    const startCountdown = () => {
        setCountdown(10);
        setIsCountingDown(true);
    };

    return (
        <div className="w-full flex flex-col items-center gap-6">
            {/* Controls */}
            <div className="flex gap-2 flex-wrap justify-center">
                {[Role.MAFIA, Role.DETECTIVE, Role.DOCTOR, Role.CIVILIAN].map(role => (
                    <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedRole === role
                            ? `${roleConfigs[role].color} bg-white/20 border border-current`
                            : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                    >
                        {role}
                    </button>
                ))}
            </div>

            <button
                onClick={startCountdown}
                className="px-4 py-2 bg-[#916A47] text-white rounded-lg hover:bg-[#a67b52]"
            >
                Start 10s Timer
            </button>

            {/* Timer */}
            {isCountingDown && countdown > 0 && (
                <div className="text-4xl font-bold text-[#916A47]">{countdown}s</div>
            )}

            {/* Role Card */}
            <div className={`bg-gradient-to-br ${config.bgColor} backdrop-blur-xl rounded-3xl border border-white/20 p-10 shadow-2xl w-[360px] min-h-[320px] flex flex-col justify-between`}>
                <div className="text-center flex-1 flex flex-col justify-center">
                    {/* Role Name */}
                    <h2 className={`text-5xl font-['Playfair_Display'] mb-6 ${config.color}`}>
                        {selectedRole}
                    </h2>

                    {/* Description */}
                    <p className="text-white/60 text-sm max-w-xs mx-auto">
                        {config.description}
                    </p>
                </div>

                <div className="space-y-3 mt-6">
                    {/* Confirm Button Mock */}
                    <button className="w-full px-6 py-3 bg-gradient-to-r from-[#916A47] to-[#7a5a3c] text-white rounded-xl font-medium hover:from-[#a67b52] hover:to-[#916A47] transition-all">
                        I Understand My Role
                    </button>

                    <div className="text-xs text-white/30 text-center">
                        3 / 6 confirmed
                    </div>
                </div>
            </div>
        </div>
    );
};

// Wrapper for testing ShufflePhase visual (static)
const ShufflePhaseTestWrapper: React.FC = () => {
    const { setGameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setGameState({
            phase: GamePhase.SHUFFLING,
            dayCount: 0,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS).map((p, idx) => ({
                ...p,
                hasDeckCommitted: idx < 2,
            })),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Shuffling deck...', type: 'phase' }
            ],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 120,
            winner: null,
            mafiaMessages: []
        });
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState]);

    if (!isReady) return <div className="text-white">Loading Shuffle Phase...</div>;

    return (
        <div className="w-full max-w-xl">
            <ShufflePhase />
        </div>
    );
};

// Wrapper for testing RoleReveal visual (static)
const RoleRevealTestWrapper: React.FC = () => {
    const { setGameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setGameState({
            phase: GamePhase.REVEAL,
            dayCount: 0,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.MAFIA, TEST_ADDRESS).map((p, idx) => ({
                ...p,
                hasConfirmedRole: idx < 3,
            })),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Revealing roles...', type: 'phase' }
            ],
            revealedCount: 3,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 120,
            winner: null,
            mafiaMessages: []
        });
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState]);

    if (!isReady) return <div className="text-white">Loading Role Reveal...</div>;

    return (
        <div className="w-full max-w-2xl">
            <RoleReveal />
        </div>
    );
};

// Wrapper for testing PlayerSpot component
const PlayerSpotTestWrapper: React.FC = () => {
    const { setGameState, gameState } = useGameContext();
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

    useEffect(() => {
        setGameState({
            phase: GamePhase.NIGHT,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.DETECTIVE, TEST_ADDRESS),
            logs: [],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: []
        });
    }, [setGameState]);

    const myPlayer = gameState.players.find(p => p.address.toLowerCase() === TEST_ADDRESS.toLowerCase());

    return (
        <div className="w-full">
            <p className="text-white/50 text-sm mb-4">Click on player spots to select them. Try marking players as Mafia/Civilian/Question.</p>
            <div className="grid grid-cols-3 gap-4">
                {gameState.players.slice(0, 6).map((player) => (
                    <PlayerSpot
                        key={player.id}
                        player={player}
                        isMe={player.address.toLowerCase() === TEST_ADDRESS.toLowerCase()}
                        isNight={true}
                        myRole={Role.DETECTIVE}
                        isSelected={selectedTarget === player.address}
                        onAction={() => setSelectedTarget(player.address)}
                        canAct={player.address.toLowerCase() !== TEST_ADDRESS.toLowerCase()}
                        mark={null}
                        onSetMark={() => { }}
                    />
                ))}
            </div>
        </div>
    );
};

const TestPage: React.FC = () => {
    const { setIsTestMode, setGameState, setIsTxPending } = useGameContext();
    const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

    useEffect(() => {
        setIsTestMode(true);
        setIsTxPending(false); // Reset any pending TX state
        return () => setIsTestMode(false);
    }, [setIsTestMode, setIsTxPending]);

    const components: ComponentEntry[] = [
        // UI
        { name: 'Button', group: 'UI', component: <Button onClick={() => alert('Clicked')}>Test Button</Button> },
        { name: 'Input', group: 'UI', component: <Input placeholder="Test Input" onChange={(e) => console.log(e.target.value)} /> },
        { name: 'BackButton', group: 'UI', component: <BackButton /> },

        // Game Components
        { name: 'PlayerCard', group: 'Game Components', component: <div className="w-60"><PlayerCard player={mockPlayer as any} isMe={false} onAction={() => { }} canAct={true} actionLabel="VOTE" /></div> },

        { name: 'SystemLog', group: 'Game Components', component: <div className="h-60"><SystemLog logs={mockLogs as any} /></div> },
        { name: 'VotingAnnouncement', group: 'Game Components', component: <VotingAnnouncementWrapper /> },
        { name: 'NightAnnouncement', group: 'Game Components', component: <NightAnnouncementWrapper /> },
        { name: 'Mafia Chat', group: 'Game Components', component: <MafiaChatTestWrapper /> },
        { name: 'Mafia Consensus', group: 'Game Components', component: <MafiaConsensusTestWrapper /> },

        // Game Phases (Test different phases and roles)
        { name: 'Night - Mafia', group: 'Game Phases', component: <NightPhaseTestWrapper testRole={Role.MAFIA} /> },
        { name: 'Night - Doctor', group: 'Game Phases', component: <NightPhaseTestWrapper testRole={Role.DOCTOR} /> },
        { name: 'Night - Detective', group: 'Game Phases', component: <NightPhaseTestWrapper testRole={Role.DETECTIVE} /> },
        { name: 'Detective Result (EVIL)', group: 'Game Phases', component: <InvestigationResultTestWrapper isMafia={true} /> },
        { name: 'Detective Result (INNOCENT)', group: 'Game Phases', component: <InvestigationResultTestWrapper isMafia={false} /> },
        { name: 'Night - Timeout', group: 'Game Phases', component: <TimeoutTestWrapper /> },
        { name: 'Night - Civilian', group: 'Game Phases', component: <NightPhaseTestWrapper testRole={Role.CIVILIAN} /> },
        { name: 'Day Phase', group: 'Game Phases', component: <DayPhaseTestWrapper /> },
        { name: 'Voting Phase', group: 'Game Phases', component: <VotingPhaseTestWrapper /> },

        // Pages
        { name: 'MainPage', group: 'Pages', component: <MainPage onStart={() => console.log('Start')} /> },
        { name: 'SetupProfile', group: 'Pages', component: <SetupProfile /> },
        { name: 'CreateLobby', group: 'Pages', component: <CreateLobby /> },
        { name: 'JoinLobby', group: 'Pages', component: <JoinLobby /> },
        { name: 'WaitingRoom', group: 'Pages', component: <WaitingRoom /> },
        { name: 'Victory - Mafia', group: 'Pages', component: <GameOverTestWrapper winner="MAFIA" /> },
        { name: 'Victory - Town', group: 'Pages', component: <GameOverTestWrapper winner="TOWN" /> },
        { name: 'GameLayout (Raw)', group: 'Pages', component: <GameLayout /> },

        // Early Game Phases (Animated)
        { name: 'Shuffle Phase (Animated)', group: 'Early Game', component: <ShufflePhaseAnimatedTest /> },
        { name: 'Role Reveal (Animated)', group: 'Early Game', component: <RoleRevealAnimatedTest /> },
        { name: 'Role Card Showcase', group: 'Early Game', component: <RoleCardShowcaseTest /> },
        { name: 'Shuffle Phase (Static)', group: 'Early Game', component: <ShufflePhaseTestWrapper /> },
        { name: 'Role Reveal (Static)', group: 'Early Game', component: <RoleRevealTestWrapper /> },
        { name: 'Player Spot', group: 'Early Game', component: <PlayerSpotTestWrapper /> },
    ];

    const groupedComponents = components.reduce((acc, curr) => {
        if (!acc[curr.group]) acc[curr.group] = [];
        acc[curr.group].push(curr);
        return acc;
    }, {} as Record<string, ComponentEntry[]>);

    const renderSelected = () => {
        const entry = components.find(c => c.name === selectedComponent);
        if (!entry) return <div className="text-gray-400">Select a component to view</div>;

        return (
            <div className="w-full h-full p-8 overflow-auto bg-gray-900/50">
                <h2 className="text-xl font-bold mb-4 text-green-400">{entry.name}</h2>
                {/* Key forces full remount when switching components */}
                <div
                    key={entry.name}
                    className="border border-gray-700 p-4 rounded-lg bg-black/50 min-h-[500px] flex items-center justify-center relative"
                >
                    {entry.component}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen w-full bg-black text-white">
            {/* Sidebar */}
            <div className="w-64 border-r border-green-500/20 flex flex-col h-full bg-gray-900/20">
                <div className="p-4 border-b border-green-500/20">
                    <h1 className="text-xl font-bold text-green-500 tracking-wider">COMPONENT TEST</h1>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {Object.entries(groupedComponents).map(([group, items]) => (
                        <div key={group} className="mb-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase px-2 mb-2">{group}</h3>
                            <div className="space-y-1">
                                {items.map((item) => (
                                    <button
                                        key={item.name}
                                        onClick={() => setSelectedComponent(item.name)}
                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selectedComponent === item.name
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                            }`}
                                    >
                                        {item.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {renderSelected()}
            </div>
        </div>
    );
};

export default TestPage;
