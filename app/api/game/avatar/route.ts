import { NextResponse } from 'next/server';
import { createPublicClient, http, verifyMessage } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;
const NONCE_MIN_LENGTH = 8;

/**
 * POST - Upload/update player avatar for a room
 */
export async function POST(request: Request) {
    try {
        const {
            roomId: rawRoomId,
            address,
            avatar,
            signature,
            signerAddress,
            nonce,
            timestamp,
        } = await request.json();

        if (!rawRoomId || !address || !avatar || !signature || !nonce || !timestamp) {
            return NextResponse.json({ error: 'Missing required fields: roomId, address, avatar, signature, nonce, timestamp' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        const normalizedAddress = String(address).toLowerCase();
        const normalizedSigner = String(signerAddress || address).toLowerCase();

        const ts = Number(timestamp);
        if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_CLOCK_SKEW_MS) {
            return NextResponse.json({ error: 'Request expired or invalid timestamp' }, { status: 401 });
        }

        if (typeof nonce !== 'string' || nonce.length < NONCE_MIN_LENGTH || nonce.length > 128) {
            return NextResponse.json({ error: 'Invalid nonce' }, { status: 400 });
        }

        const message = `avatar:${roomId}:${normalizedAddress}:${nonce}:${ts}`;
        const sigValid = await verifyMessage({
            address: normalizedSigner as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
        });

        if (!sigValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        if (normalizedSigner !== normalizedAddress) {
            const sessionKeyData = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'sessionKeys',
                args: [address as `0x${string}`],
            }) as any;

            const registeredSession = Array.isArray(sessionKeyData) ? sessionKeyData[0] : sessionKeyData.sessionAddress;
            const expiresAt = Number(Array.isArray(sessionKeyData) ? sessionKeyData[1] : sessionKeyData.expiresAt);
            const roomIdFromChain = Number(Array.isArray(sessionKeyData) ? sessionKeyData[2] : sessionKeyData.roomId);
            const isActive = Boolean(Array.isArray(sessionKeyData) ? sessionKeyData[3] : sessionKeyData.isActive);

            if (!registeredSession || registeredSession.toLowerCase() !== normalizedSigner) {
                return NextResponse.json({ error: 'Session key is not registered for this player' }, { status: 403 });
            }
            if (!isActive || expiresAt <= Math.floor(Date.now() / 1000)) {
                return NextResponse.json({ error: 'Session key inactive or expired' }, { status: 403 });
            }
            if (roomIdFromChain !== Number(roomId)) {
                return NextResponse.json({ error: 'Session key room mismatch' }, { status: 403 });
            }
        }

        const accepted = await ServerStore.consumeReplayNonce('avatar-upload', roomId, normalizedAddress, nonce);
        if (!accepted) {
            return NextResponse.json({ error: 'Replay detected: nonce already used' }, { status: 409 });
        }

        // Validate avatar is base64 image
        if (!avatar.startsWith('data:image/')) {
            return NextResponse.json({ error: 'Avatar must be a base64 image data URL' }, { status: 400 });
        }

        // Limit avatar size (100KB max for base64)
        if (avatar.length > 150000) {
            return NextResponse.json({ error: 'Avatar too large. Max 100KB' }, { status: 400 });
        }

        await ServerStore.storeAvatar(roomId, address, avatar);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API/Avatar POST] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to store avatar' }, { status: 500 });
    }
}

/**
 * GET - Retrieve all avatars for a room
 * Query: ?roomId=123
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawRoomId = searchParams.get('roomId');

        if (!rawRoomId) {
            return NextResponse.json({ error: 'Missing roomId query parameter' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        const avatars = await ServerStore.getAvatars(roomId);

        return NextResponse.json({ avatars });
    } catch (error: any) {
        console.error('[API/Avatar GET] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch avatars' }, { status: 500 });
    }
}
