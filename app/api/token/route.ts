import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { MAFIA_ABI, ACTIVE_DEPLOYMENT, getDeploymentByChainId } from '@/contracts/config';
import { verifySignedRequestBody } from '@/app/api/_lib/security';
import { buildTokenMessage } from '@/services/signingSchema';

const DAILY_API_BASE = 'https://api.daily.co/v1';
const DEFAULT_ROOM_TTL_SEC = 2 * 60 * 60;
const DEFAULT_TOKEN_TTL_SEC = 60 * 60;
const MAX_PARTICIPANTS = 16;

function parseRoomId(room: string): string | null {
    const prefix = room.split('-')[0];
    if (!prefix) return null;
    try {
        return BigInt(prefix).toString();
    } catch {
        return null;
    }
}

function sanitizeRoomName(raw: string): string {
    return raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'room';
}

function buildDailyRoomName(chainId: number, roomId: string | null, fallback: string): string {
    if (roomId) return sanitizeRoomName(`mafia-${chainId}-${roomId}`);
    return sanitizeRoomName(fallback);
}

async function createDailyRoom(apiKey: string, name: string): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000);
    const resp = await fetch(`${DAILY_API_BASE}/rooms`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name,
            privacy: 'private',
            properties: {
                exp: nowSec + DEFAULT_ROOM_TTL_SEC,
                eject_at_room_exp: true,
                max_participants: MAX_PARTICIPANTS,
                start_audio_off: false,
                start_video_off: true,
                enable_prejoin_ui: false,
            },
        }),
    });

    if (resp.ok) return;

    const text = await resp.text().catch(() => '');
    if (resp.status === 409 || /already exists/i.test(text)) return;

    throw new Error(`Daily /rooms failed: ${resp.status} ${text}`);
}

async function createDailyToken(apiKey: string, params: { room: string; userName: string; userId?: string; }): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);
    const resp = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            properties: {
                room_name: params.room,
                user_name: params.userName,
                user_id: params.userId,
                exp: nowSec + DEFAULT_TOKEN_TTL_SEC,
                is_owner: false,
            },
        }),
    });

    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Daily /meeting-tokens failed: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    if (!data?.token) throw new Error('Daily /meeting-tokens returned no token');
    return data.token as string;
}

export async function POST(req: NextRequest) {
    try {
        const reqBody = await req.json();
        const {
            room,
            username,
            playerAddress,
            signature,
            nonce,
            timestamp,
        } = reqBody;

        if (!room || !username) {
            return NextResponse.json({ error: 'Missing room or username' }, { status: 400 });
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
                body: { ...reqBody, roomId },
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

            const chainClient = createPublicClient({
                chain: deployment.chain,
                transport: http(),
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

        const apiKey = process.env.DAILY_API_KEY;
        const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN;

        if (!apiKey || !domain) {
            console.error('[Daily Token API] Server misconfigured:', {
                hasApiKey: !!apiKey,
                hasDomain: !!domain,
            });
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
        }

        const dailyRoomName = buildDailyRoomName(chainId, roomId, String(room));
        await createDailyRoom(apiKey, dailyRoomName);

        const token = await createDailyToken(apiKey, {
            room: dailyRoomName,
            userName: String(username),
            userId: normalizedPlayer || undefined,
        });

        const roomUrl = `https://${domain}.daily.co/${dailyRoomName}`;
        return NextResponse.json({ token, roomUrl, roomName: dailyRoomName });
    } catch (error) {
        console.error('[Daily Token API] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate token';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
