import { NextResponse } from 'next/server';
import { GM_SERVER_URL } from '@/contracts/config';

export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId } = await request.json();

        if (!rawRoomId) {
            return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        console.log(`[API/CheckWin] Checking Room #${roomId}`);

        // 1. Check Win Condition on GM Server
        console.log(`[API/CheckWin] Calling GM Server /win-check/${roomId}`);
        const gmRes = await fetch(`${GM_SERVER_URL}/win-check/${roomId}`);
        let gmData;
        try {
            gmData = await gmRes.json();
        } catch (e) {
            return NextResponse.json({ error: 'Failed to read GM Server response' }, { status: 500 });
        }

        if (!gmRes.ok) {
            return NextResponse.json({ error: gmData.error || 'GM Server check failed' }, { status: gmRes.status });
        }

        if (!gmData.winDetected || !gmData.result) {
            return NextResponse.json({
                winDetected: false,
                message: gmData.message || 'Game continues',
                phase: gmData.phase
            });
        }

        const { result } = gmData;

        // 2. Generate ZK Proof on GM Server (NEW)
        console.log(`[API/CheckWin] ${result} detected! Requesting ZK Proof from GM Server...`);
        
        const zkRes = await fetch(`${GM_SERVER_URL}/end-game-zk/${roomId}`, {
            method: "POST"
        });
        
        if (!zkRes.ok) {
            const zkError = await zkRes.json().catch(() => ({ error: 'Unknown ZK error' }));
            console.error(`[API/CheckWin] GM Server ZK generation failed:`, zkError);
            return NextResponse.json({ error: zkError.error || 'GM Server ZK generation failed' }, { status: zkRes.status });
        }
        
        const { callData } = await zkRes.json();

        // 3. Parse and return for the contract
        const argv = callData.replace(/["\[\]\s]/g, "").split(",");
        
        return NextResponse.json({
            winDetected: true,
            result,
            formatted: {
                a: [argv[0], argv[1]],
                b: [
                    [argv[2], argv[3]],
                    [argv[4], argv[5]]
                ],
                c: [argv[6], argv[7]],
                inputs: argv.slice(8)
            }
        });

    } catch (error: any) {
        console.error('[API/CheckWin] Error:', error);
        return NextResponse.json({ error: error.message || 'CheckWin failed' }, { status: 500 });
    }
}
