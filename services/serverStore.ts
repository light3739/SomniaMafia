import Redis from 'ioredis';

/**
 * Standard Redis client (works with RedisLabs, Upstash, etc. via connection string)
 */
const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : null;

if (redis) {
    redis.on('error', (err) => console.error('[ServerStore] Redis Connection Error:', err));
}

/**
 * Memory Fallback (for local development without Redis)
 */
const memoryStore: Record<string, Record<string, string>> = {};

/**
 * Global expiration for game data (24 hours)
 */
const GAME_DATA_TTL = 86400;

export interface PlayerSecret {
    role: number;
    salt: string;
}

/**
 * ServerStore: Secure storage for player secrets using Redis.
 * This ensures win-conditions can be checked even if players go offline.
 */
export class ServerStore {
    /**
     * Stores a player's role and salt in Redis.
     * Uses a Hash structure: room:secrets:{roomId} -> {address: secret}
     */
    static async storeSecret(roomId: string, address: string, role: number, salt: string) {
        const normalizedRoomId = BigInt(roomId).toString();
        const secret: PlayerSecret = { role, salt };
        const key = `room:secrets:${normalizedRoomId}`;

        if (!redis) {
            console.warn(`[ServerStore] Redis not configured. Using MEMORY fallback for Room #${roomId}`);
            if (!memoryStore[key]) memoryStore[key] = {};
            memoryStore[key][address.toLowerCase()] = JSON.stringify(secret);
            return;
        }

        try {
            // hset expects string value for ioredis if passing record
            await redis.hset(key, address.toLowerCase(), JSON.stringify(secret));
            // Set/Refresh expiration so abandoned games get cleaned up
            await redis.expire(key, GAME_DATA_TTL);

            console.log(`[ServerStore] Redis: Stored secret for Room #${roomId}, Player ${address}`);
        } catch (e) {
            console.error("[ServerStore] Redis error (store):", e);
        }
    }

    /**
     * Retrieves all secrets for a specific room.
     */
    static async getRoomSecrets(roomId: string): Promise<Record<string, PlayerSecret> | null> {
        const normalizedRoomId = BigInt(roomId).toString();
        const key = `room:secrets:${normalizedRoomId}`;

        if (!redis) {
            const data = memoryStore[key];
            if (!data) return null;

            const parsed: Record<string, PlayerSecret> = {};
            for (const [addr, secretStr] of Object.entries(data)) {
                parsed[addr] = JSON.parse(secretStr);
            }
            return parsed;
        }

        try {
            const data = await redis.hgetall(key);
            if (!data || Object.keys(data).length === 0) return null;

            // Parse JSON strings back to PlayerSecret objects
            const parsed: Record<string, PlayerSecret> = {};
            for (const [addr, secretStr] of Object.entries(data)) {
                parsed[addr] = JSON.parse(secretStr);
            }
            return parsed;
        } catch (e) {
            console.error("[ServerStore] Redis error (get):", e);
            return null;
        }
    }

    /**
     * Manually clears room data (optional cleanup).
     */
    static async clearRoom(roomId: string) {
        const normalizedRoomId = BigInt(roomId).toString();
        const key = `room:secrets:${normalizedRoomId}`;
        if (!redis) {
            delete memoryStore[key];
            return;
        }
        try {
            await redis.del(key);
            console.log(`[ServerStore] Redis: Cleared Room #${roomId}`);
        } catch (e) {
            console.error("[ServerStore] Redis error (clear):", e);
        }
    }

    // ============ DISCUSSION STATE ============

    /**
     * Get the current discussion state for a room and day.
     */
    static async getDiscussionState(roomId: string, dayCount: number): Promise<DiscussionState | null> {
        const normalizedRoomId = BigInt(roomId).toString();
        const key = `room:discussion:${normalizedRoomId}:${dayCount}`;

        if (!redis) {
            const data = memoryStore[key];
            if (!data || !data['state']) return null;
            return JSON.parse(data['state']);
        }

        try {
            const data = await redis.get(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch (e) {
            console.error("[ServerStore] Redis error (getDiscussion):", e);
            return null;
        }
    }

    /**
     * Set the discussion state for a room and day.
     */
    static async setDiscussionState(roomId: string, dayCount: number, state: DiscussionState) {
        const normalizedRoomId = BigInt(roomId).toString();
        const key = `room:discussion:${normalizedRoomId}:${dayCount}`;

        if (!redis) {
            if (!memoryStore[key]) memoryStore[key] = {};
            memoryStore[key]['state'] = JSON.stringify(state);
            return;
        }

        try {
            await redis.set(key, JSON.stringify(state), 'EX', GAME_DATA_TTL);
        } catch (e) {
            console.error("[ServerStore] Redis error (setDiscussion):", e);
        }
    }

    /**
     * Advance discussion state. Handles transitions between phases.
     * Flow: initial_delay -> speaking -> between_delay -> speaking -> ... -> final_delay -> finished
     */
    static async advanceSpeaker(roomId: string, dayCount: number, totalAlivePlayers: number): Promise<DiscussionState | null> {
        const state = await this.getDiscussionState(roomId, dayCount);
        if (!state || state.finished) return state;

        const DELAY_BETWEEN_SPEAKERS = 5; // seconds
        const DELAY_BEFORE_VOTING = 3; // seconds

        // Handle different phase transitions
        if (state.phase === 'initial_delay' || state.phase === 'between_delay') {
            // Delay finished -> start speaking
            const newState: DiscussionState = {
                currentSpeakerIndex: state.currentSpeakerIndex,
                speakerStartTime: Date.now(),
                speakerDuration: state.speakerDuration,
                finished: false,
                phase: 'speaking'
            };
            await this.setDiscussionState(roomId, dayCount, newState);
            return newState;
        }

        if (state.phase === 'speaking') {
            // Speaker finished -> check if more speakers
            const nextIndex = state.currentSpeakerIndex + 1;

            if (nextIndex >= totalAlivePlayers) {
                // Last speaker finished -> go to final_delay before voting
                const finalDelayState: DiscussionState = {
                    currentSpeakerIndex: state.currentSpeakerIndex,
                    speakerStartTime: state.speakerStartTime,
                    speakerDuration: state.speakerDuration,
                    finished: false,
                    phase: 'final_delay',
                    delayStartTime: Date.now(),
                    delayDuration: DELAY_BEFORE_VOTING
                };
                await this.setDiscussionState(roomId, dayCount, finalDelayState);
                return finalDelayState;
            }

            // More speakers -> go to between_delay
            const betweenDelayState: DiscussionState = {
                currentSpeakerIndex: nextIndex,
                speakerStartTime: state.speakerStartTime,
                speakerDuration: state.speakerDuration,
                finished: false,
                phase: 'between_delay',
                delayStartTime: Date.now(),
                delayDuration: DELAY_BETWEEN_SPEAKERS
            };
            await this.setDiscussionState(roomId, dayCount, betweenDelayState);
            return betweenDelayState;
        }

        if (state.phase === 'final_delay') {
            // Final delay finished -> discussion complete
            const finishedState: DiscussionState = {
                ...state,
                finished: true,
                phase: 'finished'
            };
            await this.setDiscussionState(roomId, dayCount, finishedState);
            return finishedState;
        }

        return state;
    }

    /**
     * Clear discussion state (e.g., when voting starts).
     */
    static async clearDiscussionState(roomId: string, dayCount: number) {
        const normalizedRoomId = BigInt(roomId).toString();
        const key = `room:discussion:${normalizedRoomId}:${dayCount}`;

        if (!redis) {
            delete memoryStore[key];
            return;
        }

        try {
            await redis.del(key);
        } catch (e) {
            console.error("[ServerStore] Redis error (clearDiscussion):", e);
        }
    }
}

/**
 * Discussion state for turn-based speaking during DAY phase.
 */
export interface DiscussionState {
    currentSpeakerIndex: number;
    speakerStartTime: number; // Unix timestamp (ms)
    speakerDuration: number;  // Seconds per speaker (default: 60)
    finished: boolean;
    // NEW: Delay phase support
    phase: 'initial_delay' | 'speaking' | 'between_delay' | 'final_delay' | 'finished';
    delayStartTime?: number;  // Unix timestamp (ms) when delay started
    delayDuration?: number;   // Duration of current delay in seconds
}
