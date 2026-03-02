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
        const { roomId: rawRoomId, detectiveAddress, targetAddress, signature, signerAddress } = await request.json();

        if (!rawRoomId || !detectiveAddress || !targetAddress || !signature) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId);

        // 0. Verify the caller is actually the detective (signature check)
        // Support both main wallet and session key signatures
        const message = `investigate:${rawRoomId}:${targetAddress}`;
        const actualSigner = signerAddress || detectiveAddress;

        const valid = await verifyMessage({
            address: actualSigner as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
        });
        if (!valid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // If signed by session key, verify it's registered for the detective's main wallet
        if (actualSigner.toLowerCase() !== detectiveAddress.toLowerCase()) {
            try {
                // Use sessionKeys(detectiveAddress) to get the registered session key
                // sessionKeys returns a struct: { sessionAddress, expiresAt, roomId, isActive }
                const sessionKeyData = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                    abi: MAFIA_ABI,
                    functionName: 'sessionKeys',
                    args: [detectiveAddress as `0x${string}`],
                }) as any;

                console.log(`[API/Investigate] sessionKeys(${detectiveAddress}):`, JSON.stringify(sessionKeyData, (_, v) => typeof v === 'bigint' ? v.toString() : v));

                // Extract sessionAddress from the struct (could be array or object)
                const registeredSession = Array.isArray(sessionKeyData)
                    ? sessionKeyData[0]  // First element is sessionAddress
                    : sessionKeyData.sessionAddress;

                const isActive = Array.isArray(sessionKeyData)
                    ? sessionKeyData[3]  // Fourth element is isActive
                    : sessionKeyData.isActive;

                if (!registeredSession || registeredSession.toLowerCase() !== actualSigner.toLowerCase()) {
                    console.error(`[API/Investigate] Session key mismatch: registered=${registeredSession}, actual=${actualSigner}`);
                    return NextResponse.json({
                        error: 'Session key is not registered for this detective',
                        debug: { registeredSession, actualSigner, detectiveAddress }
                    }, { status: 403 });
                }

                if (!isActive) {
                    console.warn(`[API/Investigate] Session key ${actualSigner} is inactive/expired`);
                }

                console.log(`[API/Investigate] Verified session key ${actualSigner} for detective ${detectiveAddress}`);
            } catch (e: any) {
                console.error('[API/Investigate] Session key verification failed:', e?.message || e);
                return NextResponse.json({
                    error: 'Failed to verify session key ownership',
                    detail: e?.message
                }, { status: 500 });
            }
        }

        console.log(`[API/Investigate] Detective ${detectiveAddress} checking ${targetAddress} in Room #${roomId}`);

        // 1. Verify the detective's action
        // Try on-chain verification first (legacy commit-reveal flow)
        // If not found, fall back to GM Server flow (signature already verified above)
        let verifiedVia = 'GM-signature';

        try {
            const currentBlock = await publicClient.getBlockNumber();
            let revealEvent = null;
            const CHUNK_SIZE = 990n;
            const MAX_LOOKBACK = 5000n;

            for (let offset = 0n; offset < MAX_LOOKBACK && !revealEvent; offset += CHUNK_SIZE) {
                const toBlock = currentBlock - offset;
                const fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n;

                try {
                    const logs = await publicClient.getContractEvents({
                        address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                        abi: MAFIA_ABI,
                        eventName: 'NightActionRevealed',
                        args: { roomId },
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

            if (revealEvent) {
                verifiedVia = 'Event';
            } else {
                // Fallback: try checking current mappings
                const revealedAction = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                    abi: MAFIA_ABI,
                    functionName: 'revealedActions',
                    args: [roomId, detectiveAddress as `0x${string}`],
                }) as number;

                if (revealedAction === ACTION_CHECK) {
                    verifiedVia = 'Mapping';
                }
            }
        } catch (e) {
            console.warn('[API/Investigate] On-chain verification failed, using GM-signature fallback:', e);
        }

        // GM Server flow fallback: verify the caller is actually a detective via ServerStore
        if (verifiedVia === 'GM-signature') {
            const secrets = await ServerStore.getRoomSecrets(roomId.toString());
            const detectiveSecret = secrets?.[detectiveAddress.toLowerCase()];
            // Role 3 = DETECTIVE
            if (!detectiveSecret || detectiveSecret.role !== 3) {
                console.log(`[API/Investigate] GM fallback: ${detectiveAddress} is not a detective (role=${detectiveSecret?.role})`);
                return NextResponse.json({
                    error: 'Caller is not a detective in this room',
                }, { status: 403 });
            }
            console.log(`[API/Investigate] GM fallback: verified ${detectiveAddress} as detective via ServerStore`);
        }

        console.log(`[API/Investigate] Verification SUCCESS via ${verifiedVia}`);

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
