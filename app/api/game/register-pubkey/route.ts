import { NextRequest, NextResponse } from 'next/server';
import { ServerStore } from '../../../../services/serverStore';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { roomId, address, eciesPubKey } = body;

        // Validation
        if (!roomId || !address || !eciesPubKey) {
            return NextResponse.json(
                { error: 'Missing required fields: roomId, address, eciesPubKey' },
                { status: 400 }
            );
        }

        if (typeof eciesPubKey !== 'string' || !/^[0-9a-f]{130}$/i.test(eciesPubKey)) {
            return NextResponse.json(
                { error: 'Invalid eciesPubKey: must be 130-char hex (uncompressed P-256 point)' },
                { status: 400 }
            );
        }

        await ServerStore.storeEciesPubKey(roomId, address, eciesPubKey);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[register-pubkey] Error:', e);
        return NextResponse.json(
            { error: e.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
