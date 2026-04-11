/**
 * services/share/resultData.ts — server-side helper that reads a finished
 * game's state for the public `/r/[roomId]` result page and its OG image.
 *
 * Reads are done via a fresh viem public client (no wallet, no session)
 * plus the existing public `/room-roles` GM proxy. Safe to call from any
 * server component or route handler.
 */

import { createPublicClient, http } from 'viem';
import { SOMNIA_TESTNET, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI, GM_SERVER_URL } from '../../contracts/config';
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
    chain: SOMNIA_TESTNET,
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

async function fetchRoomRoles(roomId: string): Promise<Record<string, Role>> {
    try {
        const url = `${GM_SERVER_URL}/room-roles/${encodeURIComponent(roomId)}?chainId=${SOMNIA_TESTNET.id}`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
        if (!res.ok) return {};
        const data = await res.json() as { roles?: Record<string, string | number> };
        if (!data.roles) return {};
        const out: Record<string, Role> = {};
        for (const [addr, raw] of Object.entries(data.roles)) {
            const n = typeof raw === 'number' ? raw : Number(raw);
            switch (n) {
                case 1: out[addr.toLowerCase()] = Role.MAFIA; break;
                case 2: out[addr.toLowerCase()] = Role.DOCTOR; break;
                case 3: out[addr.toLowerCase()] = Role.DETECTIVE; break;
                case 4: out[addr.toLowerCase()] = Role.CIVILIAN; break;
                default: out[addr.toLowerCase()] = Role.UNKNOWN;
            }
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

    const roomObj = room as {
        id: bigint;
        name: string;
        phase: number;
        dayCount: number;
        playersCount: number;
    } | null;

    if (!roomObj || Number(roomObj.id) === 0) {
        return { exists: false, ended: false, winner: null, players: [], roomName: '', roomId, dayCount: 0, chainId: SOMNIA_TESTNET.id };
    }

    const phase = Number(roomObj.phase);
    const ended = phase === PHASE_ENDED;

    const roles = ended ? await fetchRoomRoles(roomId) : {};

    const players: ResultPlayer[] = (rawPlayers as Array<{
        wallet: `0x${string}`;
        nickname: string;
        flags: number;
    }>).map(p => ({
        address: p.wallet.toLowerCase(),
        nickname: p.nickname || `${p.wallet.slice(0, 6)}…${p.wallet.slice(-4)}`,
        isAlive: (Number(p.flags) & FLAG_ACTIVE) !== 0,
        role: roles[p.wallet.toLowerCase()] ?? Role.UNKNOWN,
    }));

    const winner = ended ? computeWinner(players) : null;

    return {
        exists: true,
        ended,
        winner,
        players,
        roomName: roomObj.name || `Room #${roomId}`,
        roomId,
        dayCount: Number(roomObj.dayCount),
        chainId: SOMNIA_TESTNET.id,
    };
}
