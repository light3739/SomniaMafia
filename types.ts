export enum Role {
  CIVILIAN = 'CIVILIAN',
  MAFIA = 'MAFIA',
  DETECTIVE = 'DETECTIVE',
  DOCTOR = 'DOCTOR',
  UNKNOWN = 'UNKNOWN' // For other players
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  ROLE_REVEAL = 'ROLE_REVEAL',
  NIGHT = 'NIGHT',
  DAY = 'DAY',
  VOTING = 'VOTING',
  GAME_OVER = 'GAME_OVER',
  SHUFFLING = "SHUFFLING"
}

export type ConnectionStatus = 'connected' | 'syncing' | 'offline' | 'slashed';

export interface Player {
  id: string;
  name: string;
  address: string; // Wallet address
  role: Role; // In a real app, this is hidden for others!
  isAlive: boolean;
  avatarUrl: string;
  votesReceived: number;
  status: ConnectionStatus;
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
  winner: 'MAFIA' | 'CIVILIANS' | null;
}

// For Framer Motion variants
export const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9 }
};