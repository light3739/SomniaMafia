import { NextResponse } from 'next/server';
import { ServerStore } from '@/services/serverStore';

export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId, address, role, salt } = await request.json();

        if (!rawRoomId || !address || role === undefined || !salt) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        // Store the secret on the server
        await ServerStore.storeSecret(roomId, address, role, salt);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API/RevealSecret] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to reveal secret to server' }, { status: 500 });
    }
}
