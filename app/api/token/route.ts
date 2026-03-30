import crypto from 'crypto';
import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI, ACTIVE_DEPLOYMENT, getDeploymentByChainId } from '@/contracts/config';
import { verifySignedRequestBody } from '@/app/api/_lib/security';
import { buildTokenMessage } from '@/services/signingSchema';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

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
        const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';
        const isFirefox = userAgent.includes('firefox');
        const reqBody = await req.json();
        const {
            room,
            username,
            playerAddress,
            signerAddress,
            signature,
            nonce,
            timestamp,
        } = reqBody;

        if (!room || !username) {
            return NextResponse.json(
                { error: 'Missing room or username' },
                { status: 400 }
            );
        }

        const roomId = parseRoomId(String(room));
        const isStrictGameRoom = !!roomId;
        const chainId = Number(reqBody.chainId) || ACTIVE_DEPLOYMENT.chainId;
        const deployment = getDeploymentByChainId(chainId);

        let normalizedPlayer = '';

        if (isStrictGameRoom) {
            if (!playerAddress || !signature || !nonce || !timestamp) {
                return NextResponse.json({ error: 'Missing required signature fields for game room' }, { status: 400 });
            }

            normalizedPlayer = String(playerAddress).toLowerCase();
            const verified = await verifySignedRequestBody({
                scope: 'token-issue',
                body: { ...reqBody, roomId }, // Ensure roomId is included for security check
                requiredFields: ['room', 'username', 'roomId', 'playerAddress', 'signature', 'nonce', 'timestamp'],
                getRoomId: (body) => body.roomId,
                getActorAddress: (body) => body.playerAddress,
                getSignerAddress: (body) => body.signerAddress,
                getMessage: ({ body, nonce, timestamp }) =>
                    buildTokenMessage({
                        room: body.room,
                        username: body.username,
                        playerAddress: String(body.playerAddress),
                        nonce,
                        timestamp,
                        chainId,
                    }),
            });

            if (!verified.ok) {
                return NextResponse.json({ error: verified.error }, { status: verified.status });
            }

            // Create temporary public client for the correct chain
            const chainClient = createPublicClient({
                chain: deployment.chain,
                transport: http()
            });

            const players = await chainClient.readContract({
                address: deployment.contracts.MafiaDiamond as `0x${string}`,
                abi: MAFIA_ABI,
                functionName: 'getPlayers',
                args: [BigInt(roomId)],
            }) as any[];

            const isMember = players.some((player: any) => String(player.wallet).toLowerCase() === normalizedPlayer);
            if (!isMember) {
                return NextResponse.json({ error: 'Player is not a member of this room' }, { status: 403 });
            }
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;

        if (!apiKey || !apiSecret) {
            console.error('[LiveKit Token API] Missing environment variables:', {
                hasApiKey: !!apiKey,
                hasApiSecret: !!apiSecret,
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

        // Generate TURN credentials (HMAC-SHA256 matching LiveKit's internal auth)
        // so the frontend can add a TURNS:443/tcp ICE server for VPN/firewall users
        const turnDomain = process.env.LIVEKIT_TURN_DOMAIN || 'turn.mafiaonchain.live';
        const turnUsername = crypto.randomBytes(12).toString('base64url');
        const turnCredential = crypto
            .createHmac('sha256', apiSecret)
            .update(turnUsername)
            .digest('base64');

        console.log('[LiveKit Token API] Token generated:', {
            room,
            username,
            tokenLength: token.length,
            turnDomain,
        });

        return NextResponse.json({
            token,
            turnServers: [
                {
                    urls: [
                        `turns:${turnDomain}:443?transport=tcp`,
                        ...(isFirefox ? [] : [`turn:${turnDomain}:443?transport=tcp`]),
                    ],
                    username: turnUsername,
                    credential: turnCredential,
                },
            ],
        });
    } catch (error) {
        console.error('[LiveKit Token API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate token' },
            { status: 500 }
        );
    }
}
