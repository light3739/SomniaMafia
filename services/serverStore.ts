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
}
