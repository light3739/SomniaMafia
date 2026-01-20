import { NextResponse } from 'next/server';
import Redis from 'ioredis';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    const redisUrl = process.env.REDIS_URL;
    const redisStatus = redisUrl ? 'Configured' : 'Missing';

    let redisCheck = 'Not attempted';
    let roomData = null;

    if (redisUrl) {
        try {
            const redis = new Redis(redisUrl);
            const pong = await redis.ping();
            redisCheck = `Connected (Ping: ${pong})`;

            if (roomId) {
                const data = await redis.hgetall(`room:secrets:${roomId}`);
                roomData = {
                    roomId,
                    count: Object.keys(data).length,
                    players: Object.keys(data)
                };
            }
            await redis.quit();
        } catch (e: any) {
            redisCheck = `Error: ${e.message}`;
        }
    }

    return NextResponse.json({
        redisStatus,
        redisCheck,
        roomData,
        env: {
            nodeEnv: process.env.NODE_ENV
        }
    });
}
