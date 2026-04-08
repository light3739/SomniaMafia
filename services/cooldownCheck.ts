/**
 * AFK cooldown preflight check.
 *
 * Reads LibStorage.afkCooldownUntil[user] via the RefundsFacet view
 * getAfkCooldown(user). Returns the remaining cooldown in seconds, or 0 if
 * the user can act immediately. Used before joinRoom / createAndJoin /
 * joinTournament / createTournament so the UI can surface a clear error
 * message instead of a generic "Transaction failed" from the on-chain
 * Unauthorized() revert in requireNotAfkBlocked.
 */

import type { PublicClient } from 'viem';
import { MAFIA_ABI } from '../contracts/config';

export interface CooldownStatus {
    /** Unix timestamp (seconds) when cooldown expires. 0 if no cooldown. */
    until: number;
    /** Remaining seconds. 0 if expired or never set. */
    remaining: number;
    /** True if the user is currently blocked. */
    blocked: boolean;
}

export async function checkAfkCooldown(
    publicClient: PublicClient,
    contractAddress: `0x${string}`,
    userAddress: `0x${string}`,
): Promise<CooldownStatus> {
    try {
        const until = (await publicClient.readContract({
            address: contractAddress,
            abi: MAFIA_ABI,
            functionName: 'getAfkCooldown',
            args: [userAddress],
        })) as number | bigint;
        const untilNum = Number(until);
        const now = Math.floor(Date.now() / 1000);
        const remaining = untilNum > now ? untilNum - now : 0;
        return {
            until: untilNum,
            remaining,
            blocked: remaining > 0,
        };
    } catch (e: any) {
        // Legacy deployment without getAfkCooldown selector, or RPC hiccup.
        // Don't block the user on a read failure — treat as no cooldown and
        // let the on-chain write path do the real enforcement.
        console.debug('[checkAfkCooldown] read failed, assuming no cooldown:', e?.shortMessage || e?.message);
        return { until: 0, remaining: 0, blocked: false };
    }
}

export function formatCooldown(remaining: number): string {
    if (remaining <= 0) return '';
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}
