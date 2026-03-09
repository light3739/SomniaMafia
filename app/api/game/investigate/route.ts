import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { GM_SERVER_URL, getDeploymentByChainId, ACTIVE_DEPLOYMENT } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';
import { withSignedRoute } from '@/app/api/_lib/security';

export const POST = withSignedRoute<{
    roomId: string;
    detectiveAddress: string;
    targetAddress: string;
    signature: string;
    signerAddress: string;
    nonce: string;
    timestamp: number;
    chainId?: number;
}>({
    scope: 'investigate',
    requiredFields: ['roomId', 'detectiveAddress', 'targetAddress', 'signature', 'nonce', 'timestamp'],
    getRoomId: (body) => body.roomId,
    getActorAddress: (body) => body.detectiveAddress,
    getSignerAddress: (body) => body.signerAddress,
    getMessage: ({ roomId, body, nonce, timestamp }) => `investigate:${roomId}:${body.targetAddress}:${nonce}:${timestamp}`,
    validateSessionRoomMatch: true,
}, async ({ body, roomId, signerAddress }) => {
    try {
        const detectiveAddress = body.detectiveAddress;
        const targetAddress = body.targetAddress;
        const signature = body.signature;

        console.log(`[API/Investigate] Detective ${detectiveAddress} checking ${targetAddress} in Room #${roomId}`);

        // 1. Strict verification via GM proof (server-side verified night action state)
        const gmProofResponse = await fetch(`${GM_SERVER_URL}/investigation-proof`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId,
                detectiveAddress,
                targetAddress,
                signature,
                signerAddress,
                nonce: body.nonce,
                timestamp: body.timestamp,
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
        const secrets = await ServerStore.getRoomSecrets(roomId);
        if (!secrets || !secrets[targetAddress.toLowerCase()]) {
            return NextResponse.json({ error: 'Target role not found in server records' }, { status: 404 });
        }

        const targetSecret = secrets[targetAddress.toLowerCase()];

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
