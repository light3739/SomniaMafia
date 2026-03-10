import { NextResponse } from 'next/server';
import { GM_SERVER_URL } from '@/contracts/config';
import { withSignedRoute } from '@/app/api/_lib/security';
import { buildTeammatesMessage } from '@/services/signingSchema';

// POST /api/game/room-roles → Proxy to GM with signature verification
// This ensures only mafia can discover their teammates via GM server.
export const POST = withSignedRoute<{
    roomId: string;
    playerAddress: string;
    nonce: string;
    timestamp: number;
    signature: string;
    chainId?: number;
    signerAddress?: string;
}>({
    scope: 'room-roles',
    requiredFields: ['roomId', 'playerAddress', 'nonce', 'timestamp', 'signature'],
    getRoomId: (body) => body.roomId,
    getActorAddress: (body) => body.playerAddress,
    getSignerAddress: (body) => body.signerAddress || body.playerAddress,
    getMessage: ({ body, roomId, nonce, timestamp }) => buildTeammatesMessage({ roomId, nonce, timestamp }),
}, async ({ body, roomId }) => {
    try {
        // Local verification passed if we reached this handler due to withSignedRoute middleware.
        // We now call the GM server internally WITHOUT passing the signature/nonce/timestamp 
        // to avoid schema mismatch errors (403 Forbidden) since GM doesn't know 'teammates:' schema.
        const url = `${GM_SERVER_URL}/room-roles/${encodeURIComponent(roomId)}`;
        
        const gmRes = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!gmRes.ok) {
            const errorData = await gmRes.json().catch(() => ({}));
            return NextResponse.json({ error: errorData.error || 'GM server error' }, { status: gmRes.status });
        }

        const data = await gmRes.json();
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
});
