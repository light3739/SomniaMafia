import { Player, Role, ConnectionStatus } from '../types';

export const MOCK_LOBBIES = [
    { id: 1, name: "Chill Mafia Game", players: 12, max: 16 },
    { id: 2, name: "Experts Only", players: 15, max: 16 },
    { id: 3, name: "Fast Game", players: 4, max: 16 },
    { id: 4, name: "Midnight Club", players: 8, max: 16 },
];

export const MOCK_PLAYERS: Player[] = [
    { id: 'p-0', name: 'Player 1', address: '0x1111111111111111111111111111111111111111', role: Role.CIVILIAN, isAlive: true, avatarUrl: 'https://picsum.photos/seed/200/200', votesReceived: 0, status: 'connected' as ConnectionStatus, hasConfirmedRole: false, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    { id: 'p-1', name: 'Player 2', address: '0x2222222222222222222222222222222222222222', role: Role.CIVILIAN, isAlive: true, avatarUrl: 'https://picsum.photos/seed/201/200', votesReceived: 0, status: 'connected' as ConnectionStatus, hasConfirmedRole: false, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    { id: 'p-2', name: 'Player 3', address: '0x3333333333333333333333333333333333333333', role: Role.CIVILIAN, isAlive: true, avatarUrl: 'https://picsum.photos/seed/202/200', votesReceived: 0, status: 'connected' as ConnectionStatus, hasConfirmedRole: false, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    { id: 'p-3', name: 'Player 4', address: '0x4444444444444444444444444444444444444444', role: Role.CIVILIAN, isAlive: true, avatarUrl: 'https://picsum.photos/seed/203/200', votesReceived: 0, status: 'connected' as ConnectionStatus, hasConfirmedRole: false, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    { id: 'p-4', name: 'Player 5', address: '0x5555555555555555555555555555555555555555', role: Role.CIVILIAN, isAlive: true, avatarUrl: 'https://picsum.photos/seed/204/200', votesReceived: 0, status: 'connected' as ConnectionStatus, hasConfirmedRole: false, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    { id: 'p-5', name: 'Player 6', address: '0x6666666666666666666666666666666666666666', role: Role.CIVILIAN, isAlive: true, avatarUrl: 'https://picsum.photos/seed/205/200', votesReceived: 0, status: 'connected' as ConnectionStatus, hasConfirmedRole: false, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    { id: 'p-6', name: 'Player 7', address: '0x7777777777777777777777777777777777777777', role: Role.CIVILIAN, isAlive: true, avatarUrl: 'https://picsum.photos/seed/206/200', votesReceived: 0, status: 'connected' as ConnectionStatus, hasConfirmedRole: false, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
    { id: 'p-7', name: 'Player 8', address: '0x8888888888888888888888888888888888888888', role: Role.CIVILIAN, isAlive: true, avatarUrl: 'https://picsum.photos/seed/207/200', votesReceived: 0, status: 'connected' as ConnectionStatus, hasConfirmedRole: false, hasDeckCommitted: false, hasVoted: false, hasNightCommitted: false, hasNightRevealed: false },
];

export const generateMockPlayers = (count: number, hostName: string): { name: string; address: string }[] => {
    return Array(count).fill(null).map((_, i) => ({
        name: i === 0 ? (hostName || 'Host') : 'Haiman',
        address: `0x9c...${Math.floor(Math.random() * 1000).toString(16)}`
    }));
};
