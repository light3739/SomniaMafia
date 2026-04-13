/**
 * services/share/resultData.ts — server-side helper that reads a finished
 * game's state for the public `/r/[roomId]` result page and its OG image.
 *
 * Reads are done via a fresh viem public client (no wallet, no session)
 * plus the existing public `/room-roles` GM proxy. Safe to call from any
 * server component or route handler.
 */

import { createPublicClient, http } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI, GM_SERVER_URL } from '../../contracts/config';
import { Role } from '../../types';

export type Winner = 'MAFIA' | 'TOWN' | 'DRAW' | 'ABORTED';

export interface ResultPlayer {
    address: string;
    nickname: string;
    isAlive: boolean;
    role: Role;
}

export interface ResultData {
    exists: boolean;
    ended: boolean;
    winner: Winner | null;
    players: ResultPlayer[];
    roomName: string;
    roomId: string;
    dayCount: number;
    chainId: number;
}

// Mirror of the GamePhase enum; kept local so this module has no
// client-only imports (which would pull `wagmi`/`@privy-io` into the server bundle).
const PHASE_ENDED = 6;
const FLAG_ACTIVE = 2;

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http(),
});

function computeWinner(players: ResultPlayer[]): Winner {
    const alive = players.filter(p => p.isAlive);
    const mafiaAlive = alive.filter(p => p.role === Role.MAFIA).length;
    const townAlive = alive.length - mafiaAlive;
    if (mafiaAlive === 0 && townAlive === 0) return 'ABORTED';
    if (mafiaAlive === 0) return 'TOWN';
    if (mafiaAlive >= townAlive) return 'MAFIA';
    return 'DRAW';
}

const ROLE_STRING_MAP: Record<string, Role> = {
    'MAFIA': Role.MAFIA, 'DOCTOR': Role.DOCTOR,
    'DETECTIVE': Role.DETECTIVE, 'CIVILIAN': Role.CIVILIAN,
};
const ROLE_NUM_MAP: Record<number, Role> = {
    1: Role.MAFIA, 2: Role.DOCTOR, 3: Role.DETECTIVE, 4: Role.CIVILIAN,
};

async function fetchRoomRoles(roomId: string): Promise<Record<string, Role>> {
    try {
        const url = `${GM_SERVER_URL}/room-roles/${encodeURIComponent(roomId)}?chainId=${somniaChain.id}`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
        if (!res.ok) return {};
        const data = await res.json() as { roles?: Record<string, string | number> };
        if (!data.roles) return {};
        const out: Record<string, Role> = {};
        for (const [addr, raw] of Object.entries(data.roles)) {
            // GM server returns string names ('MAFIA', 'DOCTOR', etc.)
            const role = typeof raw === 'string'
                ? (ROLE_STRING_MAP[raw] ?? Role.UNKNOWN)
                : (ROLE_NUM_MAP[raw] ?? Role.UNKNOWN);
            out[addr.toLowerCase()] = role;
        }
        return out;
    } catch {
        return {};
    }
}

export async function fetchResultData(roomId: string): Promise<ResultData | null> {
    const id = BigInt(roomId);

    let room: unknown;
    let rawPlayers: unknown;
    try {
        [room, rawPlayers] = await Promise.all([
            publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getRoom',
                args: [id],
            }),
            publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getPlayers',
                args: [id],
            }),
        ]);
    } catch {
        return null;
    }

    // getRoom returns a tuple (array) or named object depending on ABI/viem version.
    const r = room as any;
    const roomId_ = Array.isArray(r) ? r[0] : r.id;
    const roomName = Array.isArray(r) ? (r[1] || '') : (r.name || '');
    const phase = Number(Array.isArray(r) ? r[3] : r.phase);
    const dayCount = Number(Array.isArray(r) ? r[5] : r.dayCount);

    if (!r || Number(roomId_) === 0) {
        return { exists: false, ended: false, winner: null, players: [], roomName: '', roomId, dayCount: 0, chainId: somniaChain.id };
    }

    const ended = phase === PHASE_ENDED;

    const roles = ended ? await fetchRoomRoles(roomId) : {};

    const players: ResultPlayer[] = (rawPlayers as Array<any>).map(p => {
        const wallet = (p.wallet || p[0] || '') as string;
        const nickname = p.nickname || p[1] || `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
        const flags = Number(p.flags ?? p[2] ?? 0);
        return {
            address: wallet.toLowerCase(),
            nickname,
            isAlive: (flags & FLAG_ACTIVE) !== 0,
            role: roles[wallet.toLowerCase()] ?? Role.UNKNOWN,
        };
    });

    const winner = ended ? computeWinner(players) : null;

    return {
        exists: true,
        ended,
        winner,
        players,
        roomName: roomName || `Room #${roomId}`,
        roomId,
        dayCount,
        chainId: somniaChain.id,
    };
}
