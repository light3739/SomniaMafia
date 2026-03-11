import { NextResponse } from 'next/server';
import path from 'path';
import * as snarkjs from 'snarkjs';
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

        const { result, mafiaCount, townCount } = gmData;

        // 2. Generate ZK Proof
        console.log(`[API/CheckWin] ${result} detected! Generating ZK Proof in Node...`);

        const wasmPath = path.join(process.cwd(), 'public', 'mafia_outcome.wasm');
        const zkeyPath = path.join(process.cwd(), 'public', 'mafia_outcome_0001.zkey');

        // Add a timeout for ZK generation
        const proofPromise = (snarkjs as any).groth16.fullProve(
            {
                roomId: roomId.toString(),
                mafiaCount: mafiaCount.toString(),
                townCount: townCount.toString()
            },
            wasmPath,
            zkeyPath
        );

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('ZK Proof generation timed out')), 30000)
        );

        const { proof, publicSignals } = await Promise.race([proofPromise, timeoutPromise]) as any;

        console.log(`[API/CheckWin] ZK Proof generated. Formatting for Solidity...`);

        const callData = await (snarkjs as any).groth16.exportSolidityCallData(proof, publicSignals);
        const argv = callData
            .replace(/["\[\]\s]/g, "")
            .split(",")
            .map((x: string) => x.toString());

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
