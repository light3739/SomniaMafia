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
  actionType: NightActionType;
  targetAddress: string;
  dayCount: number;
  nonce: string;
  timestamp: number;
}): string {
  return `night:${input.roomId}:${input.dayCount}:${input.actionType}:${input.targetAddress}:${input.nonce}:${input.timestamp}`;
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
