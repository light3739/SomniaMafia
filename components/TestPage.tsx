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
import { PostVotingTransition } from './game/PostVotingTransition';
import { NightAnnouncement } from './game/NightAnnouncement';
import { MafiaChat } from './game/MafiaChat';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../contexts/GameContext';
import { Skull, Shield, Search, Users, EyeOff, Mic, MicOff, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { MicButton } from './game/MicButton';

import { useSoundEffects } from './ui/SoundEffects';
import { Lanyard } from './ui/Lanyard';

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
        setGameState({
            phase: GamePhase.DAY,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: players,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Day 1 begins!', type: 'phase' },
                { id: '2', timestamp: '12:00:05', message: 'Discussion phase started.', type: 'info' }
            ],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 120,
            winner: null,
            mafiaMessages: []
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

        setGameState({
            phase: GamePhase.VOTING,
            dayCount: 1,
            myPlayerId: TEST_ADDRESS,
            players: players,
            logs: [
                { id: '1', timestamp: '12:00:00', message: 'Voting Visualization Test', type: 'phase' }
            ],
            revealedCount: 0,
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: Math.floor(Date.now() / 1000) + 600,
            winner: null,
            mafiaMessages: []
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

// Wrapper for testing PostVotingTransition (Voting Results screen)
const PostVotingTransitionTestWrapper: React.FC = () => {
    const { setGameState, addLog } = useGameContext();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Set up mock game state with some logs to display
        setGameState({
            phase: GamePhase.VOTING,
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
            mafiaCommittedCount: 0,
            mafiaRevealedCount: 0,
            phaseDeadline: 0,
            winner: null,
            mafiaMessages: []
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
                                <h3 className="text-2xl text-white font-['Playfair_Display'] mb-2">
                                    {revealPhase === 'revealing' ? 'Decrypting...' : 'Encrypted Data'}
                                </h3>
                                <p className="text-white/40 text-sm">
                                    {revealPhase === 'revealing' ? 'Verifying on-chain...' : 'Waiting for keys...'}
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="revealed"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 -top-40 w-full h-[800px] flex items-center justify-center pointer-events-none"
                            >
                                <div className="w-full h-full pointer-events-auto">
                                    <Lanyard wireLength={180}>
                                        <div
                                            className={`bg-gradient-to-br ${config.bgColor} backdrop-blur-xl rounded-3xl border border-white/20 p-12 shadow-2xl flex flex-col justify-between w-[400px] h-[400px] cursor-grab active:cursor-grabbing select-none`}
                                            onPointerDown={(e) => e.stopPropagation()}
                                        >
                                            <div className="text-center flex-1 flex flex-col justify-center pointer-events-none">
                                                {/* Role Name */}
                                                <h2
                                                    className={`text-5xl font-['Playfair_Display'] mb-6 ${config.color}`}
                                                >
                                                    {selectedRole}
                                                </h2>

                                                {/* Description */}
                                                <p
                                                    className="text-white/60 text-sm max-w-xs mx-auto"
                                                >
                                                    {config.description}
                                                </p>
                                            </div>

                                            <div className="space-y-3 mt-6 pointer-events-auto">
                                                {/* Confirm Button Mock */}
                                                <button
                                                    className="w-full px-6 py-3 bg-gradient-to-r from-[#916A47] to-[#7a5a3c] text-white rounded-xl font-medium hover:from-[#a67b52] hover:to-[#916A47] transition-all shadow-lg"
                                                >
                                                    I Understand My Role ({countdown})
                                                </button>

                                                <div className="text-xs text-white/30 text-center">
                                                    Display closes in {countdown}s
                                                </div>
                                            </div>
                                        </div>
                                    </Lanyard>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )
            }
        </div >
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
    const [messages, setMessages] = useState<{ id: string; sender: string; senderAddress: string; content: string; timestamp: number }[]>([
        { id: '1', sender: 'Alice', senderAddress: '0x1111', content: 'Я думаю это Bob, потому что он молчит', timestamp: Date.now() - 30000 },
        { id: '2', sender: 'Charlie', senderAddress: '0x2222', content: 'Согласен, Bob подозрителен', timestamp: Date.now() - 20000 },
        { id: '3', sender: 'Bob', senderAddress: '0x3333', content: 'Я не мафия! Посмотрите на Dave!', timestamp: Date.now() - 10000 },
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
        { name: 'Speech Warning Glow', group: 'Game Components', component: <SpeechWarningGlowTestWrapper /> },
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
