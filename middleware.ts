import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── Simple Edge-compatible Rate Limiter ─────────────────────────────────────
//
// Next.js middleware runs in the Edge Runtime (no Node APIs like ioredis).
// We use a simple in-memory Map as a sliding window counter.
// For production with multiple replicas, replace with Upstash Redis (edge-compatible).
//
// Rules:
//   /api/game/discussion  — 120 req/min  (polling route, called every 1s per player)
//   /api/game/*           — 60 req/min   (signed game actions)
//   /api/*                — 30 req/min   (everything else)
//

interface WindowEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, WindowEntry>();

function getLimit(pathname: string): { max: number; windowMs: number } {
    if (pathname.startsWith('/api/game/discussion')) {
        return { max: 120, windowMs: 60_000 }; // 2 req/sec — polling is OK
    }
    if (pathname.startsWith('/api/game/')) {
        return { max: 60, windowMs: 60_000 };   // 1 req/sec — game actions
    }
    if (pathname.startsWith('/api/')) {
        return { max: 30, windowMs: 60_000 };   // token, health, etc.
    }
    return { max: Infinity, windowMs: 60_000 }; // non-API routes: no limit
}

function getClientIp(req: NextRequest): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'
    );
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const { max, windowMs } = getLimit(pathname);

    // Skip non-API routes and unlimited ones
    if (max === Infinity) return NextResponse.next();

    const ip = getClientIp(request);
    const key = `${ip}:${pathname.split('/').slice(0, 4).join('/')}`; // group by /api/game/route
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
        // New window
        store.set(key, { count: 1, resetAt: now + windowMs });
    } else {
        entry.count++;
        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
            return NextResponse.json(
                { error: `Rate limit exceeded. Retry after ${retryAfter}s.` },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(retryAfter),
                        'X-RateLimit-Limit': String(max),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
                    },
                }
            );
        }
    }

    // Periodically clean up expired entries to avoid memory leak
    if (store.size > 10_000) {
        for (const [k, v] of store) {
            if (now >= v.resetAt) store.delete(k);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/api/:path*'],
};
