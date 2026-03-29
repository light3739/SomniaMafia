import { NextResponse } from 'next/server';
import { GM_SERVER_URL } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';
import { withSignedRoute } from '@/app/api/_lib/security';
import { buildInvestigateMessage } from '@/services/signingSchema';

export const POST = withSignedRoute<{
    roomId: string;
    detectiveAddress: string;
    targetAddress: string;
    dayCount: number;
    signature: string;
    gmLegacySignature?: string;
    signerAddress?: string;
    nonce: string;
    timestamp: number;
    chainId?: number;
}>({
    scope: 'investigate',
    requiredFields: ['roomId', 'detectiveAddress', 'targetAddress', 'signature', 'nonce', 'timestamp'],
    getRoomId: (body) => body.roomId,
    getActorAddress: (body) => body.detectiveAddress,
    getSignerAddress: (body) => body.signerAddress,
    getMessage: ({ body, roomId, nonce, timestamp }) => buildInvestigateMessage({
        roomId,
        targetAddress: body.targetAddress,
        dayCount: body.dayCount || 0,
        nonce,
        timestamp,
    }),
}, async ({ body, roomId, signerAddress }) => {
    try {
        console.log(`[API/Investigate] Detective ${body.detectiveAddress} checking ${body.targetAddress} in Room #${roomId}`);

        // 1. Strict verification via GM proof (server-side verified night action state)
        const gmProofResponse = await fetch(`${GM_SERVER_URL}/investigation-proof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId,
                detectiveAddress: body.detectiveAddress,
                targetAddress: body.targetAddress,
                dayCount: body.dayCount,
                signature: body.gmLegacySignature || body.signature,
                signerAddress,
                nonce: body.nonce,
                timestamp: body.timestamp,
                chainId: body.chainId,
            }),
        });

        if (!gmProofResponse.ok) {
            let gmError = 'Investigation proof not found';
            try {
                const payload = await gmProofResponse.json();
                gmError = payload?.error || gmError;
            } catch { }
            return NextResponse.json({ error: gmError }, { status: gmProofResponse.status });
        }

        console.log('[API/Investigate] Verification SUCCESS via GM proof');

        // 2. Get target's role from ServerStore
        const secrets = await ServerStore.getRoomSecrets(roomId.toString(), body.chainId);
        if (!secrets || !secrets[body.targetAddress.toLowerCase()]) {
            return NextResponse.json({ error: 'Target role not found in server records' }, { status: 404 });
        }

        const targetSecret = secrets[body.targetAddress.toLowerCase()];

        return NextResponse.json({
            success: true,
            role: targetSecret.role,
            isMafia: targetSecret.role === 1 // MAFIA = 1
        });

    } catch (error: any) {
        console.error('[API/Investigate] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
});
