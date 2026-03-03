import { NextResponse } from 'next/server';
import { GM_SERVER_URL } from '@/contracts/config';
import { withSignedRoute } from '@/app/api/_lib/security';
import { buildResolveNightMessage } from '@/services/signingSchema';

export const POST = withSignedRoute<{
    roomId: string;
    playerAddress: string;
    callerAddress: string;
    signature: string;
    gmLegacySignature?: string;
    nonce: string;
    timestamp: number;
}>({
    scope: 'resolve-night',
    requiredFields: ['roomId', 'playerAddress', 'callerAddress', 'signature', 'nonce', 'timestamp'],
    getRoomId: (body) => body.roomId,
    getActorAddress: (body) => body.playerAddress,
    getSignerAddress: (body) => body.callerAddress,
    getMessage: ({ roomId, nonce, timestamp }) => buildResolveNightMessage({ roomId, nonce, timestamp }),
}, async ({ body, roomId }) => {
    const gmRes = await fetch(`${GM_SERVER_URL}/resolve-night`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomId,
            signature: body.gmLegacySignature || body.signature,
            callerAddress: body.playerAddress,
            signerAddress: body.callerAddress,
            nonce: body.nonce,
            timestamp: body.timestamp,
        }),
    });

    const gmPayload = await gmRes.json().catch(() => ({}));
    if (!gmRes.ok) {
        return NextResponse.json({ error: gmPayload?.error || 'GM resolve failed' }, { status: gmRes.status });
    }

    return NextResponse.json({ success: true, result: gmPayload });
});
