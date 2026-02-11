import { NextResponse } from 'next/server';
import { createPublicClient, http, verifyMessage } from 'viem';
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
        const { roomId: rawRoomId, detectiveAddress, targetAddress, signature, sessionKeyAddress } = await request.json();

        if (!rawRoomId || !detectiveAddress || !targetAddress || !signature) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId);

        // 0. Verify the caller is actually the detective (signature check)
        const message = `investigate:${rawRoomId}:${targetAddress}`;
        let valid = await verifyMessage({
            address: detectiveAddress as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
        });

        // If main wallet verification fails and session key provided, verify against session key
        if (!valid && sessionKeyAddress) {
            valid = await verifyMessage({
                address: sessionKeyAddress as `0x${string}`,
                message,
                signature: signature as `0x${string}`,
            });
            if (valid) {
                console.log(`[Investigate] Verified via session key ${sessionKeyAddress} for detective ${detectiveAddress}`);
            }
        }

        if (!valid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        console.log(`[API/Investigate] Detective ${detectiveAddress} checking ${targetAddress} in Room #${roomId}`);

        // 1. Verify on-chain that the detective revealed a CHECK on the target
        // FIX #20: Search in multiple block ranges to handle night ending between reveal and API call
        // Somnia produces blocks fast, so we search in chunks of 990 blocks
        const currentBlock = await publicClient.getBlockNumber();
        
        let revealEvent = null;
        const CHUNK_SIZE = 990n;
        const MAX_LOOKBACK = 5000n; // Search up to 5000 blocks back
        
        for (let offset = 0n; offset < MAX_LOOKBACK && !revealEvent; offset += CHUNK_SIZE) {
            const toBlock = currentBlock - offset;
            const fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n;
            
            try {
                const logs = await publicClient.getContractEvents({
                    address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                    abi: MAFIA_ABI,
                    eventName: 'NightActionRevealed',
                    args: {
                        roomId: roomId
                    },
                    fromBlock,
                    toBlock
                });

                revealEvent = logs.find((log: any) =>
                    log.args?.player?.toLowerCase() === detectiveAddress.toLowerCase() &&
                    log.args?.action === ACTION_CHECK &&
                    log.args?.target?.toLowerCase() === targetAddress.toLowerCase()
                ) || null;
            } catch (e) {
                console.warn(`[API/Investigate] Event search failed for range ${fromBlock}-${toBlock}:`, e);
            }
        }

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
