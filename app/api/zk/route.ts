import { NextResponse } from 'next/server';
import path from 'path';
import * as snarkjs from 'snarkjs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomId, mafiaCount, townCount } = body;

        console.log(`[API/ZK] Generating proof for Room #${roomId}: Mafia ${mafiaCount}, Town ${townCount}`);

        const wasmPath = path.join(process.cwd(), 'public', 'mafia_win.wasm');
        const zkeyPath = path.join(process.cwd(), 'public', 'mafia_win_0001.zkey');

        // Add a timeout for ZK generation
        const proofPromise = (snarkjs as any).groth16.fullProve(
            { roomId, mafiaCount, townCount },
            wasmPath,
            zkeyPath
        );

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('ZK Proof generation timed out')), 30000)
        );

        const { proof, publicSignals } = await Promise.race([proofPromise, timeoutPromise]) as any;

        console.log(`[API/ZK] ZK Proof generated successfully for Room #${roomId}`);

        return NextResponse.json({ proof, publicSignals });
    } catch (error: any) {
        console.error('[API/ZK] Error:', error);
        return NextResponse.json({
            error: error.message || 'Unknown ZK error',
            details: error.toString()
        }, { status: 500 });
    }
}
