import { NextRequest, NextResponse } from 'next/server';

const FUJI_RPC = 'https://api.avax-test.network/ext/bc/C/rpc';

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();

        const response = await fetch(FUJI_RPC, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Forward user-agent so the RPC node sees a normal client
                'User-Agent': req.headers.get('user-agent') ?? 'SomniaMafia/1.0',
            },
            body,
        });

        const data = await response.text();

        return new NextResponse(data, {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                // Explicit CORS headers for browser clients
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    } catch (err) {
        console.error('[/api/rpc/fuji] proxy error:', err);
        return NextResponse.json(
            { error: 'RPC proxy error', detail: String(err) },
            { status: 502 }
        );
    }
}

// Handle CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
