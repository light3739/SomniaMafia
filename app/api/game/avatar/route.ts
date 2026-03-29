import { NextResponse } from 'next/server';
import { ServerStore } from '@/services/serverStore';
import { withSignedRoute } from '@/app/api/_lib/security';
import { buildAvatarMessage } from '@/services/signingSchema';
import { ACTIVE_DEPLOYMENT } from '@/contracts/config';

export const dynamic = 'force-dynamic';

/**
 * POST - Upload/update player avatar for a room
 */
export const POST = withSignedRoute<{
    roomId: string;
    address: string;
    avatar: string;
    signature: string;
    signerAddress?: string;
    nonce: string;
    timestamp: number;
    chainId?: number;
}>({
    scope: 'avatar-upload',
    requiredFields: ['roomId', 'address', 'avatar', 'signature', 'nonce', 'timestamp'],
    getRoomId: (body) => body.roomId,
    getActorAddress: (body) => body.address,
    getSignerAddress: (body) => body.signerAddress,
    getMessage: ({ roomId, actorAddress, nonce, timestamp }) => buildAvatarMessage({
        roomId,
        address: actorAddress,
        nonce,
        timestamp,
    }),
}, async ({ body, roomId }) => {
    if (!body.avatar.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Avatar must be a base64 image data URL' }, { status: 400 });
    }

    if (body.avatar.length > 150000) {
        return NextResponse.json({ error: 'Avatar too large. Max 100KB' }, { status: 400 });
    }

    await ServerStore.storeAvatar(roomId, body.address, body.avatar, body.chainId);
    return NextResponse.json({ success: true });
});

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
        const requestChainId = searchParams.get('chainId') || ACTIVE_DEPLOYMENT.chainId.toString();
        const avatars = await ServerStore.getAvatars(roomId, requestChainId);

        return NextResponse.json({ avatars });
    } catch (error: any) {
        console.error('[API/Avatar GET] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch avatars' }, { status: 500 });
    }
}
