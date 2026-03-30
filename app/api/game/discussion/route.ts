import { NextResponse } from 'next/server';
import { verifySignedRequestBody } from '@/app/api/_lib/security';
import { buildDiscussionMessage } from '@/services/signingSchema';

export const dynamic = 'force-dynamic';

const GM_SERVER_URL = process.env.GM_SERVER_URL || 'https://gm-test.mafiaonchain.live';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * GET /api/game/discussion
 * Proxy to GM Server
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const roomId = searchParams.get('roomId');
        const dayCount = searchParams.get('dayCount') || '1';
        const playerAddress = searchParams.get('playerAddress') || '';
        const chainId = searchParams.get('chainId') || '43113';

        if (!roomId) {
            return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
        }

        const gmUrl = `${GM_SERVER_URL}/discussion?roomId=${roomId}&dayCount=${dayCount}&playerAddress=${playerAddress}&chainId=${chainId}`;
        const gmResp = await fetch(gmUrl, {
            headers: { 'Authorization': `Bearer ${INTERNAL_API_KEY}` },
            cache: 'no-store'
        });

        if (!gmResp.ok) {
            const err = await gmResp.json().catch(() => ({ error: 'GM server error' }));
            return NextResponse.json(err, { status: gmResp.status });
        }

        const data = await gmResp.json();
        const response = NextResponse.json(data);
        
        // Ensure no caching
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        
        return response;
    } catch (error: any) {
        console.error('[API/Discussion] GET Proxy Error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/game/discussion
 * Standardized signature verification then proxy to GM Server
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomId: rawRoomId, action, dayCount, playerAddress, chainId } = body;

        if (!rawRoomId || !action || !playerAddress) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();

        // 1. Verify Signature (Standardized Pattern)
        if (roomId !== '999') {
            const verified = await verifySignedRequestBody({
                scope: 'discussion-action',
                body,
                requiredFields: ['roomId', 'action', 'dayCount', 'playerAddress', 'signature', 'nonce', 'timestamp'],
                getRoomId: (b) => b.roomId,
                getActorAddress: (b) => b.playerAddress,
                getSignerAddress: (b) => b.signerAddress,
                getMessage: ({ roomId, nonce, timestamp }) => buildDiscussionMessage({
                    roomId,
                    dayCount: Number(dayCount || 1),
                    action: action as any,
                    nonce,
                    timestamp,
                    chainId,
                }),
            });

            if (!verified.ok) {
                return NextResponse.json({ error: verified.error }, { status: verified.status });
            }
        }

        // 2. Proxy to GM Server
        const gmResp = await fetch(`${GM_SERVER_URL}/discussion`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${INTERNAL_API_KEY}`
            },
            body: JSON.stringify(body)
        });

        if (!gmResp.ok) {
            const err = await gmResp.json().catch(() => ({ error: 'GM server action failed' }));
            return NextResponse.json(err, { status: gmResp.status });
        }

        const data = await gmResp.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('[API/Discussion] POST Proxy Error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
