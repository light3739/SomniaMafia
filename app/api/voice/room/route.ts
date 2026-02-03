// app/api/voice/room/route.ts
import { NextRequest, NextResponse } from 'next/server';

const SFU_URL = process.env.NEXT_PUBLIC_SFU_URL || 'https://mafia-voice.serveminecraft.net';
const SFU_API_SECRET = process.env.SFU_API_SECRET || '';

export async function POST(request: NextRequest) {
    try {
        const { roomId, userName } = await request.json();

        if (!roomId) {
            return NextResponse.json(
                { success: false, error: 'roomId is required' },
                { status: 400 }
            );
        }

        // Create or get join link from MiroTalk SFU
        const response = await fetch(`${SFU_URL}/api/v1/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authorization': SFU_API_SECRET,
            },
            body: JSON.stringify({
                room: roomId,
                name: userName || 'Player',
                audio: true,
                video: false,
                screen: false,
                chat: true,
                token: {
                    username: userName || 'anonymous',
                    password: '',
                    presenter: false,
                    expire: '1h'
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Voice API] SFU error:', errorText);
            return NextResponse.json(
                { success: false, error: 'Failed to create voice room' },
                { status: 500 }
            );
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            joinUrl: data.join,
        });
    } catch (error) {
        console.error('[Voice API] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
