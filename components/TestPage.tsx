import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { GameLayout, getPlayerPositions } from './game/GameLayout';
import { ShufflePhase } from './game/ShufflePhase';
import { RoleReveal } from './game/RoleReveal';
import { PlayerSpot } from './game/PlayerSpot';
import { GamePhase, Role, Player, MafiaChatMessage } from '../types';
import { GameLog } from './game/GameLog';
import { VotingAnnouncement } from './game/VotingAnnouncement';
import { PostVotingTransition } from './game/PostVotingTransition';
import { NightAnnouncement } from './game/NightAnnouncement';
import { RoleCompositionAnnouncement } from './game/RoleCompositionAnnouncement';
import { MafiaChat } from './game/MafiaChat';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../contexts/GameContext';
import { Skull, Shield, Search, Users, EyeOff, Mic, MicOff, Loader2, MessageCircle, Send, X, Key, Clock, Fuel, Wallet, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { MicButton } from './game/MicButton';
import { useSoundEffects } from './ui/SoundEffects';
import { GameHintsOverlay } from './game/GameHints';
import { SessionKeyBanner } from './game/SessionKeyBanner';

type HintType = 'discussion' | 'voting' | 'night_mafia' | 'night_doctor' | 'night_detective' | 'night_civilian';

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

// Wrapper for testing RoleCompositionAnnouncement
const RoleCompositionAnnouncementWrapper = () => {
    const [show, setShow] = useState(false);
    const [playerCount, setPlayerCount] = useState(8);
    const [stayOpen, setStayOpen] = useState(false);
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
                <label className="text-white/60 text-sm">Players: {playerCount}</label>
                <input
                    type="range" min={4} max={16} value={playerCount}
                    onChange={(e) => setPlayerCount(Number(e.target.value))}
                    className="w-40 accent-[#916A47]"
                />
            </div>
            <div className="text-white/40 text-xs">
                Mafia: {Math.max(1, Math.floor(playerCount / 4))},
                Doctor: {playerCount >= 4 ? 1 : 0},
                Detective: {playerCount >= 5 ? 1 : 0},
                Civilian: {playerCount - Math.max(1, Math.floor(playerCount / 4)) - (playerCount >= 4 ? 1 : 0) - (playerCount >= 5 ? 1 : 0)}
            </div>
            <div className="flex items-center gap-4">
                <Button onClick={() => setShow(true)}>Trigger Role Composition</Button>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={stayOpen}
                        onChange={(e) => setStayOpen(e.target.checked)}
                        className="accent-[#916A47] w-4 h-4"
                    />
                    <span className="text-white/60 text-sm">Stay Open</span>
                </label>
            </div>
            <RoleCompositionAnnouncement
                show={show}
                onComplete={() => { if (!stayOpen) setShow(false); }}
                playerCount={playerCount}
            />
            {/* Manual close button when staying open */}
            {show && stayOpen && (
                <button
                    onClick={() => setShow(false)}
                    className="fixed top-6 right-6 z-[200] px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-xl transition-colors"
                >
                    ✕ Close Preview
                </button>
            )}
        </div>
    );
};

// === TEST WRAPPERS FOR NIGHT PHASE WITH SPECIFIC ROLES ===

// Generate mock players for testing
const generateMockPlayers = (myRole: Role, myAddress: `0x${string}`): Player[] => {
    return [
        { id: '1', name: 'You (Test)', role: myRole, isAlive: true, address: myAddress, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=you', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
        { id: '2', name: 'Alice', role: Role.CIVILIAN, isAlive: true, address: '0x2222222222222222222222222222222222222222' as `0x${string}`, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: true, hasNightRevealed: true },
        { id: '3', name: 'Bob', role: Role.CIVILIAN, isAlive: true, address: '0x3333333333333333333333333333333333333333' as `0x${string}`, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
        { id: '4', name: 'Charlie', role: Role.MAFIA, isAlive: true, address: '0x4444444444444444444444444444444444444444' as `0x${string}`, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: true, hasNightRevealed: true },
        { id: '5', name: 'Diana', role: Role.DOCTOR, isAlive: true, address: '0x5555555555555555555555555555555555555555' as `0x${string}`, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: true, hasNightRevealed: true },
        { id: '6', name: 'Eve', role: Role.DETECTIVE, isAlive: true, address: '0x6666666666666666666666666666666666666666' as `0x${string}`, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=eve', votesReceived: 0, status: 'connected', hasConfirmedRole: true, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    ];
};

// Generate 16 mock players for voting visualization test
const generateMock16Players = (myAddress: `0x${string}`): Player[] => {
    const names = ['You', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Mia', 'Nick', 'Olivia'];
    const roles = [Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.CIVILIAN, Role.MAFIA, Role.MAFIA, Role.MAFIA, Role.DOCTOR, Role.DETECTIVE, Role.CIVILIAN];

    return names.map((name, i) => ({
        id: String(i + 1),
        name: name,
        role: roles[i],
        isAlive: true,
        address: (i === 0 ? myAddress : `0x${(i + 1).toString().padStart(2, '0').repeat(20)}`) as `0x${string}`,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.toLowerCase()}`,
        votesReceived: 0,
        status: 'connected' as const,
        hasConfirmedRole: true,
        hasDeckCommitted: false,
        hasVoted: false,
        hasNightCommitted: false,
        hasNightRevealed: false,
    }));
};

const TEST_ADDRESS: `0x${string}` = '0x1111111111111111111111111111111111111111';

// Wrapper that sets up GameLayout for Night phase with a specific role
const NightPhaseTestWrapper: React.FC<{ testRole: Role }> = ({ testRole }) => {
    const { setGameState, gameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Set up test game state with Night phase and proper role
        setGameState({phase: GamePhase.NIGHT,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(testRole, TEST_ADDRESS),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Night falls...', type: 'phase' },
                { id: '2', timestamp: '12:00:01', message: `You are a ${testRole}`, type: 'info' }
            ],
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
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

// Wrapper for Day phase testing with discussion simulation
const DayPhaseTestWrapper: React.FC = () => {
    const { setGameState, setCurrentRoomId, setIsTestMode } = useGameContext();
    const [isReady, setIsReady] = useState(false);
    const [isMyTurn, setIsMyTurn] = useState(true);
    const [speakerIndex, setSpeakerIndex] = useState(0);

    const players = generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS);

    useEffect(() => {
        setIsTestMode(true);
        setCurrentRoomId(BigInt(12345));
        setGameState({phase: GamePhase.DAY,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: players,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Day 1 begins!', type: 'phase' },
                { id: '2', timestamp: '12:00:05', message: 'Discussion phase started.', type: 'info' }
            ],
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 120,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
        });
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState, setCurrentRoomId, setIsTestMode]);

    if (!isReady) {
        return <div className="w-full h-full flex items-center justify-center text-white">Loading Day Phase...</div>;
    }

    return (
        <div className="w-full h-full relative">
            {/* Control Panel */}
            <div className="fixed top-4 right-4 z-[1000] bg-black/90 p-4 rounded-xl border border-[#916A47]/50 space-y-3">
                <h4 className="text-[#916A47] font-bold text-sm">🎤 Mic Test Controls</h4>
                <button
                    onClick={() => setIsMyTurn(!isMyTurn)}
                    className={`w-full px-4 py-2 rounded-lg font-medium text-sm ${isMyTurn ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                        }`}
                >
                    {isMyTurn ? '✓ My Turn to Speak' : '✗ Not My Turn'}
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={() => setSpeakerIndex(prev => Math.max(0, prev - 1))}
                        className="px-3 py-1 bg-white/10 text-white rounded text-xs"
                    >
                        ← Prev
                    </button>
                    <span className="text-white/70 text-xs flex-1 text-center py-1">
                        Speaker {speakerIndex + 1}/{players.length}
                    </span>
                    <button
                        onClick={() => setSpeakerIndex(prev => Math.min(players.length - 1, prev + 1))}
                        className="px-3 py-1 bg-white/10 text-white rounded text-xs"
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* GameLayout with discussion state override */}
            <GameLayout
                initialDiscussionState={{
                    active: true,
                    finished: false,
                    phase: 'speaking' as const,
                    currentSpeakerIndex: speakerIndex,
                    currentSpeakerAddress: players[speakerIndex]?.address || null,
                    totalSpeakers: players.length,
                    timeRemaining: 45,
                    isMyTurn: isMyTurn
                }}
            />
        </div>
    );
};

// Wrapper for Voting phase testing
const VotingPhaseTestWrapper: React.FC = () => {
    const { setGameState, setVoteMap } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setGameState({phase: GamePhase.VOTING,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Voting has started!', type: 'phase' }
            ],
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
        });
        // Clear any existing votes
        setVoteMap({});
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState, setVoteMap]);

    if (!isReady) {
        return <div className="w-full h-full flex items-center justify-center text-white">Loading Voting Phase...</div>;
    }

    return <GameLayout />;
};

// Interactive Voting Visualization Test - allows adding/removing votes to see avatars on cards
const VotingVisualizationTestWrapper: React.FC = () => {
    const { setGameState, setVoteMap, voteMap, setCurrentRoomId } = useGameContext();
    const [isReady, setIsReady] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showPanel, setShowPanel] = useState(true);

    const players = generateMock16Players(TEST_ADDRESS);

    useEffect(() => {
        // Set a mock room ID for the test
        setCurrentRoomId(BigInt(12345));

        setGameState({phase: GamePhase.VOTING,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: players,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Voting Visualization Test', type: 'phase' }
            ],
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 600,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
        });
        setVoteMap({});
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState, setVoteMap, setCurrentRoomId]);

    const handleVote = (voterAddr: string, targetAddr: string) => {
        // Если уже голосовал за этого - убираем голос
        if (voteMap[voterAddr.toLowerCase()] === targetAddr.toLowerCase()) {
            setVoteMap(prev => {
                const newMap = { ...prev };
                delete newMap[voterAddr.toLowerCase()];
                return newMap;
            });
        } else {
            // Иначе - добавляем/меняем голос
            setVoteMap(prev => ({
                ...prev,
                [voterAddr.toLowerCase()]: targetAddr.toLowerCase()
            }));
        }
    };

    const handleClearAllVotes = () => {
        setVoteMap({});
    };

    // Анимированное добавление всех голосов за одного игрока
    const animateAllVotesFor = async (targetAddr: string) => {
        if (isAnimating) return;
        setIsAnimating(true);
        setVoteMap({});

        const voters = players.filter(p => p.address.toLowerCase() !== targetAddr.toLowerCase());

        for (let i = 0; i < voters.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 400)); // 400ms delay between each vote
            setVoteMap(prev => ({
                ...prev,
                [voters[i].address.toLowerCase()]: targetAddr.toLowerCase()
            }));
        }
        setIsAnimating(false);
    };

    // Быстро все голосуют за одного
    const allVoteFor = (targetAddr: string) => {
        const newVotes: Record<string, string> = {};
        players.forEach(voter => {
            if (voter.address.toLowerCase() !== targetAddr.toLowerCase()) {
                newVotes[voter.address.toLowerCase()] = targetAddr.toLowerCase();
            }
        });
        setVoteMap(newVotes);
    };

    if (!isReady) {
        return <div className="w-full h-full flex items-center justify-center text-white">Loading...</div>;
    }

    const getPlayerShortName = (p: typeof players[0]) => p.name.split(' ')[0];

    return (
        <div className="w-full h-full relative">
            {/* Toggle Button - Always visible */}
            <button
                onClick={() => setShowPanel(!showPanel)}
                className="fixed top-4 right-4 z-[1000] px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-500 shadow-xl"
            >
                {showPanel ? '✕ Hide Panel' : '🗳️ Show Vote Panel'}
            </button>

            {/* Floating Control Panel */}
            {showPanel && (
                <div className="fixed top-16 right-4 z-[999] bg-black/95 p-4 rounded-xl border border-[#916A47]/50 flex flex-col gap-3 max-w-[400px] shadow-2xl max-h-[80vh] overflow-y-auto">
                    <h3 className="text-[#916A47] font-bold text-sm">🗳️ Vote Controls (No TX)</h3>

                    {/* Quick Actions */}
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={handleClearAllVotes}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-500"
                        >
                            🗑️ Clear
                        </button>
                    </div>

                    {/* Animated Vote All buttons */}
                    <div className="flex flex-col gap-1">
                        <span className="text-white/50 text-[10px]">🎬 Animate votes (one by one):</span>
                        <div className="flex flex-wrap gap-1">
                            {players.map(target => (
                                <button
                                    key={`anim-${target.id}`}
                                    onClick={() => animateAllVotesFor(target.address)}
                                    disabled={isAnimating}
                                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${isAnimating
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        : 'bg-purple-600 text-white hover:bg-purple-500'
                                        }`}
                                >
                                    ▶ {getPlayerShortName(target)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Instant Vote All buttons */}
                    <div className="flex flex-col gap-1">
                        <span className="text-white/50 text-[10px]">⚡ Instant all votes:</span>
                        <div className="flex flex-wrap gap-1">
                            {players.map(target => (
                                <button
                                    key={`instant-${target.id}`}
                                    onClick={() => allVoteFor(target.address)}
                                    className="px-2 py-1 bg-amber-600 text-white rounded text-[10px] font-medium hover:bg-amber-500"
                                >
                                    All → {getPlayerShortName(target)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Voting Matrix */}
                    <div className="flex flex-col gap-1">
                        <span className="text-white/50 text-[10px]">📊 Click to toggle vote:</span>
                        <div className="overflow-x-auto">
                            <table className="border-collapse text-[10px]">
                                <thead>
                                    <tr>
                                        <th className="p-1 text-white/40 text-left">→</th>
                                        {players.map(target => (
                                            <th key={target.id} className="p-1 text-center text-[#916A47] font-medium">
                                                {getPlayerShortName(target).slice(0, 3)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map(voter => (
                                        <tr key={voter.id} className="border-t border-white/10">
                                            <td className="p-1 text-white/70 font-medium">{getPlayerShortName(voter).slice(0, 3)}</td>
                                            {players.map(target => {
                                                const isVoted = voteMap[voter.address.toLowerCase()] === target.address.toLowerCase();
                                                const isSelf = voter.address === target.address;
                                                return (
                                                    <td key={`${voter.id}-${target.id}`} className="p-0.5 text-center">
                                                        <button
                                                            onClick={() => !isSelf && handleVote(voter.address, target.address)}
                                                            disabled={isSelf}
                                                            className={`w-5 h-5 rounded-full text-[8px] transition-all ${isSelf
                                                                ? 'bg-gray-800 cursor-not-allowed'
                                                                : isVoted
                                                                    ? 'bg-green-500 text-white'
                                                                    : 'bg-white/10 hover:bg-white/20 text-white/40'
                                                                }`}
                                                        >
                                                            {isSelf ? '—' : isVoted ? '✓' : '○'}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Current votes count per player */}
                    <div className="flex flex-wrap gap-1 text-[10px]">
                        <span className="text-white/40 w-full">Votes:</span>
                        {players.map(target => {
                            const votesCount = Object.values(voteMap).filter(t => t === target.address.toLowerCase()).length;
                            return (
                                <span key={target.id} className={`px-1.5 py-0.5 rounded ${votesCount > 0 ? 'bg-[#916A47]/30 text-[#916A47]' : 'bg-white/5 text-white/30'}`}>
                                    {getPlayerShortName(target).slice(0, 3)}: {votesCount}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Game Layout */}
            <GameLayout />
        </div>
    );
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
                        <span className="text-xs text-yellow-300">⚠️ No consensus - targets don&apos;t match!</span>
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

// ═══════════════════════════════════════════════════════════
// LAYOUT CONSTRUCTOR — drag & drop player card positions
// Uses real getPlayerPositions from GameLayout (HAND_TUNED + ellipse fallback)
// ═══════════════════════════════════════════════════════════
const BOARD_W = 1488;
const BOARD_H = 1024;
const CARD_W = 250;
const CARD_H = 130;

// Hand-tuned counts (must match HAND_TUNED keys in GameLayout.tsx)
const HAND_TUNED_COUNTS = new Set([4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);

// Use the real positioning function from GameLayout
function constructorInitPositions(count: number): { x: number; y: number }[] {
    return getPlayerPositions(count).map(p => ({ x: p.x, y: p.y }));
}

const LayoutPreviewTestWrapper: React.FC = () => {
    const names = ['You', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace',
        'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Mia', 'Nick', 'Olivia', 'Pete', 'Quinn', 'Rose', 'Sam'];

    const [playerCount, setPlayerCount] = useState(16);
    const [positions, setPositions] = useState(() => constructorInitPositions(16));
    const [dragging, setDragging] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [copied, setCopied] = useState(false);
    const boardRef = useRef<HTMLDivElement>(null);

    // Reset positions when count changes
    const changeCount = useCallback((n: number) => {
        setPlayerCount(n);
        setPositions(constructorInitPositions(n));
    }, []);

    // Get board scale factor (board is scaled to fit in the viewport)
    const getBoardScale = useCallback((): number => {
        if (!boardRef.current) return 1;
        return boardRef.current.offsetWidth / BOARD_W;
    }, []);

    // Convert screen coordinates to board coordinates
    const screenToBoard = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
        if (!boardRef.current) return { x: 0, y: 0 };
        const rect = boardRef.current.getBoundingClientRect();
        const scale = getBoardScale();
        return {
            x: (screenX - rect.left) / scale,
            y: (screenY - rect.top) / scale,
        };
    }, [getBoardScale]);

    const handleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
        e.preventDefault();
        const boardPos = screenToBoard(e.clientX, e.clientY);
        setDragging(index);
        setDragOffset({
            x: boardPos.x - positions[index].x,
            y: boardPos.y - positions[index].y,
        });
    }, [positions, screenToBoard]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (dragging === null) return;
        const boardPos = screenToBoard(e.clientX, e.clientY);
        setPositions(prev => {
            const next = [...prev];
            next[dragging] = {
                x: Math.round(Math.max(0, Math.min(BOARD_W - CARD_W, boardPos.x - dragOffset.x))),
                y: Math.round(Math.max(0, Math.min(BOARD_H - CARD_H, boardPos.y - dragOffset.y))),
            };
            return next;
        });
    }, [dragging, dragOffset, screenToBoard]);

    const handleMouseUp = useCallback(() => {
        setDragging(null);
    }, []);

    // Generate code output
    const generateCode = useCallback(() => {
        const lines = positions.map((p, i) =>
            `    { id: 'p${i + 1}', x: ${p.x}, y: ${p.y} },`
        ).join('\n');
        return `// ${playerCount} players\nconst PLAYER_POSITIONS = [\n${lines}\n];`;
    }, [positions, playerCount]);

    const copyCode = useCallback(() => {
        navigator.clipboard.writeText(generateCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [generateCode]);

    return (
        <div className="w-full h-full flex bg-black overflow-hidden">
            {/* Board area */}
            <div
                className="flex-1 flex items-center justify-center p-4"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    ref={boardRef}
                    className="relative border border-[#916A47]/30 rounded-lg overflow-hidden shadow-2xl"
                    style={{
                        width: '100%',
                        maxWidth: '900px',
                        aspectRatio: `${BOARD_W} / ${BOARD_H}`,
                        backgroundImage: 'url(/assets/game_background.png)',
                        backgroundSize: 'cover',
                    }}
                >
                    {/* Center chat area indicator */}
                    <div
                        className="absolute border-2 border-dashed border-white/20 rounded-lg"
                        style={{
                            left: `${((BOARD_W / 2 - 300) / BOARD_W) * 100}%`,
                            top: `${((BOARD_H / 2 - 200) / BOARD_H) * 100}%`,
                            width: `${(600 / BOARD_W) * 100}%`,
                            height: `${(400 / BOARD_H) * 100}%`,
                        }}
                    >
                        <span className="absolute top-1 left-2 text-white/30 text-[10px]">Chat Area</span>
                    </div>

                    {/* Draggable player cards */}
                    {positions.map((pos, i) => (
                        <div
                            key={i}
                            className={`absolute cursor-grab select-none transition-shadow ${dragging === i ? 'cursor-grabbing shadow-2xl z-50 ring-2 ring-yellow-400' : 'z-10 hover:ring-1 hover:ring-white/50'
                                }`}
                            style={{
                                left: `${(pos.x / BOARD_W) * 100}%`,
                                top: `${(pos.y / BOARD_H) * 100}%`,
                                width: `${(CARD_W / BOARD_W) * 100}%`,
                                height: `${(CARD_H / BOARD_H) * 100}%`,
                            }}
                            onMouseDown={(e) => handleMouseDown(e, i)}
                        >
                            <div className="w-full h-full bg-[#2a1f14]/90 border border-[#916A47]/60 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm">
                                <span className="text-white font-bold text-[10px] leading-tight">{names[i] || `P${i + 1}`}</span>
                                <span className="text-[#916A47] text-[8px] font-mono">#{i + 1}</span>
                                <span className="text-white/40 text-[7px] font-mono">{pos.x},{pos.y}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Control panel */}
            <div className="w-[320px] bg-gray-900/95 border-l border-[#916A47]/30 flex flex-col p-4 gap-4 overflow-y-auto">
                <h3 className="text-[#916A47] font-bold text-lg">🔧 Layout Constructor</h3>

                {/* Player count slider */}
                <div className="flex flex-col gap-2">
                    <label className="text-white/60 text-xs">Players: {playerCount}</label>
                    <input
                        type="range" min={2} max={20} value={playerCount}
                        onChange={(e) => changeCount(Number(e.target.value))}
                        className="w-full accent-[#916A47]"
                    />
                    <div className="flex flex-wrap gap-1">
                        {Array.from({ length: 19 }, (_, i) => i + 2).map(n => (
                            <button
                                key={n} onClick={() => changeCount(n)}
                                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${playerCount === n
                                    ? 'bg-[#916A47] text-black'
                                    : HAND_TUNED_COUNTS.has(n)
                                        ? 'bg-[#916A47]/30 text-[#916A47] hover:bg-[#916A47]/50 ring-1 ring-[#916A47]/40'
                                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                                    }`}
                            >{n}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${HAND_TUNED_COUNTS.has(playerCount)
                            ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30'
                            }`}>
                            {HAND_TUNED_COUNTS.has(playerCount) ? '✋ Hand-tuned' : '⚙️ Ellipse fallback'}
                        </span>
                    </div>
                </div>

                {/* Position list */}
                <div className="flex flex-col gap-1">
                    <span className="text-white/60 text-xs">Positions:</span>
                    <div className="max-h-[200px] overflow-y-auto bg-black/50 rounded p-2 text-[10px] font-mono">
                        {positions.map((p, i) => (
                            <div key={i} className="text-white/70 flex gap-2">
                                <span className="text-[#916A47] w-6">p{i + 1}</span>
                                <span>x:{p.x} y:{p.y}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Code output */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-white/60 text-xs">Code output:</span>
                        <button
                            onClick={copyCode}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${copied
                                ? 'bg-green-500 text-black'
                                : 'bg-[#916A47] text-black hover:bg-[#a07a57]'
                                }`}
                        >
                            {copied ? '✓ Copied!' : '📋 Copy Code'}
                        </button>
                    </div>
                    <pre className="bg-black/70 rounded p-2 text-[9px] font-mono text-green-400/80 overflow-auto max-h-[250px] whitespace-pre leading-relaxed">
                        {generateCode()}
                    </pre>
                </div>

                <div className="text-white/30 text-[10px] mt-auto">
                    Board: {BOARD_W}×{BOARD_H} • Card: {CARD_W}×{CARD_H}<br />
                    Drag cards to position them, then copy the code.
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

            setGameState({phase: GamePhase.NIGHT,
                dayCount: 1,
                myPlayerId: TEST_ADDRESS,
                players: generateMockPlayers(Role.MAFIA, TEST_ADDRESS),
                logs: [
                    { id: '1', timestamp: '12:00:00', message: 'Night falls (Timeout Test Mode)', type: 'phase' },
                    { id: '2', timestamp: '12:00:01', message: `Wait 10 seconds for auto-transition`, type: 'info' }
                ],
                revealedCount: 0,
                mafiaRevealedCount: 0,
                phaseDeadline: deadline,
                winner: null,
                mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
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
        setGameState({phase: GamePhase.NIGHT,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.DETECTIVE, TEST_ADDRESS),
            logs: [],
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
        });
        setTimeout(() => setIsReady(true), 100);
    }, [setGameState, isMafia, setIsTestMode]);

    if (!isReady) return null;

    const targetAddr = isMafia
        ? '0x4444444444444444444444444444444444444444' as `0x${string}`
        : '0x2222222222222222222222222222222222222222' as `0x${string}`;

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
        setGameState({phase: GamePhase.ENDED,
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
            maxPlayers: 16,
            mafiaCommittedCount: 0,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'The game has ended.', type: 'phase' },
                { id: '2', timestamp: '12:00:01', message: `${winner === 'MAFIA' ? 'Mafia' : 'Town'} has won!`, type: winner === 'MAFIA' ? 'danger' : 'success' }
            ],
            revealedCount: 6,
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

// Wrapper for testing PostVotingTransition (Voting Results screen)
const PostVotingTransitionTestWrapper: React.FC = () => {
    const { setGameState, addLog } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Set up mock game state with some logs to display
        setGameState({phase: GamePhase.VOTING,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS),
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Day 1 voting started', type: 'phase' },
                { id: '2', timestamp: '12:05:00', message: 'Alice voted for Charlie', type: 'info' },
                { id: '3', timestamp: '12:05:15', message: 'Bob voted for Charlie', type: 'info' },
                { id: '4', timestamp: '12:05:30', message: 'Charlie voted for Alice', type: 'info' },
                { id: '5', timestamp: '12:05:45', message: 'Diana voted for Charlie', type: 'info' },
                { id: '6', timestamp: '12:06:00', message: 'Eve voted for Charlie', type: 'info' },
                { id: '7', timestamp: '12:06:05', message: 'You voted for Charlie', type: 'info' },
                { id: '8', timestamp: '12:06:10', message: 'Charlie was eliminated! (5 votes)', type: 'danger' },
                { id: '9', timestamp: '12:06:15', message: 'Charlie was a Mafia!', type: 'success' },
            ],
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: 0,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
        });
        setTimeout(() => setIsReady(true), 50);
    }, [setGameState]);

    if (!isReady) {
        return <div className="w-full h-full flex items-center justify-center text-white">Loading...</div>;
    }

    return (
        <div className="w-full h-[600px] relative bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
            <PostVotingTransition />
        </div>
    );
};

// === TEST WRAPPERS FOR EARLY GAME PHASES ===


// Animated Shuffle Phase - simulates players shuffling one by one
const ShufflePhaseAnimatedTest: React.FC = () => {
    const { setGameState, gameState } = useGameContext();
    const [currentShuffler, setCurrentShuffler] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);

    const players = generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS);

    useEffect(() => {
        setGameState({phase: GamePhase.SHUFFLING,
            dayCount: 0,
            myPlayerId: TEST_ADDRESS,
            players: players.map((p, idx) => ({
                ...p,
                hasDeckCommitted: idx < currentShuffler,
            })),
            maxPlayers: 16,
            mafiaCommittedCount: 0,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Shuffling deck...', type: 'phase' }
            ],
            revealedCount: 0,
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
        setGameState({phase: GamePhase.REVEAL,
            dayCount: 0,
            myPlayerId: TEST_ADDRESS,
            players: players.map((p, idx) => ({
                ...p,
                hasConfirmedRole: isRevealed && idx < keysCollected,
            })),
            maxPlayers: 16,
            mafiaCommittedCount: 0,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Revealing roles...', type: 'phase' }
            ],
            revealedCount: keysCollected,
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
// Role Card Showcase - shows the role card moment (when player sees their role)
const RoleCardShowcaseTest: React.FC = () => {
    const [selectedRole, setSelectedRole] = useState<Role>(Role.MAFIA);
    const [countdown, setCountdown] = useState(10);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [revealPhase, setRevealPhase] = useState<'hidden' | 'revealing' | 'revealed' | 'complete'>('revealed');

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

    const handleTestAnimation = () => {
        setRevealPhase('hidden');
        setCountdown(10);
        setIsCountingDown(false);

        // Start sequence
        setTimeout(() => setRevealPhase('revealing'), 1000);
        setTimeout(() => {
            setRevealPhase('revealed');
            setIsCountingDown(true);
        }, 2500);
    };

    // Countdown timer
    useEffect(() => {
        if (!isCountingDown || countdown <= 0) {
            if (isCountingDown && countdown <= 0) {
                setRevealPhase('complete');
                setIsCountingDown(false);
            }
            return;
        }
        const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [isCountingDown, countdown]);

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
                onClick={handleTestAnimation}
                className="px-4 py-2 bg-[#916A47] text-white rounded-lg hover:bg-[#a67b52]"
            >
                Test Full Reveal Flow
            </button>

            {revealPhase === 'complete' ? (
                <div className="text-center py-20 bg-black/40 rounded-3xl w-[400px] h-[400px] flex flex-col items-center justify-center border border-[#916A47]/30">
                    <h2 className="text-3xl text-[#916A47] mb-2 font-bold animate-pulse">Transitioning to Day Phase...</h2>
                    <p className="text-white/40">Game starting now</p>
                </div>
            ) : (
                <div className="relative w-[400px] h-[400px]">
                    <AnimatePresence mode="wait">
                        {revealPhase === 'hidden' || revealPhase === 'revealing' ? (
                            <motion.div
                                key="hidden"
                                initial={{ rotateY: 0, opacity: 1 }}
                                exit={{ rotateY: 90, opacity: 0 }}
                                transition={{ duration: 0.5 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-xl rounded-3xl border border-[#916A47]/30 p-8 shadow-2xl flex flex-col items-center justify-center text-center"
                            >
                                <Search className={`w-16 h-16 text-[#916A47] mb-4 ${revealPhase === 'revealing' ? 'animate-spin' : 'animate-bounce'}`} />
                                <h3 className="text-2xl text-white font-['Cinzel'] mb-2">
                                    {revealPhase === 'revealing' ? 'Decrypting...' : 'Encrypted Data'}
                                </h3>
                                <p className="text-white/40 text-sm">
                                    {revealPhase === 'revealing' ? 'Verifying on-chain...' : 'Waiting for keys...'}
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="revealed"
                                initial={{ rotateY: 90, opacity: 0 }}
                                animate={{ rotateY: 0, opacity: 1 }}
                                transition={{ type: "spring", duration: 0.8 }}
                                className={`absolute inset-0 bg-gradient-to-br ${config.bgColor} backdrop-blur-xl rounded-3xl border border-white/20 p-12 shadow-2xl flex flex-col justify-between`}
                            >
                                <div className="text-center flex-1 flex flex-col justify-center">
                                    {/* Role Name */}
                                    <motion.h2
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className={`text-5xl font-['Cinzel'] mb-6 ${config.color}`}
                                    >
                                        {selectedRole}
                                    </motion.h2>

                                    {/* Description */}
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                        className="text-white/60 text-sm max-w-xs mx-auto"
                                    >
                                        {config.description}
                                    </motion.p>
                                </div>

                                <div className="space-y-3 mt-6">
                                    {/* Confirm Button Mock */}
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1 }}
                                        className="w-full px-6 py-3 bg-gradient-to-r from-[#916A47] to-[#7a5a3c] text-white rounded-xl font-medium hover:from-[#a67b52] hover:to-[#916A47] transition-all"
                                    >
                                        I Understand My Role ({countdown})
                                    </motion.button>

                                    <div className="text-xs text-white/30 text-center">
                                        Display closes in {countdown}s
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

// Wrapper for testing ShufflePhase visual (static)
const ShufflePhaseTestWrapper: React.FC = () => {
    const { setGameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setGameState({phase: GamePhase.SHUFFLING,
            dayCount: 0,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.CIVILIAN, TEST_ADDRESS).map((p, idx) => ({
                ...p,
                hasDeckCommitted: idx < 2,
            })),
            maxPlayers: 16,
            mafiaCommittedCount: 0,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Shuffling deck...', type: 'phase' }
            ],
            revealedCount: 0,
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

// Wrapper for testing isolated GameLog (Game Feed) component
const GameFeedTestWrapper: React.FC = () => {
    const { setGameState, addLog, gameState } = useGameContext();

    useEffect(() => {
        setGameState({phase: GamePhase.DAY,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMock16Players(TEST_ADDRESS),
            logs: [],
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 120,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
        });
    }, [setGameState]);

    const injectLog = (message: string) => {
        addLog(message, 'info');
    };

    return (
        <div className="w-full h-full flex items-start justify-center gap-8 p-4">
            {/* Control Panel */}
            <div className="w-[300px] flex flex-col gap-4 bg-gray-900/80 p-5 rounded-xl border border-white/10 shrink-0">
                <h3 className="text-white font-bold text-lg">Game Feed Controls</h3>

                <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Night Results</span>
                    <button onClick={() => injectLog('Night Result: No one died')} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg text-left">
                        Safe Night (No deaths)
                    </button>
                    <button onClick={() => injectLog('Night Result: Player5 was killed')} className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-sm rounded-lg border border-rose-500/20 text-left">
                        Mafia Kill
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Discussion</span>
                    <button onClick={() => injectLog('Discussion Phase started')} className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm rounded-lg border border-amber-500/20 text-left">
                        Start Discussion
                    </button>
                    <button onClick={() => injectLog('Player2 is now speaking')} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg text-left">
                        Player 2 speaks
                    </button>
                    <button onClick={() => injectLog('All players have spoken')} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg text-left">
                        End Discussion
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Voting</span>
                    <button onClick={() => {
                        injectLog('Voting Phase Started');
                        setGameState(prev => ({ ...prev, phase: GamePhase.VOTING }));
                    }} className="px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 text-sm rounded-lg border border-orange-500/20 text-left">
                        Start Voting
                    </button>
                    <button onClick={() => {
                        injectLog('Player3 voted for Player4');
                        injectLog('Player5 voted for Player4');
                        injectLog('Player6 voted for Player4');
                        injectLog('Player7 voted for Player4');
                        injectLog('Player3 eliminated by vote');
                    }} className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-sm rounded-lg border border-rose-500/20 text-left">
                        Eliminate Player 3
                    </button>
                    <button onClick={() => {
                        injectLog('Voting Finalized: No one was eliminated');
                    }} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg text-left">
                        Skip / Tie
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Phase Ends</span>
                    <button onClick={() => {
                        injectLog('Night has fallen');
                        setGameState(prev => ({ ...prev, phase: GamePhase.NIGHT }));
                    }} className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 text-sm rounded-lg border border-blue-500/20 text-left">
                        Night Falls
                    </button>
                </div>

                <button onClick={() => {
                    setGameState(prev => ({ ...prev, logs: [], dayCount: prev.dayCount + 1, phase: GamePhase.DAY }));
                }} className="px-4 py-2 mt-2 bg-[#916A47] hover:bg-[#a67d55] text-white font-bold rounded-lg w-full">
                    Reset & Next Day
                </button>
            </div>

            {/* Game Feed Container */}
            <div className="flex-1 max-w-[400px]">
                <div className="h-[600px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative" style={{ backgroundImage: 'url(/assets/game_background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative h-full flex flex-col p-4 w-full">
                        <GameLog />
                    </div>
                </div>
            </div>
        </div>
    );
};

// Wrapper for testing RoleReveal visual (static)
const RoleRevealTestWrapper: React.FC = () => {
    const { setGameState } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        setGameState({phase: GamePhase.REVEAL,
            dayCount: 0,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.MAFIA, TEST_ADDRESS).map((p, idx) => ({
                ...p,
                hasConfirmedRole: idx < 3,
            })),
            maxPlayers: 16,
            mafiaCommittedCount: 0,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Revealing roles...', type: 'phase' }
            ],
            revealedCount: 3,
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
        setGameState({phase: GamePhase.NIGHT,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMockPlayers(Role.DETECTIVE, TEST_ADDRESS),
            logs: [],
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 60,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
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

// Wrapper for testing Speech Time Warning Glow effect
const SpeechWarningGlowTestWrapper: React.FC = () => {
    const [timeRemaining, setTimeRemaining] = useState(15);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);

    const mockPlayer: Player = {
        id: '1',
        name: 'Speaking Player',
        role: Role.CIVILIAN,
        isAlive: true,
        address: '0x1234567890123456789012345678901234567890' as `0x${string}`,
        avatarUrl: '',
        votesReceived: 0,
        status: 'connected',
        hasConfirmedRole: true,
        hasDeckCommitted: false,
        hasVoted: false,
        hasNightCommitted: false,
        hasNightRevealed: false
    };

    // Auto countdown
    useEffect(() => {
        if (!isAutoPlaying || timeRemaining <= 0) {
            if (timeRemaining <= 0) setIsAutoPlaying(false);
            return;
        }
        const timer = setTimeout(() => {
            setTimeRemaining(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [isAutoPlaying, timeRemaining]);

    const startCountdown = () => {
        setTimeRemaining(15);
        setIsAutoPlaying(true);
    };

    const glowActive = timeRemaining > 0;
    const timerVisible = timeRemaining <= 10 && timeRemaining > 0;

    return (
        <div className="w-full flex flex-col items-center gap-6">
            {/* Controls */}
            <div className="flex gap-2 flex-wrap justify-center">
                <button
                    onClick={startCountdown}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
                >
                    ▶ Start Countdown (15s)
                </button>
                <button
                    onClick={() => setTimeRemaining(10)}
                    className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500"
                >
                    Jump to 10s
                </button>
                <button
                    onClick={() => setTimeRemaining(5)}
                    className="px-4 py-2 bg-rose-800 text-white rounded-lg hover:bg-rose-700"
                >
                    Jump to 5s
                </button>
                <button
                    onClick={() => { setTimeRemaining(15); setIsAutoPlaying(false); }}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                >
                    Reset
                </button>
            </div>

            {/* Status */}
            <div className="text-center">
                <div className={`text-4xl font-bold tabular-nums mb-2 ${timeRemaining <= 10 ? 'text-rose-400' : 'text-white'}`}>
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </div>
                <div className="text-sm font-medium space-y-1">
                    <div className={glowActive ? 'text-amber-400' : 'text-white/50'}>
                        {glowActive ? '✨ GLOW ACTIVE (entire speech)' : 'Glow shows during speech'}
                    </div>
                    <div className={timerVisible ? 'text-rose-400 animate-pulse' : 'text-white/50'}>
                        {timerVisible ? '⏱️ TIMER VISIBLE (≤10s)' : 'Timer appears at ≤10 seconds'}
                    </div>
                </div>
            </div>

            {/* Player Card with Glow */}
            <div className="p-8 bg-black/40 rounded-2xl border border-white/10">
                <PlayerSpot
                    player={mockPlayer}
                    isMe={false}
                    canAct={false}
                    isNight={false}
                    myRole={Role.CIVILIAN}
                    isSelected={false}
                    mark={null}
                    onSetMark={() => { }}
                    isSpeaking={true}
                    speechTimeRemaining={timeRemaining}
                />
            </div>

            {/* Comparison: Non-speaking player */}
            <div className="text-white/40 text-sm mb-2">Comparison: Non-speaking player</div>
            <div className="p-8 bg-black/40 rounded-2xl border border-white/10 opacity-60">
                <PlayerSpot
                    player={{ ...mockPlayer, name: 'Waiting Player', address: '0x999' as `0x${string}` }}
                    isMe={false}
                    canAct={false}
                    isNight={false}
                    myRole={Role.CIVILIAN}
                    isSelected={false}
                    mark={null}
                    onSetMark={() => { }}
                    isSpeaking={false}
                    speechTimeRemaining={0}
                />
            </div>
        </div>
    );
};

// Test wrapper for MicButton component - MOCK VERSION (no LiveKit connection)
const MicButtonTestWrapper: React.FC = () => {
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isConnected, setIsConnected] = useState(true); // Simulated connected state

    const toggleMic = () => {
        if (isMyTurn && isConnected) {
            setIsMuted(!isMuted);
        }
    };

    const isDisabled = !isMyTurn || !isConnected;

    return (
        <div className="flex flex-col items-center gap-6 p-8">
            {/* Header */}
            <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Microphone Button (Mock)</h3>
                <p className="text-white/50 text-sm">Visual preview - no LiveKit connection</p>
            </div>

            {/* Controls */}
            <div className="flex gap-4 flex-wrap justify-center">
                <button
                    onClick={() => setIsMyTurn(!isMyTurn)}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${isMyTurn
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                        }`}
                >
                    {isMyTurn ? '✓ My Turn' : '✗ Not My Turn'}
                </button>
                <button
                    onClick={() => setIsConnected(!isConnected)}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${isConnected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                        }`}
                >
                    {isConnected ? '✓ Connected' : '✗ Disconnected'}
                </button>
            </div>

            {/* Status Display */}
            <div className="text-center space-y-2">
                <div className={`text-sm font-medium ${isMyTurn ? 'text-green-400' : 'text-gray-500'}`}>
                    {isMyTurn ? 'You can speak now!' : 'Wait for your turn...'}
                </div>
            </div>

            {/* Main Button Display - MOCK */}
            <div className="p-8 bg-black/40 rounded-2xl border border-white/10">
                <motion.button
                    onClick={toggleMic}
                    disabled={isDisabled}
                    className={`
                        relative w-14 h-14 rounded-full flex items-center justify-center
                        transition-all duration-300 shadow-lg
                        ${isDisabled
                            ? 'bg-gray-800/50 border border-gray-600/30 cursor-not-allowed opacity-50'
                            : isMuted
                                ? 'bg-gray-800/80 border-2 border-gray-500/50 hover:border-[#916A47]/70 hover:bg-gray-700/80'
                                : 'bg-green-600 border-2 border-green-400/70 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                        }
                    `}
                    whileHover={!isDisabled ? { scale: 1.05 } : {}}
                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                >
                    {/* Speaking pulse animation */}
                    <AnimatePresence>
                        {!isMuted && isMyTurn && (
                            <motion.div
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 1.5, opacity: 0 }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 1.5,
                                    ease: "easeOut"
                                }}
                                className="absolute inset-0 rounded-full bg-green-500"
                            />
                        )}
                    </AnimatePresence>

                    {/* Icon */}
                    {isMuted ? (
                        <MicOff className={`w-6 h-6 ${isDisabled ? 'text-gray-500' : 'text-gray-300'}`} />
                    ) : (
                        <Mic className="w-6 h-6 text-white" />
                    )}

                    {/* Your turn indicator */}
                    {isMyTurn && isConnected && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-[#916A47] rounded-full flex items-center justify-center"
                        >
                            <div className="w-2 h-2 bg-white rounded-full" />
                        </motion.div>
                    )}


                </motion.button>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-800/50 border border-gray-600/30 flex items-center justify-center opacity-50">
                        <MicOff className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-white/50">Not your turn</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-800/80 border-2 border-gray-500/50 flex items-center justify-center">
                        <MicOff className="w-4 h-4 text-gray-300" />
                    </div>
                    <span className="text-white/50">Your turn (muted)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-600 border-2 border-green-400/70 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                        <Mic className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white/50">Speaking</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-800/50 flex items-center justify-center animate-pulse">
                        <Loader2 className="w-4 h-4 text-[#916A47] animate-spin" />
                    </div>
                    <span className="text-white/50">Connecting</span>
                </div>
            </div>
        </div>
    );
};

// Test wrapper for Discussion Chat - LOCAL ONLY (no LiveKit connection)
const DiscussionChatTestWrapper: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [canWrite, setCanWrite] = useState(true);
    const initialMessageBaseTs = 1700000000000;
    const [messages, setMessages] = useState<{ id: string; sender: string; senderAddress: string; content: string; timestamp: number }[]>([
        { id: '1', sender: 'Alice', senderAddress: '0x1111', content: 'Я думаю это Bob, потому что он молчит', timestamp: initialMessageBaseTs - 30000 },
        { id: '2', sender: 'Charlie', senderAddress: '0x2222', content: 'Согласен, Bob подозрителен', timestamp: initialMessageBaseTs - 20000 },
        { id: '3', sender: 'Bob', senderAddress: '0x3333', content: 'Я не мафия! Посмотрите на Dave!', timestamp: initialMessageBaseTs - 10000 },
    ]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const prevMessagesCountRef = React.useRef(messages.length);
    const { playChatMessageSound } = useSoundEffects();

    // Play sound when new message arrives from others
    React.useEffect(() => {
        if (messages.length > prevMessagesCountRef.current) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.senderAddress.toLowerCase() !== TEST_ADDRESS.toLowerCase()) {
                playChatMessageSound();
            }
        }
        prevMessagesCountRef.current = messages.length;
    }, [messages, playChatMessageSound]);

    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;
        const newMessage = {
            id: `${Date.now()}`,
            sender: 'You',
            senderAddress: TEST_ADDRESS.toLowerCase(),
            content: inputValue.trim(),
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col items-center gap-6 w-full">
            {/* Controls */}
            <div className="flex gap-4 flex-wrap justify-center">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${isExpanded ? 'bg-[#916A47] text-white' : 'bg-gray-700 text-gray-300'
                        }`}
                >
                    {isExpanded ? 'Chat Open' : 'Chat Closed'}
                </button>
                <button
                    onClick={() => setCanWrite(!canWrite)}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${canWrite ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
                        }`}
                >
                    {canWrite ? '✓ Can Write' : '✗ Read Only'}
                </button>
                <button
                    onClick={() => setMessages([])}
                    className="px-6 py-3 rounded-xl font-medium bg-rose-600/50 text-white hover:bg-rose-600"
                >
                    Clear Messages
                </button>
                <button
                    onClick={() => {
                        const names = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve'];
                        const phrases = [
                            'Это точно не я!',
                            'Голосуем за мафию!',
                            'Кто молчит - тот подозрителен',
                            'Я видел как он вёл себя странно',
                            'Давайте обсудим спокойно'
                        ];
                        const randomName = names[Math.floor(Math.random() * names.length)];
                        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
                        const newMsg = {
                            id: `${Date.now()}`,
                            sender: randomName,
                            senderAddress: '0xOTHER',
                            content: randomPhrase,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, newMsg]);
                    }}
                    className="px-6 py-3 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-500"
                >
                    🔔 Simulate Message
                </button>
            </div>

            {/* Chat container - positioned relative to show button always at bottom */}
            <div className="relative flex flex-col items-end">
                {/* Chat Panel - expands upward from button */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, scaleY: 0 }}
                            animate={{ opacity: 1, height: 384, scaleY: 1 }}
                            exit={{ opacity: 0, height: 0, scaleY: 0 }}
                            transition={{
                                type: 'spring',
                                damping: 25,
                                stiffness: 300,
                                opacity: { duration: 0.15 }
                            }}
                            style={{ originY: 1 }}
                            className="w-80 mb-3 bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-medium text-sm">Discussion Chat</span>
                                </div>
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {messages.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-white/30 text-sm">
                                        No messages yet
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const isMe = msg.senderAddress.toLowerCase() === TEST_ADDRESS.toLowerCase();
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                            >
                                                <span className="text-[10px] text-white/40 mb-0.5 px-2">
                                                    {msg.sender}
                                                </span>
                                                <div
                                                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isMe
                                                        ? 'bg-[#916A47] text-white rounded-br-md'
                                                        : 'bg-white/10 text-white/90 rounded-bl-md'
                                                        }`}
                                                >
                                                    {msg.content}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-3 border-t border-white/10 bg-black/40">
                                {canWrite ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Type a message..."
                                            maxLength={200}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#916A47]/50 transition-all"
                                        />
                                        <button
                                            onClick={handleSend}
                                            disabled={!inputValue.trim()}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#916A47] text-white hover:bg-[#a5784f] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 py-2 text-white/40 text-sm">
                                        <Loader2 className="w-4 h-4" />
                                        <span>Wait for your turn to speak</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toggle Button - always visible at bottom */}
                <motion.button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`w-14 h-14 flex items-center justify-center rounded-full shadow-lg transition-all ${isExpanded
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'bg-[#916A47] text-white hover:bg-[#a5784f]'
                        }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <motion.div
                        animate={{ rotate: isExpanded ? 45 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {isExpanded ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
                    </motion.div>
                </motion.button>
            </div>
        </div>
    );
};

// Wrapper for Game Feed Simulation
const GameFeedSimulationTest: React.FC = () => {
    const { setGameState, addLog } = useGameContext();
    const [isSimulating, setIsSimulating] = useState(false);

    // Initial setup
    useEffect(() => {
        setGameState({phase: GamePhase.DAY,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: generateMock16Players(TEST_ADDRESS),
            logs: [], // Start empty
            revealedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: 0,
            winner: null,
            mafiaMessages: [],
            maxPlayers: 16,
            mafiaCommittedCount: 0,
        });
    }, [setGameState]);

    const simulateGameFeed = useCallback(async () => {
        if (isSimulating) return;
        setIsSimulating(true);

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        // Clear logs first
        setGameState(prev => ({ ...prev, logs: [], dayCount: 1, phase: GamePhase.DAY }));
        await delay(100);

        // ── Day 1 ──
        addLog("Day 1 has begun", "phase");
        await delay(600);
        addLog("Night Result: No one died", "info");
        await delay(1000);
        addLog("Discussion Phase started", "info");
        await delay(900);
        addLog("Player1 is now speaking", "info");
        await delay(1200);
        addLog("Player2 is now speaking", "info");
        await delay(1200);
        addLog("Player3 is now speaking", "info");
        await delay(1200);
        addLog("All players have spoken", "info");
        await delay(800);
        addLog("Voting Phase Started", "warning");
        await delay(800);
        addLog("Player1 voted for Player4");
        await delay(500);
        addLog("Player2 voted for Player4");
        await delay(500);
        addLog("Player5 voted for Player4");
        await delay(500);
        addLog("Player6 voted for Player4");
        await delay(500);
        addLog("Player7 voted for Player4");
        await delay(800);
        addLog("Player4 eliminated by vote", "danger");
        await delay(1500);
        addLog("Night has fallen", "night");
        await delay(1500);

        // ── Day 2 ──
        setGameState(prev => ({ ...prev, logs: [...prev.logs], dayCount: 2, phase: GamePhase.DAY }));
        await delay(400);
        addLog("Day 2 has begun", "phase");
        await delay(600);
        addLog("Night Result: Player6 was killed", "danger");
        await delay(1000);
        addLog("Discussion Phase started", "info");
        await delay(900);
        addLog("Player1 is now speaking", "info");
        await delay(1200);
        addLog("Player3 is now speaking", "info");
        await delay(1200);
        addLog("All players have spoken", "info");
        await delay(800);
        addLog("Voting Phase Started", "warning");
        await delay(800);
        addLog("Player1 voted for Player2");
        await delay(500);
        addLog("Player3 voted for Player2");
        await delay(500);
        addLog("Player5 voted for Player2");
        await delay(800);
        addLog("Voting Finalized: No one was eliminated", "info");
        await delay(1500);
        addLog("Night has fallen", "night");

        setIsSimulating(false);
    }, [addLog, setGameState, isSimulating]);

    return (
        <div className="w-full h-full relative">
            <div className="fixed top-20 right-4 z-[1000] space-y-2">
                <Button
                    onClick={simulateGameFeed}
                    disabled={isSimulating}
                    isLoading={isSimulating}
                    variant="outline-gold"
                    className="bg-purple-900/80 border-purple-500/50 text-purple-200"
                >
                    {isSimulating ? 'Simulating...' : '▶ Start Feed Sim'}
                </Button>
            </div>
            <GameLayout />
        </div>
    );
};

// Test wrapper for Game Hints — shows buttons to trigger each hint type
const GameHintsTestWrapper: React.FC = () => {
    const [activeHint, setActiveHint] = useState<HintType | null>(null);

    const hints: { type: HintType; label: string; color: string }[] = [
        { type: 'discussion', label: '🗣 Discussion', color: 'bg-amber-600 hover:bg-amber-500' },
        { type: 'voting', label: '🗳 Voting', color: 'bg-orange-600 hover:bg-orange-500' },
        { type: 'night_mafia', label: '🔪 Mafia Night', color: 'bg-rose-600 hover:bg-rose-500' },
        { type: 'night_doctor', label: '🛡 Doctor Night', color: 'bg-teal-600 hover:bg-teal-500' },
        { type: 'night_detective', label: '🔍 Detective Night', color: 'bg-sky-600 hover:bg-sky-500' },
        { type: 'night_civilian', label: '😴 Civilian Night', color: 'bg-indigo-600 hover:bg-indigo-500' },
    ];

    return (
        <div className="w-full flex flex-col items-center gap-6">
            <h3 className="text-white/60 text-sm uppercase tracking-wider">Click a button to preview that hint</h3>
            <div className="flex flex-wrap gap-3 justify-center">
                {hints.map(h => (
                    <button
                        key={h.type}
                        onClick={() => setActiveHint(h.type)}
                        className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${h.color}`}
                    >
                        {h.label}
                    </button>
                ))}
            </div>
            <button
                onClick={() => setActiveHint(null)}
                className="px-4 py-1.5 rounded-lg text-white/40 text-xs border border-white/10 hover:bg-white/5 transition-colors"
            >
                Dismiss
            </button>
            {/* Render inline (not fixed) so it's visible in the test area without sidebar overlap */}
            <div className="w-full flex justify-center mt-4">
                <GameHintsOverlay activeHint={activeHint} onDismiss={() => setActiveHint(null)} inline />
            </div>
        </div>
    );
};

// --- REUSABLE MOCK BANNER FOR VISUAL TESTING ---
const MockSessionKeyBanner: React.FC<{
    state: 'initial' | 'active' | 'low_gas' | 'registering' | 'error';
    errorMsg?: string;
}> = ({ state, errorMsg }) => {
    const hasSession = state === 'active' || state === 'low_gas';
    const isLowBalance = state === 'low_gas';
    const isRegistering = state === 'registering';
    const error = state === 'error' ? (errorMsg || 'Session not found. Please rejoin the room.') : null;
    const sessionAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
    const sessionBalance = isLowBalance ? 1000000000000000n : 50000000000000000n; // 0.001 vs 0.05
    const expiresAt = '3h 30m';

    const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    const formatBalance = (bal: bigint) => (Number(bal) / 1e18).toFixed(4);

    const theme = !hasSession
        ? {
            wrap: 'bg-[#000000]/95 border-white/8',
            iconWrap: 'bg-white/4 border border-white/8 shadow-inner',
            accent: 'text-white/40',
            label: 'text-white/55',
            pulse: 'bg-white/25',
            divider: 'border-white/6',
            footerBg: 'bg-black/25',
            footerText: 'text-white/35',
            btnPrimary: 'bg-[#916A47]/12 border-[#916A47]/35 hover:bg-[#916A47]/22 text-[#C8904A]',
        }
        : isLowBalance
            ? {
                wrap: 'bg-[#1E0E07]/95 border-[#8B3A1A]/30',
                iconWrap: 'bg-[#8B3A1A]/18 border border-[#8B3A1A]/35 shadow-inner',
                accent: 'text-[#D4724A]',
                label: 'text-[#D4724A]/80',
                pulse: 'bg-[#D4724A]',
                divider: 'border-[#8B3A1A]/25',
                footerBg: 'bg-[#8B3A1A]/08',
                footerText: 'text-[#D4724A]/60',
                btnPrimary: 'bg-[#8B3A1A]/15 border-[#8B3A1A]/40 hover:bg-[#8B3A1A]/25 text-[#D4724A]',
            }
            : {
                wrap: 'bg-[#110D07]/95 border-[#916A47]/28',
                iconWrap: 'bg-[#916A47]/18 border border-[#916A47]/32 shadow-inner',
                accent: 'text-[#C8904A]',
                label: 'text-[#C8904A]/75',
                pulse: 'bg-[#C8904A]',
                divider: 'border-[#916A47]/20',
                footerBg: 'bg-[#916A47]/05',
                footerText: 'text-[#916A47]/55',
                btnPrimary: 'bg-[#916A47]/12 border-[#916A47]/35 hover:bg-[#916A47]/22 text-[#C8904A]',
            };

    return (
        <div className={`w-full rounded-2xl border backdrop-blur-2xl overflow-hidden shadow-2xl transition-all duration-300 ${theme.wrap}`}>
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${theme.iconWrap}`}>
                        {hasSession ? (isLowBalance ? <Fuel className={`w-4 h-4 ${theme.accent}`} /> : <Shield className={`w-4 h-4 ${theme.accent}`} />) : <Key className={`w-4 h-4 ${theme.accent}`} />}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <p className={`text-[13px] font-bold tracking-wide font-['Cinzel'] leading-none ${theme.accent}`}>
                            {state === 'initial' && 'No Session Key'}
                            {state === 'active' && 'Session Active'}
                            {state === 'low_gas' && 'Low Gas'}
                            {state === 'registering' && 'Activating Key'}
                            {state === 'error' && 'Session Error'}
                        </p>
                        {hasSession ? (
                            <div className={`flex items-center gap-1.5 text-[10px] font-mono ${theme.label}`}>
                                <span>{shortenAddress(sessionAddress)}</span>
                                <span className="text-white/20">·</span>
                                <Wallet className="w-2.5 h-2.5" />
                                <span className={isLowBalance ? 'text-[#D4724A]' : ''}>{formatBalance(sessionBalance)} STT</span>
                                <span className="text-white/20">·</span>
                                <Clock className="w-2.5 h-2.5" />
                                <span>{expiresAt}</span>
                            </div>
                        ) : (
                            <p className={`text-[10px] font-['Montserrat'] ${theme.label}`}>
                                {isRegistering ? 'Initialising...' : 'Manual signature required'}
                            </p>
                        )}
                    </div>
                </div>
                <ChevronDown className="w-4 h-4 text-white/25 ml-2" />
            </div>

            <div className="px-4 pb-4 flex flex-col gap-2">
                {hasSession ? (
                    <div className="flex items-center gap-2">
                        {isLowBalance && (
                            <button className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold tracking-wide font-['Montserrat'] uppercase transition-all ${theme.btnPrimary}`}>
                                <Fuel className="w-3.5 h-3.5" /> +0.02 STT
                            </button>
                        )}
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 text-white/40 hover:text-[#C8904A] text-[11px] font-medium font-['Montserrat'] transition-all">
                            Withdraw
                        </button>
                        <button className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 text-white/40 hover:text-[#C94040] text-[11px] font-medium font-['Montserrat'] transition-all">
                            <X className="w-3.5 h-3.5" /> Revoke
                        </button>
                    </div>
                ) : (
                    <button className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[12px] font-bold tracking-widest font-['Cinzel'] uppercase transition-all ${theme.btnPrimary}`}>
                        {isRegistering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                        {isRegistering ? 'Signing...' : 'Enable Auto-Sign'}
                    </button>
                )}

                {error && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#C94040]/10 border border-[#C94040]/20">
                        <AlertTriangle className="w-3 h-3 text-[#C94040] shrink-0 mt-0.5" />
                        <p className="text-[10px] text-[#C94040]/90 font-medium font-['Montserrat'] leading-snug">{error}</p>
                    </div>
                )}
            </div>

            {!hasSession && !isRegistering && (
                <div className={`px-4 py-2.5 border-t ${theme.divider} ${theme.footerBg}`}>
                    <p className={`text-[10px] font-['Montserrat'] leading-relaxed ${theme.footerText}`}>
                        <span className={`font-bold ${theme.accent}`}>Session Keys</span> — one signature, no popups for 4 hours.
                    </p>
                </div>
            )}
            {isLowBalance && (
                <div className={`px-4 py-2.5 border-t ${theme.divider} ${theme.footerBg}`}>
                    <p className={`text-[10px] font-['Montserrat'] leading-relaxed italic ${theme.footerText}`}>
                        Session wallet is low on gas. Add funds to continue playing.
                    </p>
                </div>
            )}
        </div>
    );
};

// --- Outdated component removed ---

// --- Standalone Test Wrapper for Session Key Gallery ---
const SessionKeyTestWrapper: React.FC = () => {
    return (
        <div className="w-full max-w-4xl flex flex-col items-center gap-12 p-8">
            <div className="text-center space-y-2">
                <h3 className="text-3xl font-['Cinzel'] text-[#ffb01d] tracking-widest">Session Key Gallery</h3>
                <p className="text-white/40 text-sm max-w-md mx-auto">
                    Visual library of all possible banner states. No blockchain connection required for this preview.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                {/* 1. DISCONNECTED */}
                <div className="space-y-3">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] pl-2">1. Disconnected (Initial)</span>
                    <MockSessionKeyBanner state="initial" />
                </div>

                {/* 2. REGISTERING */}
                <div className="space-y-3">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] pl-2">2. Activating (Loading)</span>
                    <MockSessionKeyBanner state="registering" />
                </div>

                {/* 3. ACTIVE */}
                <div className="space-y-3">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] pl-2">3. Healthy Session</span>
                    <MockSessionKeyBanner state="active" />
                </div>

                {/* 4. LOW GAS */}
                <div className="space-y-3">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] pl-2">4. Resource Warning</span>
                    <MockSessionKeyBanner state="low_gas" />
                </div>

                {/* 5. ERROR */}
                <div className="space-y-3 lg:col-span-2 max-w-md mx-auto w-full">
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] pl-2">5. Critical Error</span>
                    <MockSessionKeyBanner state="error" errorMsg="Session key has expired or was revoked. Please sign a new one." />
                </div>

                {/* 6. WAITING ROOM VARIANTS */}
                <div className="lg:col-span-2 pt-8 border-t border-white/5 space-y-6">
                    <div className="text-center space-y-1">
                        <h4 className="text-sm font-['Cinzel'] text-white/60 tracking-widest uppercase">Lobby Sequence Variants</h4>
                        <p className="text-[10px] text-white/30">As seen in the Waiting Room (WaitingRoom.tsx integration)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <span className="text-[9px] font-bold text-white/15 uppercase tracking-widest pl-2">Checking State</span>
                            <MockSessionKeyBanner state="registering" />
                        </div>
                        <div className="space-y-3">
                            <span className="text-[9px] font-bold text-[#C8904A]/40 uppercase tracking-widest pl-2">Active State</span>
                            <MockSessionKeyBanner state="active" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Test wrapper for Session Key in an Active Game Phase
const ActivePhaseSessionTestWrapper: React.FC = () => {
    return (
        <div className="w-full h-[650px] relative bg-[#050505] overflow-hidden rounded-[32px] border border-white/10 shadow-2xl">
            {/* Mock Game Background */}
            <div className="absolute inset-0 opacity-40">
                <img
                    src="/assets/game_background.png"
                    alt="bg"
                    className="w-full h-full object-cover"
                    style={{ filter: 'grayscale(0.5) brightness(0.3)' }}
                />
            </div>

            {/* Scale the phase component to fit the test area */}
            <div className="absolute inset-0 flex items-center justify-center transform scale-90">
                <NightPhaseTestWrapper testRole={Role.MAFIA} />
            </div>

            {/* Session Key Banner in its real-world "fixed" position (relative to this container) */}
            <div className="absolute bottom-6 left-6 z-50">
                <SessionKeyBanner roomId={123} />
            </div>

            {/* Legend/Info Badge */}
            <div className="absolute top-6 left-6 flex flex-col gap-1">
                <div className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-[#ffb01d]/30 text-[#ffb01d] text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg">
                    Game Phase + Session Control
                </div>
                <p className="text-white/40 text-[10px] pl-4">Testing banner visibility during interactive Night phase</p>
            </div>

            {/* Interactive hint for the tester */}
            <div className="absolute top-6 right-6">
                <div className="bg-white/5 border border-white/10 backdrop-blur-md p-3 rounded-2xl max-w-[150px]">
                    <p className="text-white/60 text-[10px] leading-tight">
                        The banner is placed exactly as it appears in <strong>GameLayout.tsx</strong>
                    </p>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
// BUTTON SHOWCASE — три концепта дизайна кнопок для сравнения
// ═══════════════════════════════════════════════════════════

const BUTTON_CONTEXTS = [
    {
        label: 'Discussion phase',
        buttons: [
            { label: '> Finish Speech Early', type: 'primary-action' },
            { label: '> FORCE SKIP (HOST)', type: 'danger-action' },
        ],
    },
    {
        label: 'Voting phase',
        buttons: [
            { label: 'VOTE FOR DIANA', type: 'vote-action' },
        ],
    },
];

type BtnConceptVariant = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

const ButtonConcept: React.FC<{ variant: BtnConceptVariant; type: string; label: string }> = ({ variant, type, label }) => {
    const [hovered, setHovered] = useState(false);

    // ── Variant A: текущий (для сравнения) ──────────────────────────────────
    const variantA: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Montserrat] font-medium text-sm transition-all duration-300 cursor-pointer bg-[#0A0A0A] border border-[#916A47]/50 text-[#916A47] hover:bg-[#916A47] hover:text-[#050505] shadow-sm',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase transition-all duration-300 cursor-pointer bg-[#0A0A0A] border border-[#8B0000]/50 text-[#8B0000] hover:bg-[#3D0000] hover:text-[#FF6B6B] shadow-sm',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase transition-all duration-300 cursor-pointer bg-[#0A0A0A] border border-[#916A47]/30 text-[#916A47] hover:bg-[#111111] hover:border-[#916A47]/80 shadow-sm',
    };

    // ── Variant B: Glow / без заливки ───────────────────────────────────────
    const variantB: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Montserrat] font-medium text-sm cursor-pointer transition-all duration-300 bg-transparent border border-[#C5A059]/60 text-[#C5A059] hover:border-[#C5A059] hover:text-white hover:shadow-[0_0_20px_rgba(197,160,89,0.35),inset_0_0_15px_rgba(197,160,89,0.06)]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-300 bg-transparent border border-[#8B0000]/50 text-[#cc3333] hover:border-[#cc3333]/80 hover:text-[#ff6666] hover:shadow-[0_0_18px_rgba(200,0,0,0.30),inset_0_0_12px_rgba(200,0,0,0.05)]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-300 bg-transparent border border-[#C5A059]/40 text-[#C5A059] hover:border-[#C5A059] hover:text-white hover:shadow-[0_0_24px_rgba(197,160,89,0.4),inset_0_0_18px_rgba(197,160,89,0.08)]',
    };

    // ── Variant C: Solid Premium ─────────────────────────────────────────────
    const variantC: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-lg font-[Montserrat] font-semibold text-sm cursor-pointer transition-all duration-200 bg-gradient-to-b from-[#A07850] to-[#7A5630] text-[#0A0A0A] border border-[#C5A059]/40 hover:from-[#B5895C] hover:to-[#8A6640] hover:shadow-[0_4px_20px_rgba(145,106,71,0.50)] active:scale-[0.98]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-lg font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-200 bg-gradient-to-b from-[#5a0000] to-[#3D0000] text-[#FF8080] border border-[#8B0000]/60 hover:from-[#6d0000] hover:to-[#4D0000] hover:shadow-[0_4px_20px_rgba(139,0,0,0.45)] active:scale-[0.98]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-lg font-[Cinzel] font-semibold text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-200 bg-gradient-to-b from-[#1a1208] to-[#0D0A04] text-[#C5A059] border border-[#C5A059]/50 hover:from-[#2a1e0e] hover:to-[#1a1208] hover:text-[#E0BE80] hover:shadow-[0_4px_24px_rgba(197,160,89,0.35)] active:scale-[0.98]',
    };

    // ── Variant D: Minimal Ghost ─────────────────────────────────────────────
    const variantD: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full font-[Montserrat] font-medium text-sm cursor-pointer transition-all duration-200 text-[#C5A059]/80 hover:text-[#C5A059] border-b border-[#916A47]/30 hover:border-[#916A47] rounded-none bg-transparent hover:bg-[#916A47]/05',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-200 text-[#8B0000]/80 hover:text-[#cc4444] border-b border-[#8B0000]/30 hover:border-[#cc4444] rounded-none bg-transparent',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-200 text-[#C5A059] border border-[#C5A059]/40 hover:border-[#C5A059] rounded-sm bg-[#C5A059]/05 hover:bg-[#C5A059]/10',
    };

    // ── Variant E: Dark Glass (Frosted backdrop) ────────────────────────────
    // Стекло поверх тёмного фона — backdrop-blur создаёт глубину
    const variantE: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Montserrat] font-medium text-sm cursor-pointer transition-all duration-300 backdrop-blur-md bg-[#916A47]/10 border border-[#C5A059]/30 text-[#C5A059] hover:bg-[#916A47]/20 hover:border-[#C5A059]/60 hover:text-white hover:shadow-[0_0_30px_rgba(197,160,89,0.20)] active:scale-[0.98]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-300 backdrop-blur-md bg-[#8B0000]/12 border border-[#8B0000]/35 text-[#cc4444] hover:bg-[#8B0000]/25 hover:border-[#cc3333]/60 hover:text-[#ff7777] hover:shadow-[0_0_25px_rgba(139,0,0,0.20)] active:scale-[0.98]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-semibold text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-300 backdrop-blur-md bg-[#C5A059]/08 border border-[#C5A059]/40 text-[#C5A059] hover:bg-[#C5A059]/18 hover:border-[#C5A059]/70 hover:text-white hover:shadow-[0_0_35px_rgba(197,160,89,0.25)] active:scale-[0.98]',
    };

    // ── Variant F: Noir Pulse (анимированная рамка) ──────────────────────────
    // Рамка «дышит» — живая кнопка которая зовёт нажать
    const variantF: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-sm font-[Montserrat] font-medium text-sm cursor-pointer transition-all duration-200 bg-[#0D0D0D] border border-[#C5A059]/40 text-[#C5A059]/80 hover:border-[#C5A059] hover:text-[#E8C878] hover:bg-[#0D0D0D] hover:shadow-[0_0_0_1px_rgba(197,160,89,0.3),0_0_20px_rgba(197,160,89,0.18),inset_0_0_20px_rgba(197,160,89,0.04)] active:scale-[0.97]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-sm font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-200 bg-[#0D0D0D] border border-[#7a0000]/50 text-[#aa2222]/80 hover:border-[#cc2222] hover:text-[#ff5555] hover:bg-[#0D0D0D] hover:shadow-[0_0_0_1px_rgba(180,0,0,0.25),0_0_18px_rgba(180,0,0,0.15),inset_0_0_16px_rgba(180,0,0,0.04)] active:scale-[0.97]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-sm font-[Cinzel] font-semibold text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-200 bg-[#0D0D0D] border border-[#C5A059]/35 text-[#C5A059] hover:border-[#E8C878] hover:text-[#F0D080] hover:bg-[#0D0D0D] hover:shadow-[0_0_0_1px_rgba(197,160,89,0.3),0_0_28px_rgba(197,160,89,0.22),inset_0_0_22px_rgba(197,160,89,0.05)] active:scale-[0.97]',
    };

    // ── Variant G: Hybrid — Gradient fill + glow hover ───────────────────────
    // Лучшее из C и B: градиент всегда (читаемость), glow на hover (атмосфера)
    const variantG: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Montserrat] font-semibold text-sm cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#1C1208] to-[#0D0A04] border border-[#C5A059]/35 text-[#C5A059] hover:from-[#261A0B] hover:to-[#160E06] hover:border-[#C5A059]/70 hover:text-[#E8C878] hover:shadow-[0_0_0_1px_rgba(197,160,89,0.15),0_4px_24px_rgba(197,160,89,0.30),inset_0_1px_0_rgba(197,160,89,0.08)] active:scale-[0.98]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#1A0000] to-[#0D0000] border border-[#8B0000]/40 text-[#cc3333] hover:from-[#240000] hover:to-[#140000] hover:border-[#cc2222]/65 hover:text-[#ff5555] hover:shadow-[0_0_0_1px_rgba(180,0,0,0.15),0_4px_20px_rgba(180,0,0,0.28),inset_0_1px_0_rgba(180,0,0,0.08)] active:scale-[0.98]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-semibold text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#1C1208] to-[#0D0A04] border border-[#C5A059]/40 text-[#C5A059] hover:from-[#261A0B] hover:to-[#160E06] hover:border-[#E8C878]/60 hover:text-[#F0D888] hover:shadow-[0_0_0_1px_rgba(197,160,89,0.12),0_4px_28px_rgba(197,160,89,0.35),inset_0_1px_0_rgba(197,160,89,0.10)] active:scale-[0.98]',
    };

    const classMap: Record<BtnConceptVariant, Record<string, string>> = {
        A: variantA,
        B: variantB,
        C: variantC,
        D: variantD,
        E: variantE,
        F: variantF,
        G: variantG,
    };

    return (
        <button
            className={classMap[variant][type] || ''}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {label}
        </button>
    );
};

const ButtonShowcaseTest: React.FC = () => {
    const concepts: { id: BtnConceptVariant; title: string; desc: string; tag?: string }[] = [
        { id: 'A', title: 'Current (Reference)', desc: 'Текущий — fill on hover для primary, outline для danger' },
        { id: 'B', title: 'Glow / No Fill', desc: 'Без заливки, только свечение на hover — cinematic terminal' },
        { id: 'C', title: 'Solid Premium', desc: 'Gradient fill всегда — premium, без инверсии' },
        { id: 'D', title: 'Minimal Ghost', desc: 'Нижняя линия для action, outline для vote' },
        { id: 'E', title: 'Dark Glass', desc: 'Frosted backdrop-blur + тёплый tint — эффект стекла поверх нуар-фона', tag: '⭐ Noir' },
        { id: 'F', title: 'Noir Pulse', desc: 'Double glow-ring на hover — живая, «дышащая» кнопка', tag: '⭐ Noir' },
        { id: 'G', title: 'Hybrid (B+C)', desc: 'Тёмный gradient всегда + glow на hover — лучшее из обоих', tag: '⭐ Рекомендую' },
    ];

    return (
        <div className="w-full min-h-full bg-[#080808] p-8 overflow-auto">
            {/* Background matching the game */}
            <div
                className="fixed inset-0 opacity-30 pointer-events-none"
                style={{ backgroundImage: 'url(/assets/game_background.png)', backgroundSize: 'cover' }}
            />

            <div className="relative z-10">
                <h2 className="text-[#C5A059] font-['Cinzel'] text-2xl tracking-widest mb-1 text-center">BUTTON STYLE CONCEPTS</h2>
                <p className="text-white/30 text-xs text-center mb-6">Hover каждую кнопку чтобы увидеть состояние · ⭐ = специально для нуар-стиля</p>

                {/* Recommendation banner */}
                <div className="mb-8 p-4 rounded-md border border-[#C5A059]/20 bg-[#C5A059]/05 backdrop-blur-sm">
                    <p className="text-[#C5A059]/80 text-xs leading-relaxed">
                        <span className="font-semibold text-[#C5A059]">🎬 Для вашего нуара рекомендую:</span>{' '}
                        <span className="text-white/50">Варианты <strong className="text-white/70">E</strong>, <strong className="text-white/70">F</strong>, и <strong className="text-white/70">G</strong> разработаны специально под тёмный раин-нуар фон.
                        G (Hybrid) даёт лучший баланс — кнопка всегда видна даже без hover, но не конкурирует с фоном.
                        E (Dark Glass) самый атмосферный — blurred стекло исчезает в фоне.
                        F (Noir Pulse) самый живой — double-ring glow выглядит как неоновый знак.</span>
                    </p>
                </div>

                {/* Grid of concepts */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
                    {concepts.map(concept => (
                        <div
                            key={concept.id}
                            className={`flex flex-col gap-3 rounded-md p-3 ${
                                concept.tag?.includes('Рекомендую')
                                    ? 'ring-1 ring-[#C5A059]/30 bg-[#C5A059]/04'
                                    : concept.tag?.includes('Noir')
                                    ? 'ring-1 ring-white/08'
                                    : ''
                            }`}
                        >
                            {/* Header */}
                            <div className="border-b border-white/10 pb-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-6 h-6 rounded bg-[#916A47]/20 border border-[#916A47]/40 text-[#C5A059] text-xs font-bold font-['Cinzel'] flex items-center justify-center">
                                        {concept.id}
                                    </span>
                                    <span className="text-white/80 text-sm font-semibold">{concept.title}</span>
                                    {concept.tag && (
                                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#C5A059]/15 text-[#C5A059]/80 border border-[#C5A059]/20 whitespace-nowrap">
                                            {concept.tag}
                                        </span>
                                    )}
                                </div>
                                <p className="text-white/35 text-[10px] leading-tight">{concept.desc}</p>
                            </div>

                            {/* Buttons in context */}
                            {BUTTON_CONTEXTS.map(ctx => (
                                <div key={ctx.label} className="flex flex-col gap-2">
                                    <span className="text-white/20 text-[10px] uppercase tracking-widest">{ctx.label}</span>
                                    {ctx.buttons.map(btn => (
                                        <ButtonConcept
                                            key={btn.type}
                                            variant={concept.id}
                                            type={btn.type}
                                            label={btn.label}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Notes */}
                <div className="mt-10 border-t border-white/10 pt-6">
                    <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3">Краткий разбор</h3>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 text-[10px] text-white/30 leading-relaxed">
                        <div><span className="text-white/50 font-semibold">A — текущий:</span><br />Заливка на hover — «кожаная сумка». Danger слишком агрессивен.</div>
                        <div><span className="text-white/50 font-semibold">B — glow:</span><br />Чисто cinematic. Нет резких скачков. Но без hover кнопка выглядит почти невидимо.</div>
                        <div><span className="text-white/50 font-semibold">C — solid:</span><br />Самый читаемый. Но может быть тяжеловат для нуар-атмосферы.</div>
                        <div><span className="text-white/50 font-semibold">D — ghost:</span><br />Для secondary OK. Vote-кнопка теряется как primary action.</div>
                        <div><span className="text-[#C5A059]/60 font-semibold">E — dark glass:</span><br />Frosted tint — кнопки «растворяются» в фоне. Очень атмосферно, особенно поверх туманного фона.</div>
                        <div><span className="text-[#C5A059]/60 font-semibold">F — noir pulse:</span><br />Double-ring glow — эффект неонового знака ночного города. Живая, отзывчивая.</div>
                        <div><span className="text-[#C5A059]/60 font-semibold">G — hybrid (⭐):</span><br />Тёмный gradient + glow hover. Всегда видна, не конкурирует с фоном, атмосферна.</div>
                        <div className="text-white/20 italic">Для данного нуар-стиля E/F/G явно превосходят A/B/C/D.</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════
// HYBRID G — ЦВЕТОВЫЕ ВАРИАНТЫ
// ═══════════════════════════════════════════════════════════

type GColorPalette = 'G1' | 'G2' | 'G3' | 'G4';

const GColorButton: React.FC<{ palette: GColorPalette; type: string; label: string }> = ({ palette, type, label }) => {
    // G1 — Warm Gold (текущий G)
    const g1: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Montserrat] font-semibold text-sm cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#1C1208] to-[#0D0A04] border border-[#C5A059]/35 text-[#C5A059] hover:from-[#261A0B] hover:to-[#160E06] hover:border-[#C5A059]/70 hover:text-[#E8C878] hover:shadow-[0_0_0_1px_rgba(197,160,89,0.15),0_4px_24px_rgba(197,160,89,0.30),inset_0_1px_0_rgba(197,160,89,0.08)] active:scale-[0.98]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#1A0000] to-[#0D0000] border border-[#8B0000]/40 text-[#cc3333] hover:from-[#240000] hover:to-[#140000] hover:border-[#cc2222]/65 hover:text-[#ff5555] hover:shadow-[0_0_0_1px_rgba(180,0,0,0.15),0_4px_20px_rgba(180,0,0,0.28)] active:scale-[0.98]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-semibold text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#1C1208] to-[#0D0A04] border border-[#C5A059]/40 text-[#C5A059] hover:from-[#261A0B] hover:to-[#160E06] hover:border-[#E8C878]/60 hover:text-[#F0D888] hover:shadow-[0_0_0_1px_rgba(197,160,89,0.12),0_4px_28px_rgba(197,160,89,0.35)] active:scale-[0.98]',
    };

    // G2 — Dusty Gold (пыльное, состаренное)
    // Тот же gradient, но accent — тусклый бронзо-оливковый
    const g2: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Montserrat] font-semibold text-sm cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#181410] to-[#0C0A08] border border-[#A08850]/30 text-[#A08850] hover:from-[#221C14] hover:to-[#14100A] hover:border-[#B89A60]/60 hover:text-[#C8AA70] hover:shadow-[0_0_0_1px_rgba(160,136,80,0.15),0_4px_24px_rgba(160,136,80,0.25)] active:scale-[0.98]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#160A0A] to-[#0A0404] border border-[#7A3030]/35 text-[#9A4040] hover:from-[#200C0C] hover:to-[#0E0606] hover:border-[#AA4444]/55 hover:text-[#CC5555] hover:shadow-[0_0_0_1px_rgba(150,50,50,0.15),0_4px_20px_rgba(150,50,50,0.22)] active:scale-[0.98]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-semibold text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#181410] to-[#0C0A08] border border-[#A08850]/35 text-[#A08850] hover:from-[#221C14] hover:to-[#14100A] hover:border-[#C8AA70]/55 hover:text-[#D4B878] hover:shadow-[0_0_0_1px_rgba(160,136,80,0.12),0_4px_28px_rgba(160,136,80,0.28)] active:scale-[0.98]',
    };

    // G3 — Slate Silver (холодный нуар, как LA Noire / Disco Elysium)
    const g3: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Montserrat] font-semibold text-sm cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#10121A] to-[#08090F] border border-[#8090B0]/30 text-[#8090B0] hover:from-[#161822] hover:to-[#0C0D14] hover:border-[#A0B0CC]/60 hover:text-[#C0CCDD] hover:shadow-[0_0_0_1px_rgba(128,144,176,0.15),0_4px_24px_rgba(120,140,180,0.28)] active:scale-[0.98]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#180C12] to-[#0C0608] border border-[#8B3050]/35 text-[#AA4060] hover:from-[#220E18] hover:to-[#10070A] hover:border-[#CC4466]/60 hover:text-[#EE5577] hover:shadow-[0_0_0_1px_rgba(180,50,80,0.15),0_4px_20px_rgba(160,40,60,0.28)] active:scale-[0.98]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-semibold text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#10121A] to-[#08090F] border border-[#9090B8]/35 text-[#9090B8] hover:from-[#161822] hover:to-[#0C0D14] hover:border-[#B0B0D8]/60 hover:text-[#D0D0EE] hover:shadow-[0_0_0_1px_rgba(144,144,184,0.15),0_4px_28px_rgba(140,140,200,0.30)] active:scale-[0.98]',
    };

    // G4 — Frost Gold (мой фаворит: холодный фон + тёплый текст)
    // Холодный тёмный подтон в gradient, но text — яркое warm gold
    const g4: Record<string, string> = {
        'primary-action': 'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Montserrat] font-semibold text-sm cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#131318] to-[#09090C] border border-[#C5A059]/30 text-[#D4BE80] hover:from-[#1A1A22] hover:to-[#0E0E14] hover:border-[#D4BE80]/65 hover:text-[#EEDC98] hover:shadow-[0_0_0_1px_rgba(212,190,128,0.18),0_4px_24px_rgba(197,160,89,0.32),inset_0_1px_0_rgba(212,190,128,0.06)] active:scale-[0.98]',
        'danger-action':  'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-medium text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#130D0D] to-[#090606] border border-[#9B2020]/35 text-[#CC4444] hover:from-[#1A1010] hover:to-[#0E0808] hover:border-[#DD3333]/60 hover:text-[#FF6666] hover:shadow-[0_0_0_1px_rgba(180,40,40,0.18),0_4px_20px_rgba(200,50,50,0.28),inset_0_1px_0_rgba(200,60,60,0.05)] active:scale-[0.98]',
        'vote-action':    'relative flex items-center justify-center px-6 py-3.5 w-full rounded-md font-[Cinzel] font-semibold text-[13px] tracking-[0.08em] uppercase cursor-pointer transition-all duration-250 bg-gradient-to-b from-[#131318] to-[#09090C] border border-[#C5A059]/32 text-[#D4BE80] hover:from-[#1A1A22] hover:to-[#0E0E14] hover:border-[#EED898]/58 hover:text-[#F4E4A8] hover:shadow-[0_0_0_1px_rgba(212,190,128,0.16),0_4px_30px_rgba(197,160,89,0.38),inset_0_1px_0_rgba(212,190,128,0.07)] active:scale-[0.98]',
    };

    const map: Record<GColorPalette, Record<string, string>> = { G1: g1, G2: g2, G3: g3, G4: g4 };
    return <button className={map[palette][type] || ''}>{label}</button>;
};

const ButtonColorShowcaseTest: React.FC = () => {
    const palettes: { id: GColorPalette; title: string; sub: string; rec?: boolean }[] = [
        { id: 'G1', title: 'Warm Gold', sub: 'Текущий Hybrid — тёплый amber/gold' },
        { id: 'G2', title: 'Dusty Gold', sub: 'Пыльный, состаренный бронзо-оливковый' },
        { id: 'G3', title: 'Slate Silver', sub: 'Холодный LA Noire — синевато-серебристый' },
        { id: 'G4', title: 'Frost Gold', sub: 'Холодный фон + тёплый текст — лучший баланс', rec: true },
    ];

    return (
        <div className="w-full min-h-full bg-[#080808] p-8 overflow-auto">
            <div
                className="fixed inset-0 opacity-40 pointer-events-none"
                style={{ backgroundImage: 'url(/assets/game_background.png)', backgroundSize: 'cover' }}
            />
            <div className="relative z-10">
                <h2 className="text-[#C5A059] font-['Cinzel'] text-2xl tracking-widest mb-1 text-center">HYBRID G — COLOUR VARIANTS</h2>
                <p className="text-white/30 text-xs text-center mb-8">Один и тот же стиль G, четыре разные палитры · Hover чтобы увидеть акцент</p>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
                    {palettes.map(p => (
                        <div
                            key={p.id}
                            className={`flex flex-col gap-3 rounded-md p-4 ${
                                p.rec ? 'ring-1 ring-[#C5A059]/40 bg-[#C5A059]/05' : 'bg-black/20'
                            }`}
                        >
                            <div className="border-b border-white/10 pb-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-white/80 font-semibold text-sm">{p.title}</span>
                                    {p.rec && (
                                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30">
                                            ⭐ Рекомендую
                                        </span>
                                    )}
                                </div>
                                <p className="text-white/35 text-[10px] leading-tight">{p.sub}</p>
                            </div>

                            <span className="text-white/20 text-[10px] uppercase tracking-widest">Discussion phase</span>
                            <GColorButton palette={p.id} type="primary-action" label="> Finish Speech Early" />
                            <GColorButton palette={p.id} type="danger-action" label="> FORCE SKIP (HOST)" />

                            <span className="text-white/20 text-[10px] uppercase tracking-widest mt-1">Voting phase</span>
                            <GColorButton palette={p.id} type="vote-action" label="VOTE FOR DIANA" />
                        </div>
                    ))}
                </div>

                {/* Contrast analysis */}
                <div className="mt-10 p-5 rounded-md border border-white/10 bg-black/30 backdrop-blur-sm">
                    <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Разбор по контрасту с нуар-фоном</h3>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 text-[10px] leading-relaxed">
                        <div>
                            <span className="text-[#C5A059] font-semibold">G1 Warm Gold:</span>
                            <span className="text-white/40"> Тёплый amber конкурирует с общим warm-tone фона. Похоже на деревяшку в туманном городе.</span>
                        </div>
                        <div>
                            <span className="text-[#A08850] font-semibold">G2 Dusty Gold:</span>
                            <span className="text-white/40"> Состаренная бронза — более нейтральна. Опасность: может быть слишком тихой, потеряется.</span>
                        </div>
                        <div>
                            <span className="text-[#8090B0] font-semibold">G3 Slate Silver:</span>
                            <span className="text-white/40"> Холодный, перекликается с туманом. Но danger-кнопка теряет crimson-характер. Риск: слишком нейтральный.</span>
                        </div>
                        <div>
                            <span className="text-[#D4BE80] font-semibold">G4 Frost Gold ⭐:</span>
                            <span className="text-white/40"> Холодный фон (перекликается с туманом) + тёплый gold текст (контраст). Лучший баланс для нуара.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Test standalone timers from DayPhase
const TimersShowcaseTest: React.FC = () => {
    return (
        <div className="w-[500px] flex flex-col gap-6 bg-[#050505] p-8 rounded-xl border border-white/5 relative shadow-2xl">
            {/* Background texture to simulate game view */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url(/assets/noise.png)', backgroundRepeat: 'repeat' }} />
            
            <h2 className="text-xl font-['Cinzel'] text-[#916A47] text-center mb-2 z-10">Neo-Noir Timer States</h2>
            
            <div className="z-10 flex flex-col gap-6">
                {/* Discussion Timer (Normal) */}
                <div>
                    <h3 className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-2">1. Discussion / Standard Mode</h3>
                    <div className="w-full py-2 text-center bg-[#0A0A0A] rounded-md border border-[#916A47]/30 shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
                        <div className="flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4 text-[#916A47]" />
                            <span className="text-2xl font-bold text-white tabular-nums">
                                0:45
                            </span>
                            <span className="text-[#916A47] text-[10px] uppercase font-bold tracking-widest ml-2">
                                Player Speaking
                            </span>
                        </div>
                    </div>
                </div>

                {/* Urgent Timer (<10s) */}
                <div>
                    <h3 className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-2">2. Last 10 Seconds (Urgent Mode)</h3>
                    <div className="w-full py-2 text-center rounded-md border transition-colors duration-500 shadow-[0_5px_15px_rgba(0,0,0,0.8)] bg-[#0A0A0A] border-[#916A47]/40 ring-1 ring-[#916A47]/20 relative overflow-hidden">
                        <div className="flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4 text-[#916A47] animate-pulse" />
                            <span className="text-2xl font-bold tabular-nums text-[#916A47] animate-pulse drop-shadow-[0_0_8px_rgba(145,106,71,0.5)]">
                                0:05
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-widest ml-2 text-[#916A47]">
                                Voting Time
                            </span>
                        </div>
                    </div>
                </div>

                {/* Hard Wait (AFK Wait) */}
                <div>
                    <h3 className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-2">3. Waiting for AFK (Hard Wait)</h3>
                    <div className="w-full py-2 text-center rounded-md border transition-colors duration-500 shadow-[0_5px_15px_rgba(0,0,0,0.8)] bg-[#0A0A0A] border-[#916A47]/30">
                        <div className="flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4 text-[#916A47]" />
                            <span className="text-2xl font-bold tabular-nums text-white/70 animate-pulse">
                                1:20
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-widest ml-2 text-[#916A47]">
                                Waiting for AFK
                            </span>
                        </div>
                        <div className="text-[10px] text-white/30 font-mono mt-1 pt-1 border-t border-white/5 animate-pulse uppercase tracking-widest mx-4">
                            Some players are AFK...
                        </div>
                    </div>
                </div>

                {/* Night Transition */}
                <div>
                    <h3 className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-2">4. Night Transition (Results Delay)</h3>
                    <div className="w-full py-2 text-center bg-[#0A0A0A] rounded-md border border-[#916A47]/30 shadow-[0_5px_15px_rgba(0,0,0,0.8)]">
                        <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center justify-center gap-2">
                                <Clock className="w-4 h-4 text-[#916A47]" />
                                <span className="text-2xl font-bold text-white tabular-nums">
                                    5s
                                </span>
                                <span className="text-[#916A47] text-[10px] uppercase font-bold tracking-widest ml-2">
                                    Voting Results
                                </span>
                            </div>
                            <div className="text-[10px] text-white/30 font-mono mt-1 pt-1 border-t border-[#916A47]/30 animate-pulse uppercase tracking-widest px-4">
                                Review the logs above...
                            </div>
                        </div>
                    </div>
                </div>
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
        { name: '🎨 Button Concepts', group: 'UI', component: <ButtonShowcaseTest /> },
        { name: '🖌️ G Color Variants', group: 'UI', component: <ButtonColorShowcaseTest /> },
        { name: '⏱️ Timer States', group: 'UI', component: <TimersShowcaseTest /> },
        { name: 'Button', group: 'UI', component: <Button onClick={() => alert('Clicked')}>Test Button</Button> },
        { name: 'Input', group: 'UI', component: <Input placeholder="Test Input" onChange={(e) => console.log(e.target.value)} /> },
        { name: 'BackButton', group: 'UI', component: <BackButton /> },

        // Game Components
        { name: 'PlayerCard', group: 'Game Components', component: <div className="w-60"><PlayerCard player={mockPlayer as any} isMe={false} onAction={() => { }} canAct={true} actionLabel="VOTE" /></div> },

        { name: 'SystemLog', group: 'Game Components', component: <div className="h-60"><SystemLog logs={mockLogs as any} /></div> },
        { name: 'VotingAnnouncement', group: 'Game Components', component: <VotingAnnouncementWrapper /> },
        { name: 'NightAnnouncement', group: 'Game Components', component: <NightAnnouncementWrapper /> },
        { name: 'Role Composition', group: 'Game Components', component: <RoleCompositionAnnouncementWrapper /> },
        { name: 'Mafia Chat', group: 'Game Components', component: <MafiaChatTestWrapper /> },
        { name: 'Mafia Consensus', group: 'Game Components', component: <MafiaConsensusTestWrapper /> },
        { name: 'Mic Button', group: 'Game Components', component: <MicButtonTestWrapper /> },
        { name: 'Discussion Chat', group: 'Game Components', component: <DiscussionChatTestWrapper /> },

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
        { name: 'Voting Visualization', group: 'Game Phases', component: <VotingVisualizationTestWrapper /> },
        { name: 'Voting Results', group: 'Game Phases', component: <PostVotingTransitionTestWrapper /> },
        { name: 'Game Feed Simulation', group: 'Game Phases', component: <GameFeedSimulationTest /> },
        { name: 'Game Feed (Isolated)', group: 'Game Components', component: <GameFeedTestWrapper /> },

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
        { name: 'Layout Preview', group: 'Game Phases', component: <LayoutPreviewTestWrapper /> },
        { name: 'Speech Warning Glow', group: 'Game Components', component: <SpeechWarningGlowTestWrapper /> },
        { name: 'Game Hints', group: 'Game Components', component: <GameHintsTestWrapper /> },

        // Test Test
        { name: 'Session Key', group: 'Test Test', component: <SessionKeyTestWrapper /> },
        { name: 'Active Phase + Banner', group: 'Test Test', component: <ActivePhaseSessionTestWrapper /> },
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
        <div className="flex h-screen w-full bg-black text-white relative z-[200]">
            {/* Sidebar */}
            <div className="w-64 border-r border-green-500/20 flex flex-col h-full bg-gray-900/90 backdrop-blur-md relative z-[201]">
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
            <div className="flex-1 flex flex-col h-full overflow-hidden relative z-[200]">
                {renderSelected()}
            </div>
        </div>
    );
};

export default TestPage;
