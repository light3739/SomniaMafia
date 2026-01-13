import { Player, Role, ConnectionStatus } from '../types';

export const MOCK_LOBBIES = [
    { id: 1, name: "Chill Mafia Game", players: 12, max: 16 },
    { id: 2, name: "Experts Only", players: 15, max: 16 },
    { id: 3, name: "Fast Game", players: 4, max: 16 },
    { id: 4, name: "Midnight Club", players: 8, max: 16 },
];

export const MOCK_PLAYERS: Player[] = Array.from({ length: 8 }).map((_, i) => ({
    id: `p-${i}`,
    name: `Player ${i + 1}`,
    address: `0x${Math.random().toString(16).slice(2, 42)}`,
    role: Role.CIVILIAN, // Will be shuffled
    isAlive: true,
    avatarUrl: `https://picsum.photos/seed/${i + 200}/200`,
    votesReceived: 0,
    status: 'connected' as ConnectionStatus,
    hasConfirmedRole: false
}));

export const generateMockPlayers = (count: number, hostName: string): { name: string; address: string }[] => {
    return Array(count).fill(null).map((_, i) => ({
        name: i === 0 ? (hostName || 'Host') : 'Haiman',
        address: `0x9c...${Math.floor(Math.random() * 1000).toString(16)}`
    }));
};
