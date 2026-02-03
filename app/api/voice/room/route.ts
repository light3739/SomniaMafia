// app/api/voice/room/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SFU_URL = process.env.NEXT_PUBLIC_SFU_URL || 'https://mafia-voice.serveminecraft.net';
const SFU_API_SECRET = process.env.SFU_API_SECRET || '';

export async function POST(request: NextRequest) {
    try {
        const { roomId, userName } = await request.json();

        // Validate environment variables
        if (!SFU_API_SECRET) {
            console.error('[Voice API] SFU_API_SECRET not set!');
            return NextResponse.json(
                {
                    success: false,
                    error: 'Server configuration error: SFU_API_SECRET missing',
                    details: 'Please set SFU_API_SECRET in environment variables'
                },
                { status: 500 }
            );
        }

        if (!roomId) {
            return NextResponse.json(
                { success: false, error: 'roomId is required' },
                { status: 400 }
            );
        }

        console.log('[Voice API] Creating room:', { roomId, userName, SFU_URL });

        // Create or get join link from MiroTalk SFU
        const requestBody = {
            room: roomId,
            name: userName || 'Player',
            audio: true,
            video: false,
            screen: false,
            chat: false,
            hide: false,
            notify: false,
            token: {
                username: userName || 'anonymous',
                password: '',
                presenter: false,
                expire: '1h'
            }
        };

        console.log('[Voice API] Request to SFU:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(`${SFU_URL}/api/v1/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authorization': SFU_API_SECRET,
            },
            body: JSON.stringify(requestBody),
        });

        console.log('[Voice API] SFU response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Voice API] SFU error response:', errorText);
            console.error('[Voice API] SFU status:', response.status);
            console.error('[Voice API] SFU URL used:', SFU_URL);

            return NextResponse.json(
                {
                    success: false,
                    error: 'Failed to create voice room',
                    details: `SFU returned ${response.status}: ${errorText.substring(0, 200)}`,
                    sfuUrl: SFU_URL,
                    hasApiSecret: !!SFU_API_SECRET
                },
                { status: 500 }
            );
        }

        const data = await response.json();
        console.log('[Voice API] Success! Join URL created:', data.join?.substring(0, 50) + '...');

        return NextResponse.json({
            success: true,
            joinUrl: data.join,
        });
    } catch (error) {
        console.error('[Voice API] Unexpected error:', error);
        console.error('[Voice API] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined,
            SFU_URL,
            hasApiSecret: !!SFU_API_SECRET
        });

        return NextResponse.json(
            {
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
                hasApiSecret: !!SFU_API_SECRET
            },
            { status: 500 }
        );
    }
}
