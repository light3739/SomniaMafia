export type DiscussionActionType = 'start' | 'skip';
export type NightActionType = 'kill' | 'heal' | 'check';

export function buildAvatarMessage(input: {
  roomId: string;
  address: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `avatar:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.address.toLowerCase()}:${input.nonce}:${String(input.timestamp)}`;
}

export function buildRegisterPubkeyMessage(input: {
  roomId: string;
  address: string;
  pubkey: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `register-pubkey:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.address.toLowerCase()}:${input.pubkey}:${input.nonce}:${String(input.timestamp)}`;
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
  return `night:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.dayCount}:${input.actionType}:${input.targetAddress.toLowerCase()}:${input.nonce}:${String(input.timestamp)}`;
}

export function buildResolveNightMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `resolve-night:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.nonce}:${String(input.timestamp)}`;
}

export function buildDiscussionMessage(input: {
  roomId: string;
  dayCount: number;
  action: DiscussionActionType;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `discussion:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.dayCount}:${input.action}:${input.nonce}:${String(input.timestamp)}`;
}

export function buildTokenMessage(input: {
  room: string;
  username: string;
  playerAddress: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `token:${String(input.chainId || 43113)}:${String(input.room)}:${input.username}:${input.playerAddress.toLowerCase()}:${input.nonce}:${String(input.timestamp)}`;
}

export function buildInvestigateMessage(input: {
  roomId: string;
  dayCount: number;
  targetAddress: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `investigate:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.dayCount}:${input.targetAddress.toLowerCase()}:${input.nonce}:${String(input.timestamp)}`;
}

export function buildRoleSyncMessage(input: {
  roomId: string;
  txHash: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `sync-role-commit:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.txHash.toLowerCase()}:${input.nonce}:${String(input.timestamp)}`;
}

export function buildTeammatesMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `teammates:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.nonce}:${String(input.timestamp)}`;
}
export function buildMafiaMembersMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return `mafia-members:${String(input.chainId || 43113)}:${String(input.roomId)}:${input.nonce}:${String(input.timestamp)}`;
}
