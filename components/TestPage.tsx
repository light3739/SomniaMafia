import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { BackButton } from './ui/BackButton';
import { PlayerCard } from './PlayerCard';
import { GameControls } from './GameControls';
import { SystemLog } from './Narrator';
import { MainPage } from './MainPage';
import { SetupProfile } from './lobby_flow/SetupProfile';
import { CreateLobby } from './lobby_flow/CreateLobby';
import { JoinLobby } from './lobby_flow/JoinLobby';
import { WaitingRoom } from './lobby_flow/WaitingRoom';
import { GameLayout } from './game/GameLayout';
import { GamePhase, Role, Player, MafiaChatMessage } from '../types';
import { VotingAnnouncement } from './game/VotingAnnouncement';
import { NightAnnouncement } from './game/NightAnnouncement';
import { MafiaChat } from './game/MafiaChat';
import { useGameContext } from '../contexts/GameContext';

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
        { name: 'GameControls', group: 'Game Components', component: <GameControls phase={GamePhase.DAY} myRole={Role.CIVILIAN} dayCount={1} onNextPhase={() => console.log('next phase')} /> },
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
        { name: 'GameLayout (Raw)', group: 'Pages', component: <GameLayout /> },
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
