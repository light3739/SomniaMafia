import { NextResponse } from 'next/server';
import { GM_SERVER_URL } from '@/contracts/config';
import { withSignedRoute } from '@/app/api/_lib/security';
import { buildNightActionMessage } from '@/services/signingSchema';

export const POST = withSignedRoute<{
    roomId: string;
    playerAddress: string;
    actionType: 'kill' | 'heal' | 'check';
    targetAddress: string;
    signature: string;
    signerAddress?: string;
    role: number;
    salt: string;
    nonce: string;
    timestamp: number;
}>({
    scope: 'night-action',
    requiredFields: ['roomId', 'playerAddress', 'actionType', 'targetAddress', 'signature', 'nonce', 'timestamp'],
    getRoomId: (body) => body.roomId,
    getActorAddress: (body) => body.playerAddress,
    getSignerAddress: (body) => body.signerAddress,
    getMessage: ({ body, roomId, nonce, timestamp }) => buildNightActionMessage({
        roomId,
        actionType: body.actionType,
        targetAddress: body.targetAddress,
        nonce,
        timestamp,
    }),
}, async ({ body, roomId, signerAddress }) => {
    if (!['kill', 'heal', 'check'].includes(body.actionType)) {
        return NextResponse.json({ error: 'Invalid actionType' }, { status: 400 });
    }

    const gmRes = await fetch(`${GM_SERVER_URL}/night-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomId,
            playerAddress: body.playerAddress,
            actionType: body.actionType,
            targetAddress: body.targetAddress,
            signature: body.signature,
            signerAddress,
            role: body.role,
            salt: body.salt,
        }),
    });

    const gmPayload = await gmRes.json().catch(() => ({}));
    if (!gmRes.ok) {
        return NextResponse.json({ error: gmPayload?.error || 'GM rejected night action' }, { status: gmRes.status });
    }

    return NextResponse.json({ success: true, result: gmPayload });
});
