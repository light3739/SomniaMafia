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

// FIX #25: Warn loudly if memoryStore is used in production
if (!redis && process.env.NODE_ENV === 'production') {
    console.error(
        '\n\n🚨🚨🚨 [ServerStore] CRITICAL: Redis is NOT configured in PRODUCTION!\n' +
        'All player secrets will be stored in memory and LOST on server restart/redeploy.\n' +
        'Set REDIS_URL environment variable immediately.\n🚨🚨🚨\n'
    );
}

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
     * Flow: initial_delay -> speaking -> speaking -> ... -> finished
     */
    static async advanceSpeaker(roomId: string, dayCount: number, totalAlivePlayers: number, force: boolean = false): Promise<DiscussionState | null> {
        const state = await this.getDiscussionState(roomId, dayCount);
        if (!state || state.finished) return state;

        // Handle initial_delay -> speaking transition
        if (state.phase === 'initial_delay') {
            const newState: DiscussionState = {
                currentSpeakerIndex: 0,
                speakerStartTime: Date.now(),
                speakerDuration: state.speakerDuration,
                finished: false,
                phase: 'speaking'
            };
            await this.setDiscussionState(roomId, dayCount, newState);
            return newState;
        }

        // Handle speaking -> next speaker or finished
        if (state.phase === 'speaking') {
            // Safety Check: Don't auto-advance if speaking for less than 1.5 seconds (prevents glitches)
            const elapsed = (Date.now() - state.speakerStartTime) / 1000;
            if (!force && elapsed < 1.5) {
                console.warn(`[ServerStore] Ignored premature advance (elapsed: ${elapsed.toFixed(2)}s)`);
                return state;
            }

            const nextIndex = state.currentSpeakerIndex + 1;

            if (nextIndex >= totalAlivePlayers) {
                // All speakers done -> finished immediately (no final delay)
                const finishedState: DiscussionState = {
                    ...state,
                    finished: true,
                    phase: 'finished'
                };
                await this.setDiscussionState(roomId, dayCount, finishedState);
                return finishedState;
            }

            // Next speaker directly (no delay between)
            const newState: DiscussionState = {
                currentSpeakerIndex: nextIndex,
                speakerStartTime: Date.now(),
                speakerDuration: state.speakerDuration,
                finished: false,
                phase: 'speaking'
            };
            await this.setDiscussionState(roomId, dayCount, newState);
            return newState;
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

    // ============ PLAYER AVATARS ============

    /**
     * Store a player's avatar (base64) for a specific room.
     */
    static async storeAvatar(roomId: string, address: string, base64Avatar: string) {
        const normalizedRoomId = BigInt(roomId).toString();
        const key = `room:avatars:${normalizedRoomId}`;

        if (!redis) {
            console.warn(`[ServerStore] Redis not configured. Using MEMORY fallback for avatars`);
            if (!memoryStore[key]) memoryStore[key] = {};
            memoryStore[key][address.toLowerCase()] = base64Avatar;
            return;
        }

        try {
            await redis.hset(key, address.toLowerCase(), base64Avatar);
            await redis.expire(key, GAME_DATA_TTL);
            console.log(`[ServerStore] Stored avatar for Room #${roomId}, Player ${address.slice(0, 8)}...`);
        } catch (e) {
            console.error("[ServerStore] Redis error (storeAvatar):", e);
        }
    }

    /**
     * Get all avatars for a room.
     * Returns: { "0xaddress": "data:image/...", ... }
     */
    static async getAvatars(roomId: string): Promise<Record<string, string>> {
        const normalizedRoomId = BigInt(roomId).toString();
        const key = `room:avatars:${normalizedRoomId}`;

        if (!redis) {
            return memoryStore[key] || {};
        }

        try {
            const data = await redis.hgetall(key);
            return data || {};
        } catch (e) {
            console.error("[ServerStore] Redis error (getAvatars):", e);
            return {};
        }
    }

    /**
     * Get a single player's avatar.
     */
    static async getAvatar(roomId: string, address: string): Promise<string | null> {
        const normalizedRoomId = BigInt(roomId).toString();
        const key = `room:avatars:${normalizedRoomId}`;

        if (!redis) {
            return memoryStore[key]?.[address.toLowerCase()] || null;
        }

        try {
            const avatar = await redis.hget(key, address.toLowerCase());
            return avatar || null;
        } catch (e) {
            console.error("[ServerStore] Redis error (getAvatar):", e);
            return null;
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
