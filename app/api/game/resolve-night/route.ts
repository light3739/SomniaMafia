import { NextResponse } from 'next/server';
import { createPublicClient, http, verifyMessage } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI, GM_SERVER_URL } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000; // 2 minutes
const NONCE_MIN_LENGTH = 8;

export async function POST(request: Request) {
    try {
        const {
            roomId: rawRoomId,
            playerAddress,
            callerAddress,
            signature,
            nonce,
            timestamp,
        } = await request.json();

        if (!rawRoomId || !playerAddress || !callerAddress || !signature || !nonce || !timestamp) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        const normalizedPlayer = String(playerAddress).toLowerCase();
        const normalizedCaller = String(callerAddress).toLowerCase();

        const ts = Number(timestamp);
        if (!Number.isFinite(ts)) {
            return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
        }
        if (Math.abs(Date.now() - ts) > MAX_CLOCK_SKEW_MS) {
            return NextResponse.json({ error: 'Request expired or clock skew too large' }, { status: 401 });
        }

        if (typeof nonce !== 'string' || nonce.length < NONCE_MIN_LENGTH || nonce.length > 128) {
            return NextResponse.json({ error: 'Invalid nonce' }, { status: 400 });
        }

        const message = `resolve-night:${roomId}:${nonce}:${ts}`;
        const sigValid = await verifyMessage({
            address: normalizedCaller as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
        });

        if (!sigValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        if (normalizedCaller !== normalizedPlayer) {
            const sessionKeyData = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'sessionKeys',
                args: [playerAddress as `0x${string}`],
            }) as any;

            const registeredSession = Array.isArray(sessionKeyData)
                ? sessionKeyData[0]
                : sessionKeyData.sessionAddress;
            const expiresAt = Number(Array.isArray(sessionKeyData)
                ? sessionKeyData[1]
                : sessionKeyData.expiresAt);
            const roomIdFromChain = Number(Array.isArray(sessionKeyData)
                ? sessionKeyData[2]
                : sessionKeyData.roomId);
            const isActive = Boolean(Array.isArray(sessionKeyData)
                ? sessionKeyData[3]
                : sessionKeyData.isActive);

            if (!registeredSession || registeredSession.toLowerCase() !== normalizedCaller) {
                return NextResponse.json({ error: 'Session key is not registered for this player' }, { status: 403 });
            }
            if (!isActive || expiresAt <= Math.floor(Date.now() / 1000)) {
                return NextResponse.json({ error: 'Session key inactive or expired' }, { status: 403 });
            }
            if (roomIdFromChain !== Number(roomId)) {
                return NextResponse.json({ error: 'Session key room mismatch' }, { status: 403 });
            }
        }

        const accepted = await ServerStore.consumeReplayNonce('resolve-night', roomId, normalizedPlayer, nonce);
        if (!accepted) {
            return NextResponse.json({ error: 'Replay detected: nonce already used' }, { status: 409 });
        }

        const gmRes = await fetch(`${GM_SERVER_URL}/resolve-night`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId,
                signature,
                callerAddress,
            }),
        });

        const gmPayload = await gmRes.json().catch(() => ({}));
        if (!gmRes.ok) {
            return NextResponse.json({ error: gmPayload?.error || 'GM resolve failed' }, { status: gmRes.status });
        }

        return NextResponse.json({ success: true, result: gmPayload });
    } catch (error: any) {
        console.error('[API/ResolveNight] Error:', error);
        return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
    }
}
