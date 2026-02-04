import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { room, username } = await req.json();

        if (!room || !username) {
            return NextResponse.json(
                { error: 'Missing room or username' },
                { status: 400 }
            );
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

        if (!apiKey || !apiSecret || !wsUrl) {
            console.error('[LiveKit Token API] Missing environment variables:', {
                hasApiKey: !!apiKey,
                hasApiSecret: !!apiSecret,
                hasWsUrl: !!wsUrl
            });
            return NextResponse.json(
                { error: 'Server misconfigured' },
                { status: 500 }
            );
        }

        // Create access token
        const at = new AccessToken(apiKey, apiSecret, { identity: username });

        // Add permissions for the room
        at.addGrant({
            room,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        console.log('[LiveKit Token API] Token generated:', {
            room,
            username,
            tokenLength: token.length
        });

        return NextResponse.json({ token });
    } catch (error) {
        console.error('[LiveKit Token API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate token' },
            { status: 500 }
        );
    }
}
