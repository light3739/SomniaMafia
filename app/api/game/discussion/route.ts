import { NextResponse } from 'next/server';
import { verifySignedRequestBody } from '@/app/api/_lib/security';
import { buildDiscussionMessage } from '@/services/signingSchema';

export const dynamic = 'force-dynamic';

const GM_SERVER_URL = process.env.GM_SERVER_URL || 'https://gm-test.mafiaonchain.live';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * GET - Discussion state
 * @route GET /api/game/discussion?roomId=...&dayCount=...&playerAddress=...
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get('roomId');
        const dayCount = searchParams.get('dayCount');
        const playerAddress = searchParams.get('playerAddress');
        const chainId = searchParams.get('chainId') || '50312';

        if (!roomId) return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });

        const query = new URLSearchParams({
            roomId,
            dayCount: dayCount || '1',
            chainId
        });
        if (playerAddress) query.append('playerAddress', playerAddress);

        const res = await fetch(`${GM_SERVER_URL}/discussion?${query.toString()}`, {
            headers: { 'Authorization': `Bearer ${INTERNAL_API_KEY}` },
            cache: 'no-store'
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to fetch discussion state' }));
            return NextResponse.json(err, { status: res.status });
        }

        return NextResponse.json(await res.json());
    } catch (e: any) {
        console.error('[API/Discussion GET] Proxy error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST - Discussion actions (start/skip)
 * Standardized signature verification then proxy to GM Server
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomId, dayCount, action, playerAddress, chainId } = body;

        // 1. Verify Signature
        const verified = await verifySignedRequestBody({
            scope: 'discussion',
            body,
            requiredFields: ['roomId', 'dayCount', 'action', 'playerAddress', 'signature', 'nonce', 'timestamp'],
            getRoomId: (b) => b.roomId,
            getActorAddress: (b) => b.playerAddress,
            getSignerAddress: (b) => b.signerAddress,
            getMessage: ({ body, roomId, nonce, timestamp }) => buildDiscussionMessage({
                roomId,
                dayCount: body.dayCount,
                action: body.action,
                nonce,
                timestamp,
                chainId: body.chainId,
            }),
        });

        if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: verified.status });

        // 2. Proxy to GM Server
        const res = await fetch(`${GM_SERVER_URL}/discussion`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTERNAL_API_KEY}`
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'GM server discussion action failed' }));
            return NextResponse.json(err, { status: res.status });
        }

        return NextResponse.json(await res.json());

    } catch (e: any) {
        console.error('[API/Discussion POST] Proxy error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
