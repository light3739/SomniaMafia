export enum Role {
  CIVILIAN = 'CIVILIAN',
  MAFIA = 'MAFIA',
  DETECTIVE = 'DETECTIVE',
  DOCTOR = 'DOCTOR',
  MANIAC = 'MANIAC',   // Solo killer - wins alone
  UNKNOWN = 'UNKNOWN'  // For other players
}

// Должен соответствовать контракту: LOBBY=0, SHUFFLING=1, REVEAL=2, DAY=3, VOTING=4, NIGHT=5, ENDED=6
export enum GamePhase {
  LOBBY = 0,
  SHUFFLING = 1,
  REVEAL = 2,
  DAY = 3,
  VOTING = 4,    // FIX: was incorrectly 5
  NIGHT = 5,     // FIX: was incorrectly 4
  ENDED = 6
}

// Маппинг для UI
export const GamePhaseLabels: Record<GamePhase, string> = {
  [GamePhase.LOBBY]: 'Lobby',
  [GamePhase.SHUFFLING]: 'Shuffling Deck',
  [GamePhase.REVEAL]: 'Role Reveal',
  [GamePhase.DAY]: 'Day Discussion',
  [GamePhase.NIGHT]: 'Night',
  [GamePhase.VOTING]: 'Voting',
  [GamePhase.ENDED]: 'Game Over'
};

export type ConnectionStatus = 'connected' | 'syncing' | 'offline' | 'slashed';

export interface Player {
  id: string;
  name: string;
  address: string; // Wallet address
  role: Role; // In a real app, this is hidden for others!
  isAlive: boolean; // Это будет мапиться на isActive из контракта
  avatarUrl: string;
  votesReceived: number;
  status: ConnectionStatus; // Для UI (connected/offline)
  hasConfirmedRole: boolean; // Новое поле
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'danger' | 'success' | 'phase' | 'warning';
}

export interface GameState {
  phase: GamePhase;
  dayCount: number;
  players: Player[];
  myPlayerId: string | null;
  logs: LogEntry[];
  winner: 'MAFIA' | 'MANIAC' | 'TOWN' | null;
}

// For Framer Motion variants
export const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9 }
};