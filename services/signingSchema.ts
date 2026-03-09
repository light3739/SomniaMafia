export type DiscussionActionType = 'start' | 'skip';
export type NightActionType = 'kill' | 'heal' | 'check';

export function buildAvatarMessage(input: {
  roomId: string;
  address: string;
  nonce: string;
  timestamp: number;
}): string {
  return `avatar:${input.roomId}:${input.address.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildNightActionMessage(input: {
  roomId: string;
  dayCount: number;
  actionType: NightActionType;
  targetAddress: string;
  nonce: string;
  timestamp: number;
}): string {
  return `night:${input.roomId}:${input.dayCount}:${input.actionType}:${input.targetAddress.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildResolveNightMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
}): string {
  return `resolve-night:${input.roomId}:${input.nonce}:${input.timestamp}`;
}

export function buildDiscussionMessage(input: {
  roomId: string;
  dayCount: number;
  action: DiscussionActionType;
  nonce: string;
  timestamp: number;
}): string {
  return `discussion:${input.roomId}:${input.dayCount}:${input.action}:${input.nonce}:${input.timestamp}`;
}

export function buildTokenMessage(input: {
  room: string;
  username: string;
  playerAddress: string;
  nonce: string;
  timestamp: number;
}): string {
  return `token:${input.room}:${input.username}:${input.playerAddress.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildInvestigateMessage(input: {
  roomId: string;
  dayCount: number;
  targetAddress: string;
  nonce: string;
  timestamp: number;
}): string {
  return `investigate:${input.roomId}:${input.dayCount}:${input.targetAddress.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildRoleSyncMessage(input: {
  roomId: string;
  txHash: string;
  nonce: string;
  timestamp: number;
}): string {
  return `sync-role-commit:${input.roomId}:${input.txHash.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}
