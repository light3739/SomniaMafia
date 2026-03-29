export type DiscussionActionType = 'start' | 'skip';
export type NightActionType = 'kill' | 'heal' | 'check';

export function buildAvatarMessage(input: {
  roomId: string;
  address: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `avatar:${input.chainId || 43113}:${input.roomId}:${input.address.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildRegisterPubkeyMessage(input: {
  roomId: string;
  address: string;
  pubkey: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `register-pubkey:${input.chainId || 43113}:${input.roomId}:${input.address.toLowerCase()}:${input.pubkey}:${input.nonce}:${input.timestamp}`;
}

export function buildNightActionMessage(input: {
  roomId: string;
  dayCount: number;
  actionType: NightActionType;
  targetAddress: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `night:${input.chainId || 43113}:${input.roomId}:${input.dayCount}:${input.actionType}:${input.targetAddress.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildResolveNightMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `resolve-night:${input.chainId || 43113}:${input.roomId}:${input.nonce}:${input.timestamp}`;
}

export function buildDiscussionMessage(input: {
  roomId: string;
  dayCount: number;
  action: DiscussionActionType;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `discussion:${input.chainId || 43113}:${input.roomId}:${input.dayCount}:${input.action}:${input.nonce}:${input.timestamp}`;
}

export function buildTokenMessage(input: {
  room: string;
  username: string;
  playerAddress: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `token:${input.chainId || 43113}:${input.room}:${input.username}:${input.playerAddress.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildInvestigateMessage(input: {
  roomId: string;
  dayCount: number;
  targetAddress: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `investigate:${input.chainId || 43113}:${input.roomId}:${input.dayCount}:${input.targetAddress.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildRoleSyncMessage(input: {
  roomId: string;
  txHash: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `sync-role-commit:${input.chainId || 43113}:${input.roomId}:${input.txHash.toLowerCase()}:${input.nonce}:${input.timestamp}`;
}

export function buildTeammatesMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `teammates:${input.chainId || 43113}:${input.roomId}:${input.nonce}:${input.timestamp}`;
}
export function buildMafiaMembersMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `mafia-members:${input.chainId || 43113}:${input.roomId}:${input.nonce}:${input.timestamp}`;
}
