import { NextRequest, NextResponse } from 'next/server';
import { GM_SERVER_URL } from '@/contracts/config';

// Proxy GET /api/game/room-roles?roomId=X → GM /room-roles/:roomId
// No authentication required — roles are public after game ends.
export async function GET(req: NextRequest) {
    const roomId = req.nextUrl.searchParams.get('roomId');
    if (!roomId) {
        return NextResponse.json({ error: 'Missing roomId query param' }, { status: 400 });
    }

    try {
        // CLEANUP: We explicitly do NOT pass req.nextUrl.searchParams (signature/nonce) 
        // to the GM server to avoid 403 authorization failures on the GM side.
        const url = `${GM_SERVER_URL}/room-roles/${encodeURIComponent(roomId)}`;
        
        const gmRes = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await gmRes.json();
        return NextResponse.json(data, { status: gmRes.status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
