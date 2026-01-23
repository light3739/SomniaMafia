import { NextResponse } from 'next/server';
import { ServerStore } from '@/services/serverStore';
import { createPublicClient, http } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '@/contracts/config';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

const FLAG_ACTIVE = 2;
const ROLE_MAFIA = 1;
const ROLE_DETECTIVE = 2;
const ROLE_DOCTOR = 3;

/**
 * GET /api/game/night-summary?roomId=...
 * Returns the count of alive players for each active role.
 * This is used by the frontend to know how many night actions to wait for
 * without revealing WHO has what role.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawRoomId = searchParams.get('roomId');

        if (!rawRoomId) {
            return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId);

        // 1. Get alive players from contract
        const players: any = await publicClient.readContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'getPlayers',
            args: [roomId],
        });

        const aliveAddresses = players
            .filter((p: any) => (Number(p.flags) & FLAG_ACTIVE) !== 0)
            .map((p: any) => p.wallet.toLowerCase());

        // 2. Get all secrets from ServerStore
        const secrets = await ServerStore.getRoomSecrets(roomId.toString());

        if (!secrets) {
            // If secrets not found, we can't provide summary
            return NextResponse.json({
                expectedTownReveals: 0,
                expectedMafiaReveals: 0,
                warning: 'Secrets not yet stored'
            });
        }

        let detectiveAlive = 0;
        let doctorAlive = 0;
        let mafiaAlive = 0;

        for (const addr of aliveAddresses) {
            const secret = secrets[addr];
            if (secret) {
                if (secret.role === ROLE_MAFIA) mafiaAlive++;
                else if (secret.role === ROLE_DETECTIVE) detectiveAlive++;
                else if (secret.role === ROLE_DOCTOR) doctorAlive++;
            }
        }

        return NextResponse.json({
            expectedTownReveals: detectiveAlive + doctorAlive,
            expectedMafiaReveals: mafiaAlive
        });

    } catch (error: any) {
        console.error('[API/NightSummary] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch night summary' }, { status: 500 });
    }
}
