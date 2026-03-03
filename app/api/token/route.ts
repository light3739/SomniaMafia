import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, verifyMessage } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;
const NONCE_MIN_LENGTH = 8;

function parseRoomId(room: string): string | null {
    const prefix = room.split('-')[0];
    if (!prefix) return null;
    try {
        return BigInt(prefix).toString();
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const {
            room,
            username,
            playerAddress,
            signerAddress,
            signature,
            nonce,
            timestamp,
        } = await req.json();

        if (!room || !username) {
            return NextResponse.json(
                { error: 'Missing room or username' },
                { status: 400 }
            );
        }

        const roomId = parseRoomId(String(room));
        const isStrictGameRoom = !!roomId;

        let normalizedPlayer = '';
        let normalizedSigner = '';

        if (isStrictGameRoom) {
            if (!playerAddress || !signature || !nonce || !timestamp) {
                return NextResponse.json({ error: 'Missing required signature fields for game room' }, { status: 400 });
            }

            normalizedPlayer = String(playerAddress).toLowerCase();
            normalizedSigner = String(signerAddress || playerAddress).toLowerCase();

            const ts = Number(timestamp);
            if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_CLOCK_SKEW_MS) {
                return NextResponse.json({ error: 'Request expired or invalid timestamp' }, { status: 401 });
            }

            if (typeof nonce !== 'string' || nonce.length < NONCE_MIN_LENGTH || nonce.length > 128) {
                return NextResponse.json({ error: 'Invalid nonce' }, { status: 400 });
            }

            const message = `token:${room}:${username}:${normalizedPlayer}:${nonce}:${ts}`;
            const sigValid = await verifyMessage({
                address: normalizedSigner as `0x${string}`,
                message,
                signature: signature as `0x${string}`,
            });

            if (!sigValid) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }

            if (normalizedSigner !== normalizedPlayer) {
                const sessionKeyData = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'sessionKeys',
                    args: [playerAddress as `0x${string}`],
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

            const players = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'getPlayers',
                args: [BigInt(roomId)],
            }) as any[];

            const isMember = players.some((player: any) => String(player.wallet).toLowerCase() === normalizedPlayer);
            if (!isMember) {
                return NextResponse.json({ error: 'Player is not a member of this room' }, { status: 403 });
            }

            const accepted = await ServerStore.consumeReplayNonce('token-issue', roomId, normalizedPlayer, nonce);
            if (!accepted) {
                return NextResponse.json({ error: 'Replay detected: nonce already used' }, { status: 409 });
            }
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

        if (!apiKey || !apiSecret || !wsUrl) {
            console.error('[LiveKit Token API] Missing environment variables:', {
                hasApiKey: !!apiKey,
                hasApiSecret: !!apiSecret,
                hasWsUrl: !!wsUrl
            });
            return NextResponse.json(
                { error: 'Server misconfigured' },
                { status: 500 }
            );
        }

        // Create access token
        const at = new AccessToken(apiKey, apiSecret, { identity: username });

        // Add permissions for the room
        at.addGrant({
            room,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        console.log('[LiveKit Token API] Token generated:', {
            room,
            username,
            tokenLength: token.length
        });

        return NextResponse.json({ token });
    } catch (error) {
        console.error('[LiveKit Token API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate token' },
            { status: 500 }
        );
    }
}
