import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

// NightActionType.CHECK = 3
const ACTION_CHECK = 3;

export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId, detectiveAddress, targetAddress } = await request.json();

        if (!rawRoomId || !detectiveAddress || !targetAddress) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId);
        console.log(`[API/Investigate] Detective ${detectiveAddress} checking ${targetAddress} in Room #${roomId}`);

        // 1. Verify on-chain that the detective revealed a CHECK on the target
        // We use getContractEvents instead of reading mappings because mappings are cleared 
        // as soon as the night ends (gas optimization), creating a race condition.
        const currentBlock = await publicClient.getBlockNumber();
        const logs = await publicClient.getContractEvents({
            address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
            abi: MAFIA_ABI,
            eventName: 'NightActionRevealed',
            args: {
                roomId: roomId
            },
            fromBlock: currentBlock - 990n // Somnia RPC limit is 1000 blocks
        });

        const revealEvent = logs.find((log: any) =>
            log.args?.player?.toLowerCase() === detectiveAddress.toLowerCase() &&
            log.args?.action === ACTION_CHECK &&
            log.args?.target?.toLowerCase() === targetAddress.toLowerCase()
        );

        if (!revealEvent) {
            // Fallback: try checking current mappings if event not found (might not have indexed yet)
            const revealedAction = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                abi: MAFIA_ABI,
                functionName: 'revealedActions',
                args: [roomId, detectiveAddress as `0x${string}`],
            }) as number;

            const revealedTarget = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                abi: MAFIA_ABI,
                functionName: 'revealedTargets',
                args: [roomId, detectiveAddress as `0x${string}`],
            }) as string;

            if (revealedAction !== ACTION_CHECK || revealedTarget.toLowerCase() !== targetAddress.toLowerCase()) {
                console.log(`[API/Investigate] Verification failed for ${detectiveAddress}. No event and mapping mismatch.`);
                return NextResponse.json({
                    error: 'Detective action not verified on-chain (No event or mapping match)',
                    revealedAction,
                    revealedTarget
                }, { status: 403 });
            }
        }

        console.log(`[API/Investigate] Verification SUCCESS via ${revealEvent ? 'Event' : 'Mapping'}`);

        // 2. Get target's role from ServerStore
        const secrets = await ServerStore.getRoomSecrets(roomId.toString());
        if (!secrets || !secrets[targetAddress.toLowerCase()]) {
            return NextResponse.json({ error: 'Target role not found in server records' }, { status: 404 });
        }

        const targetSecret = secrets[targetAddress.toLowerCase()];

        return NextResponse.json({
            success: true,
            role: targetSecret.role,
            isMafia: targetSecret.role === 1 // MAFIA = 1
        });

    } catch (error: any) {
        console.error('[API/Investigate] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
