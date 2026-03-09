/**
 * redis.ts
 *
 * Optional Redis persistence layer for GM server state.
 * Falls back gracefully to in-memory if REDIS_URL is unavailable.
 *
 * Key namespace:
 *   gm:room:{roomId}:pubkey:{addr}   → ECIES pubkey string
 *   gm:room:{roomId}:srakey:{addr}   → SRA decryption key string
 *   gm:room:{roomId}:role:{addr}     → resolved role string
 *   gm:room:{roomId}:proof:{addr}    → JSON InvestigationProof
 *   gm:room:{roomId}:night           → JSON serialized RoomNightState
 *
 * TTL: 48h — enough for a long tournament session.
 */
import Redis from 'ioredis';
import type { RoomNightState } from './game-state.js';
export type RedisClient = Redis | null;
export declare function getRedis(): RedisClient;
export declare function connectRedis(): Promise<void>;
export declare function rPersistPubkey(redis: RedisClient, roomId: string, addr: string, pubkey: string): void;
export declare function rPersistSraKey(redis: RedisClient, roomId: string, addr: string, key: string): void;
export declare function rPersistRole(redis: RedisClient, roomId: string, addr: string, role: string): void;
export interface PersistedProof {
    targetAddress: string;
    timestamp: number;
}
export declare function rPersistProof(redis: RedisClient, roomId: string, detective: string, proof: PersistedProof): void;
export declare function rPersistNightState(redis: RedisClient, roomId: string, state: RoomNightState): void;
export declare function rDeleteNightState(redis: RedisClient, roomId: string): void;
export interface StateContainers {
    eciesPubkeys: Map<string, Map<string, string>>;
    sraSKeys: Map<string, Map<string, string>>;
    resolvedRoles: Map<string, Map<string, string>>;
    investigationProofs: Map<string, Map<string, any>>;
    injectNight: (roomId: bigint, state: RoomNightState) => void;
}
export declare function loadAllState(redis: Redis, containers: StateContainers): Promise<void>;
