import { NextResponse } from 'next/server';
import { verifySignedRequestBody } from '@/app/api/_lib/security';
import { buildAvatarMessage } from '@/services/signingSchema';

export const dynamic = 'force-dynamic';

const GM_SERVER_URL = process.env.GM_SERVER_URL || 'https://gm-test.mafiaonchain.live';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * GET - Retrieve all avatars for a room
 * Proxy to GM Server
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get('roomId');
        if (!roomId) return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
        const chainId = searchParams.get('chainId') || '50312';

        const gmUrl = `${GM_SERVER_URL}/avatars/${roomId}?chainId=${chainId}`;
        const gmResp = await fetch(gmUrl, {
            headers: { 'Authorization': `Bearer ${INTERNAL_API_KEY}` },
            cache: 'no-store'
        });

        if (!gmResp.ok) {
            const err = await gmResp.json().catch(() => ({ error: 'GM server avatars fetch failed' }));
            return NextResponse.json(err, { status: gmResp.status });
        }

        return NextResponse.json(await gmResp.json());
    } catch (error: any) {
        console.error('[API/Avatar GET] Proxy Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/**
 * POST - Upload player avatar for a room
 * Standardized signature verification then proxy to GM Server
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomId: rawRoomId, address, avatar, signature, nonce, timestamp, chainId } = body;

        if (!rawRoomId || !address || !avatar || !signature) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();

        // 1. Verify Signature
        if (roomId !== '999') {
            const verified = await verifySignedRequestBody({
                scope: 'avatar-upload',
                body,
                requiredFields: ['roomId', 'address', 'avatar', 'signature', 'nonce', 'timestamp'],
                getRoomId: (b) => b.roomId,
                getActorAddress: (b) => b.address,
                getSignerAddress: (b) => b.signerAddress,
                getMessage: ({ roomId, actorAddress, nonce, timestamp }) => buildAvatarMessage({
                    roomId,
                    address: actorAddress,
                    nonce,
                    timestamp,
                    chainId,
                }),
            });

            if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: verified.status });
        }

        // 2. Proxy to GM Server
        const gmResp = await fetch(`${GM_SERVER_URL}/avatar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTERNAL_API_KEY}`
            },
            body: JSON.stringify(body)
        });

        if (!gmResp.ok) {
            const err = await gmResp.json().catch(() => ({ error: 'GM server avatar store failed' }));
            return NextResponse.json(err, { status: gmResp.status });
        }

        return NextResponse.json(await gmResp.json());

    } catch (error: any) {
        console.error('[API/Avatar POST] Proxy Error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
