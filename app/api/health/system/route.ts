import { NextResponse } from 'next/server';
import Redis from 'ioredis';

export const runtime = 'nodejs';

type ServiceCheck = {
  ok: boolean;
  status?: number;
  error?: string;
  latencyMs?: number;
};

function hasValue(value: string | undefined | null): boolean {
  return Boolean(value && value.trim());
}

function normalizeHttpUrl(raw: string | undefined, fallback: string): string {
  const value = (raw || '').trim();
  if (!value) return fallback;
  if (value.startsWith('https://') || value.startsWith('http://')) return value;
  if (value.startsWith('wss://')) return value.replace('wss://', 'https://');
  if (value.startsWith('ws://')) return value.replace('ws://', 'http://');
  return `https://${value}`;
}

async function checkHttp(url: string, timeoutMs = 3000): Promise<ServiceCheck> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-store' });
    return {
      ok: response.ok || response.status === 401,
      status: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.name === 'AbortError' ? 'timeout' : String(error?.message || 'request failed'),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkRedis(redisUrl?: string): Promise<ServiceCheck & { configured: boolean }> {
  if (!hasValue(redisUrl)) {
    return { ok: false, configured: false, error: 'REDIS_URL missing' };
  }

  const client = new Redis(redisUrl as string, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1500,
  });

  const startedAt = Date.now();
  try {
    await client.connect();
    const pong = await client.ping();
    return {
      ok: pong === 'PONG',
      configured: true,
      latencyMs: Date.now() - startedAt,
      error: pong === 'PONG' ? undefined : `unexpected ping response: ${pong}`,
    };
  } catch (error: any) {
    return {
      ok: false,
      configured: true,
      error: String(error?.message || 'redis ping failed'),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    try {
      await client.quit();
    } catch {
      // ignore
    }
  }
}

export async function GET() {
  const redisUrl = process.env.REDIS_URL;
  const gmUrl = normalizeHttpUrl(process.env.NEXT_PUBLIC_GM_SERVER_URL, 'https://gm.mafiaonchain.live');
  const livekitUrl = normalizeHttpUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL, 'https://livekit.mafiaonchain.live');

  const env = {
    nodeEnv: process.env.NODE_ENV || 'unknown',
    frontendPublic: {
      nextPublicActiveNetwork: hasValue(process.env.NEXT_PUBLIC_ACTIVE_NETWORK),
      nextPublicGmServerUrl: hasValue(process.env.NEXT_PUBLIC_GM_SERVER_URL),
      nextPublicLivekitUrl: hasValue(process.env.NEXT_PUBLIC_LIVEKIT_URL),
    },
    frontendServer: {
      redisUrl: hasValue(process.env.REDIS_URL),
      livekitApiKey: hasValue(process.env.LIVEKIT_API_KEY),
      livekitApiSecret: hasValue(process.env.LIVEKIT_API_SECRET),
    },
  };

  const [redis, gmHealth, livekitHealth] = await Promise.all([
    checkRedis(redisUrl),
    checkHttp(`${gmUrl.replace(/\/$/, '')}/health`),
    checkHttp(`${livekitUrl.replace(/\/$/, '')}/rtc/validate`),
  ]);

  const checks = {
    redis,
    gmBackend: gmHealth,
    livekitSignaling: livekitHealth,
  };

  const ok =
    env.frontendPublic.nextPublicActiveNetwork &&
    env.frontendPublic.nextPublicGmServerUrl &&
    env.frontendPublic.nextPublicLivekitUrl &&
    env.frontendServer.redisUrl &&
    env.frontendServer.livekitApiKey &&
    env.frontendServer.livekitApiSecret &&
    checks.redis.ok &&
    checks.gmBackend.ok &&
    checks.livekitSignaling.ok;

  return NextResponse.json(
    {
      ok,
      timestamp: new Date().toISOString(),
      env,
      checks,
      notes: [
        'All values are sanitized; secrets are never returned.',
        'NEXT_PUBLIC_* checks validate frontend server env presence and service reachability.',
        'A broken client build can still happen if deploy skipped env-file build interpolation.',
      ],
    },
    { status: ok ? 200 : 503 }
  );
}
