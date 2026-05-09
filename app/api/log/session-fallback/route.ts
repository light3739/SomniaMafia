import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';

        console.warn('[session-fallback]', JSON.stringify({
            receivedAt: new Date().toISOString(),
            ip,
            ...body,
        }));

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message || 'log failed' }, { status: 200 });
    }
}
