import { NextRequest, NextResponse } from 'next/server';

const TESTNET_CHAIN_ID = 50312;
const GM_SERVER_URL =
  process.env.GM_SERVER_URL ||
  process.env.NEXT_PUBLIC_GM_SERVER_URL ||
  'https://gm-test.mafiaonchain.live';

function agentsHeaders(): HeadersInit {
  const key = process.env.AGENTS_API_KEY || process.env.GM_AGENTS_API_KEY;
  return {
    'Content-Type': 'application/json',
    ...(key ? { 'X-Agents-Api-Key': key } : {}),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomId = body?.roomId;
    const chainId = Number(body?.chainId ?? TESTNET_CHAIN_ID);

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }
    if (chainId !== TESTNET_CHAIN_ID) {
      return NextResponse.json(
        { error: 'Agent sweep is testnet-only' },
        { status: 400 }
      );
    }

    const gmRes = await fetch(`${GM_SERVER_URL}/agents/sweep-room`, {
      method: 'POST',
      headers: agentsHeaders(),
      body: JSON.stringify({
        roomId: String(roomId),
        chainId,
      }),
      cache: 'no-store',
    });
    const data = await gmRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: gmRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
