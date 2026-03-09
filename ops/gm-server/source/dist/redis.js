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
const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const TTL = 48 * 60 * 60; // 48 hours in seconds
let _redis = null;
export function getRedis() {
    return _redis;
}
export async function connectRedis() {
    try {
        const client = new Redis(REDIS_URL, {
            connectTimeout: 3000,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            enableOfflineQueue: false,
        });
        await client.ping();
        _redis = client;
        console.log(`[redis] Connected: ${REDIS_URL}`);
    }
    catch (e) {
        console.warn(`[redis] Unavailable (${e.message}) — using in-memory state only`);
        _redis = null;
    }
}
// ─── Key builders ─────────────────────────────────────────
const K = {
    pubkey: (r, a) => `gm:room:${r}:pubkey:${a}`,
    srakey: (r, a) => `gm:room:${r}:srakey:${a}`,
    role: (r, a) => `gm:room:${r}:role:${a}`,
    proof: (r, a) => `gm:room:${r}:proof:${a}`,
    night: (r) => `gm:room:${r}:night`,
};
// ─── Fire-and-forget write helper ────────────────────────
function fw(redis, fn) {
    if (!redis)
        return;
    fn(redis).catch((e) => console.error('[redis] write error:', e.message));
}
// ─── Per-entry write helpers ─────────────────────────────
export function rPersistPubkey(redis, roomId, addr, pubkey) {
    fw(redis, r => r.set(K.pubkey(roomId, addr), pubkey, 'EX', TTL));
}
export function rPersistSraKey(redis, roomId, addr, key) {
    fw(redis, r => r.set(K.srakey(roomId, addr), key, 'EX', TTL));
}
export function rPersistRole(redis, roomId, addr, role) {
    fw(redis, r => r.set(K.role(roomId, addr), role, 'EX', TTL));
}
export function rPersistProof(redis, roomId, detective, proof) {
    fw(redis, r => r.set(K.proof(roomId, detective), JSON.stringify(proof), 'EX', TTL));
}
export function rPersistNightState(redis, roomId, state) {
    const payload = JSON.stringify({
        roomId,
        resolved: state.resolved,
        nightStartedAt: state.nightStartedAt,
        actions: [...state.actions.entries()],
    });
    fw(redis, r => r.set(K.night(roomId), payload, 'EX', TTL));
}
export function rDeleteNightState(redis, roomId) {
    fw(redis, r => r.del(K.night(roomId)));
}
function getOrCreateInner(outer, roomId) {
    let m = outer.get(roomId);
    if (!m) {
        m = new Map();
        outer.set(roomId, m);
    }
    return m;
}
export async function loadAllState(redis, containers) {
    const keys = [];
    await new Promise((resolve, reject) => {
        const stream = redis.scanStream({ match: 'gm:room:*', count: 200 });
        stream.on('data', (batch) => keys.push(...batch));
        stream.on('end', resolve);
        stream.on('error', reject);
    });
    if (keys.length === 0) {
        console.log('[redis] No persisted GM state found');
        return;
    }
    // Batch GET all keys in one pipeline round-trip
    const pipeline = redis.pipeline();
    for (const key of keys)
        pipeline.get(key);
    const results = await pipeline.exec();
    let count = 0;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = results?.[i]?.[1];
        if (!val)
            continue;
        // key format: gm:room:{roomId}:{type}[:{addr}]
        const parts = key.split(':');
        if (parts.length < 4)
            continue;
        const roomId = parts[2];
        const type = parts[3];
        const addr = parts[4]; // undefined for 'night'
        switch (type) {
            case 'pubkey':
                if (addr)
                    getOrCreateInner(containers.eciesPubkeys, roomId).set(addr, val);
                break;
            case 'srakey':
                if (addr)
                    getOrCreateInner(containers.sraSKeys, roomId).set(addr, val);
                break;
            case 'role':
                if (addr)
                    getOrCreateInner(containers.resolvedRoles, roomId).set(addr, val);
                break;
            case 'proof': {
                if (!addr)
                    break;
                const proof = JSON.parse(val);
                getOrCreateInner(containers.investigationProofs, roomId).set(addr, proof);
                break;
            }
            case 'night': {
                const ns = JSON.parse(val);
                const state = {
                    roomId: BigInt(ns.roomId),
                    resolved: ns.resolved,
                    nightStartedAt: ns.nightStartedAt,
                    actions: new Map(ns.actions),
                };
                containers.injectNight(BigInt(ns.roomId), state);
                break;
            }
            default:
                continue;
        }
        count++;
    }
    console.log(`[redis] Restored ${count} state entries (${keys.length} keys scanned)`);
}
