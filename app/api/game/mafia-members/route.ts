import { NextRequest, NextResponse } from 'next/server';
import { GM_SERVER_URL } from '@/contracts/config';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    
    if (!roomId) {
        return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    try {
        // Only forward params the GM server needs — avoid leaking stale signature/nonce
        const gmParams = new URLSearchParams();
        for (const key of ['playerAddress', 'signature', 'signerAddress', 'nonce', 'timestamp', 'chainId']) {
            const val = searchParams.get(key);
            if (val) gmParams.set(key, val);
        }
        const url = `${GM_SERVER_URL}/mafia-members/${roomId}?${gmParams.toString()}`;
        
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        });
        
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
