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
        if (!redis) {
            console.warn("[ServerStore] REDIS_URL not configured. Storage disabled.");
            return;
        }

        const key = `room:secrets:${roomId}`;
        const secret: PlayerSecret = { role, salt };

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
        if (!redis) {
            console.warn("[ServerStore] REDIS_URL not configured. Cannot fetch secrets.");
            return null;
        }

        try {
            const data = await redis.hgetall(`room:secrets:${roomId}`);
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
        if (!redis) return;
        try {
            await redis.del(`room:secrets:${roomId}`);
            console.log(`[ServerStore] Redis: Cleared Room #${roomId}`);
        } catch (e) {
            console.error("[ServerStore] Redis error (clear):", e);
        }
    }
}
