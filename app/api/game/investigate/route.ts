import { NextResponse } from 'next/server';
import { createPublicClient, http, verifyMessage } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI, GM_SERVER_URL } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

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

                const expiresAt = Number(Array.isArray(sessionKeyData)
                    ? sessionKeyData[1]
                    : sessionKeyData.expiresAt);

                const roomIdFromChain = Number(Array.isArray(sessionKeyData)
                    ? sessionKeyData[2]
                    : sessionKeyData.roomId);

                if (!registeredSession || registeredSession.toLowerCase() !== actualSigner.toLowerCase()) {
                    console.error(`[API/Investigate] Session key mismatch: registered=${registeredSession}, actual=${actualSigner}`);
                    return NextResponse.json({
                        error: 'Session key is not registered for this detective',
                        debug: { registeredSession, actualSigner, detectiveAddress }
                    }, { status: 403 });
                }

                if (!isActive) {
                    return NextResponse.json({ error: 'Session key is inactive' }, { status: 403 });
                }

                if (expiresAt <= Math.floor(Date.now() / 1000)) {
                    return NextResponse.json({ error: 'Session key is expired' }, { status: 403 });
                }

                if (roomIdFromChain !== Number(roomId)) {
                    return NextResponse.json({ error: 'Session key room mismatch' }, { status: 403 });
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

        // 1. Strict verification via GM proof (server-side verified night action state)
        const gmProofResponse = await fetch(`${GM_SERVER_URL}/investigation-proof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: rawRoomId,
                detectiveAddress,
                targetAddress,
                signature,
                signerAddress: actualSigner,
            }),
        });

        if (!gmProofResponse.ok) {
            let gmError = 'Investigation proof not found';
            try {
                const payload = await gmProofResponse.json();
                gmError = payload?.error || gmError;
            } catch { }
            return NextResponse.json({ error: gmError }, { status: gmProofResponse.status });
        }

        console.log('[API/Investigate] Verification SUCCESS via GM proof');

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
