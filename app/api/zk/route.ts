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

        const { proof, publicSignals } = await (snarkjs as any).groth16.fullProve(
            { roomId, mafiaCount, townCount },
            wasmPath,
            zkeyPath
        );

        return NextResponse.json({ proof, publicSignals });
    } catch (error: any) {
        console.error('[API/ZK] Error:', error);
        return NextResponse.json({
            error: error.message || 'Unknown ZK error',
            details: error.toString()
        }, { status: 500 });
    }
}
