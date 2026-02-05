import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for chat messages (in production, use Redis or database)
interface ChatMessage {
    id: string;
    sender: string;
    senderAddress: string;
    content: string;
    timestamp: number;
}

// Map: roomId_dayCount -> messages
const chatStorage = new Map<string, ChatMessage[]>();

// Cleanup old chats (older than 1 hour)
const cleanupOldChats = () => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, messages] of chatStorage.entries()) {
        if (messages.length > 0 && messages[messages.length - 1].timestamp < oneHourAgo) {
            chatStorage.delete(key);
        }
    }
};

// Run cleanup every 10 minutes
setInterval(cleanupOldChats, 10 * 60 * 1000);

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const dayCount = searchParams.get('dayCount');

    if (!roomId || !dayCount) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const key = `${roomId}_${dayCount}`;
    const messages = chatStorage.get(key) || [];

    return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { roomId, dayCount, senderAddress, senderName, content } = body;

        if (!roomId || !dayCount || !senderAddress || !senderName || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate content length
        if (content.length > 200) {
            return NextResponse.json({ error: 'Message too long (max 200 chars)' }, { status: 400 });
        }

        const key = `${roomId}_${dayCount}`;
        const messages = chatStorage.get(key) || [];

        // Limit to last 100 messages per room/day
        if (messages.length >= 100) {
            messages.shift();
        }

        const newMessage: ChatMessage = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sender: senderName,
            senderAddress: senderAddress,
            content: content.trim(),
            timestamp: Date.now()
        };

        messages.push(newMessage);
        chatStorage.set(key, messages);

        return NextResponse.json({ success: true, message: newMessage });
    } catch (error) {
        console.error('[Chat API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
