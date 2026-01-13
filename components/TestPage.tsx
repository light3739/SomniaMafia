import React, { useState } from 'react';
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
import { GamePhase, Role } from '../types';
import { VotingAnnouncement } from './game/VotingAnnouncement';
import { NightAnnouncement } from './game/NightAnnouncement';

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

// Mock Props
const mockPlayer = {
    id: '1',
    name: 'Test Player',
    role: 'Mafia',
    isAlive: true,
    avatarUrl: 'https://placehold.co/80x80',
    address: '0x1234567890abcdef',
    votesReceived: 0,
    status: 'connected'
};

const mockPlayers = [
    { id: '1', name: 'Player 1', role: 'Villager', isAlive: true, address: '0x1111...1111', avatarUrl: '', votesReceived: 0, status: 'connected' },
    { id: '2', name: 'Player 2', role: 'Mafia', isAlive: true, address: '0x2222...2222', avatarUrl: '', votesReceived: 0, status: 'connected' },
    { id: '3', name: 'Player 3', role: 'Doctor', isAlive: false, address: '0x3333...3333', avatarUrl: '', votesReceived: 0, status: 'offline' },
];

const mockLogs = [
    { id: '1', message: 'Game started', type: 'system', timestamp: Date.now() },
    { id: '2', message: 'Player 1 was killed', type: 'error', timestamp: Date.now() }
];

type ComponentEntry = {
    name: string;
    group: string;
    component: React.ReactNode;
};

export const TestPage: React.FC = () => {
    const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

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

        // Pages
        { name: 'MainPage', group: 'Pages', component: <MainPage onStart={() => console.log('Start')} /> },
        { name: 'SetupProfile', group: 'Pages', component: <SetupProfile /> },
        { name: 'CreateLobby', group: 'Pages', component: <CreateLobby /> },
        { name: 'JoinLobby', group: 'Pages', component: <JoinLobby /> },
        { name: 'WaitingRoom', group: 'Pages', component: <WaitingRoom /> },
        { name: 'GameLayout', group: 'Pages', component: <GameLayout /> },
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
                <div className="border border-gray-700 p-4 rounded-lg bg-black/50 min-h-[500px] flex items-center justify-center relative">
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
