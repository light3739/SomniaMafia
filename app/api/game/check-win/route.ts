import { NextResponse } from 'next/server';
import { GM_SERVER_URL } from '@/contracts/config';

export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId, chainId } = await request.json();

        if (!rawRoomId) {
            return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        const cid = chainId || 50312;
        console.log(`[API/CheckWin] Checking Room #${roomId} on chain ${cid}`);


        console.log(`[API/CheckWin] Calling GM Server /win-check/${roomId}?chainId=${cid}`);
        const gmRes = await fetch(`${GM_SERVER_URL}/win-check/${roomId}?chainId=${cid}`);
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
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        try {
            const zkRes = await fetch(`${GM_SERVER_URL}/end-game-zk/${roomId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chainId: cid }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!zkRes.ok) {
                const zkError = await zkRes.json().catch(() => ({ error: 'Unknown ZK error' }));
                console.error(`[API/CheckWin] GM Server ZK generation failed:`, zkError);
                return NextResponse.json({ error: zkError.error || 'GM Server ZK generation failed' }, { status: zkRes.status });
            }
            
            const { callData } = await zkRes.json();
            
            // 3. Parse and return for the contract
            const argv = callData.replace(/["\[\]\s]/g, "").split(",");
console.log("[API/CheckWin] ZK Proof inputs:", argv.slice(8));
            
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
        } catch (e: any) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                return NextResponse.json({ error: 'ZK Proof generation timed out' }, { status: 504 });
            }
            throw e;
        }

    } catch (error: any) {
        console.error('[API/CheckWin] Error:', error);
        return NextResponse.json({ error: error.message || 'CheckWin failed' }, { status: 500 });
    }
}
