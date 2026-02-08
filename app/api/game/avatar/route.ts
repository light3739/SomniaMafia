import { NextResponse } from 'next/server';
import { ServerStore } from '@/services/serverStore';

/**
 * POST - Upload/update player avatar for a room
 */
export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId, address, avatar } = await request.json();

        if (!rawRoomId || !address || !avatar) {
            return NextResponse.json({ error: 'Missing required fields: roomId, address, avatar' }, { status: 400 });
        }

        // Validate avatar is base64 image
        if (!avatar.startsWith('data:image/')) {
            return NextResponse.json({ error: 'Avatar must be a base64 image data URL' }, { status: 400 });
        }

        // Limit avatar size (100KB max for base64)
        if (avatar.length > 150000) {
            return NextResponse.json({ error: 'Avatar too large. Max 100KB' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        await ServerStore.storeAvatar(roomId, address, avatar);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API/Avatar POST] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to store avatar' }, { status: 500 });
    }
}

/**
 * GET - Retrieve all avatars for a room
 * Query: ?roomId=123
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawRoomId = searchParams.get('roomId');

        if (!rawRoomId) {
            return NextResponse.json({ error: 'Missing roomId query parameter' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        const avatars = await ServerStore.getAvatars(roomId);

        return NextResponse.json({ avatars });
    } catch (error: any) {
        console.error('[API/Avatar GET] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch avatars' }, { status: 500 });
    }
}
