import { SignatureBuilder } from './SignatureBuilder';

export type DiscussionActionType = 'start' | 'skip';
export type NightActionType = 'kill' | 'heal' | 'check';

export function buildAvatarMessage(input: {
  roomId: string;
  address: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('avatar', input.chainId, input.roomId)
    .withAddress(input.address)
    .withModern(input.nonce, input.timestamp)
    .build();
}

export function buildRegisterPubkeyMessage(input: {
  roomId: string;
  address: string;
  pubkey: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('register-pubkey', input.chainId, input.roomId)
    .withAddress(input.address)
    .withParam(input.pubkey)
    .withModern(input.nonce, input.timestamp)
    .build();
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
  return new SignatureBuilder('night', input.chainId, input.roomId)
    .withParam(input.dayCount)
    .withParam(input.actionType)
    .withAddress(input.targetAddress)
    .withModern(input.nonce, input.timestamp)
    .build();
}

export function buildResolveNightMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('resolve-night', input.chainId, input.roomId)
    .withModern(input.nonce, input.timestamp)
    .build();
}

export function buildDiscussionMessage(input: {
  roomId: string;
  dayCount: number;
  action: DiscussionActionType;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('discussion', input.chainId, input.roomId)
    .withParam(input.dayCount)
    .withParam(input.action)
    .withModern(input.nonce, input.timestamp)
    .build();
}

export function buildTokenMessage(input: {
  room: string;
  username: string;
  playerAddress: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('token', input.chainId, input.room)
    .withParam(input.username)
    .withAddress(input.playerAddress)
    .withModern(input.nonce, input.timestamp)
    .build();
}

export function buildInvestigateMessage(input: {
  roomId: string;
  dayCount: number;
  targetAddress: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('investigate', input.chainId, input.roomId)
    .withParam(input.dayCount)
    .withAddress(input.targetAddress)
    .withModern(input.nonce, input.timestamp)
    .build();
}

export function buildRoleSyncMessage(input: {
  roomId: string;
  txHash: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('sync-role-commit', input.chainId, input.roomId)
    .withAddress(input.txHash)
    .withModern(input.nonce, input.timestamp)
    .build();
}

export function buildTeammatesMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('teammates', input.chainId, input.roomId)
    .withModern(input.nonce, input.timestamp)
    .build();
}

export function buildMafiaMembersMessage(input: {
  roomId: string;
  nonce: string;
  timestamp: number;
  chainId?: number | string;
}): string {
  return new SignatureBuilder('mafia-members', input.chainId, input.roomId)
    .withModern(input.nonce, input.timestamp)
    .build();
}
