import { NextResponse } from 'next/server';
import path from 'path';
import * as snarkjs from 'snarkjs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomId, mafiaCount, townCount } = body;

        console.log(`[ZK-API] Generating proof for Room #${roomId}`);

        const wasmPath = path.join(process.cwd(), 'public', 'mafia_outcome.wasm');
        const zkeyPath = path.join(process.cwd(), 'public', 'mafia_outcome_0001.zkey');

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

        console.log(`[ZK-API] Success for Room #${roomId}`);

        return NextResponse.json({ proof, publicSignals });
    } catch (error: any) {
        console.error(`[ZK-API] Fail:`, error.message);
        return NextResponse.json({
            error: error.message || 'Unknown ZK error'
        }, { status: 500 });
    }
}
