import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const COOLDOWN_MS = 60_000;
const lastSent = new Map<string, number>();

function escapeMd(s: string): string {
    return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (m) => `\\${m}`);
}

async function sendTelegram(text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
            }),
        });
    } catch {
        // best-effort
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({} as any));
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';

        const entry = {
            receivedAt: new Date().toISOString(),
            ip,
            ...body,
        };

        console.warn('[session-fallback]', JSON.stringify(entry));

        const addr = String(body?.expectedAddr || 'unknown');
        const now = Date.now();
        const last = lastSent.get(addr) || 0;
        if (now - last >= COOLDOWN_MS) {
            lastSent.set(addr, now);

            const reason = body?.forceWallet
                ? 'forceWallet'
                : !body?.roomIdProvided
                    ? 'no roomId'
                    : !body?.storedRoom
                        ? 'no session'
                        : !body?.addrMatch
                            ? 'wallet mismatch'
                            : !body?.roomMatch
                                ? `room mismatch (${body?.expectedRoom} vs ${body?.storedRoom})`
                                : body?.expired
                                    ? 'expired'
                                    : 'unknown';

            const expiresInMs = typeof body?.expiresInMs === 'number' ? body.expiresInMs : null;
            const expiresMin = expiresInMs !== null ? (expiresInMs / 60000).toFixed(1) : 'n/a';
            const ageMin = typeof body?.sessionAgeMs === 'number' ? (body.sessionAgeMs / 60000).toFixed(1) : 'n/a';
            const tabPeers = body?.tabPeers ?? 'n/a';
            const visState = body?.visibilityState || 'n/a';
            const keysCount = Array.isArray(body?.mafiaKeys) ? body.mafiaKeys.length : 0;
            const eventId = String(body?.eventId || '').slice(0, 8);

            const lines = [
                `*Session\\-key fallback*`,
                `Event: \`${escapeMd(eventId)}\``,
                `Reason: \`${escapeMd(reason)}\``,
                `Addr: \`${escapeMd(addr.slice(0, 10))}...\``,
                `Room: \`${escapeMd(String(body?.expectedRoom || '?'))}\` / stored: \`${escapeMd(String(body?.storedRoom || 'none'))}\``,
                `Registered: \`${escapeMd(String(body?.registered))}\``,
                `Chain: \`${escapeMd(String(body?.chainId || '?'))}\``,
                `Age: \`${escapeMd(ageMin)}min\` / ExpiresIn: \`${escapeMd(expiresMin)}min\``,
                `TabPeers: \`${escapeMd(String(tabPeers))}\` / Vis: \`${escapeMd(visState)}\` / Keys: \`${escapeMd(String(keysCount))}\``,
                `IP: \`${escapeMd(ip)}\``,
            ];
            await sendTelegram(lines.join('\n'));
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message || 'log failed' }, { status: 200 });
    }
}
