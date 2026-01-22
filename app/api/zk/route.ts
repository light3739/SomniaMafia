import { NextResponse } from 'next/server';
import path from 'path';
import * as snarkjs from 'snarkjs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { roomId: rawRoomId, mafiaCount, townCount } = body;
        const roomId = BigInt(rawRoomId).toString();

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

        console.log(`[ZK-API] Proof generated. Formatting for Solidity...`);

        // Use snarkjs helper to get the exact format for Solidity
        const callData = await (snarkjs as any).groth16.exportSolidityCallData(proof, publicSignals);

        // Parse the comma-separated string into an array of BigInts
        // Format: [pA, pB, pC, pubSignals]
        const argv = callData
            .replace(/["\[\]\s]/g, "")
            .split(",")
            .map((x: string) => x.toString()); // Keep as strings for JSON travel

        console.log(`[ZK-API] Success for Room #${roomId}`);

        return NextResponse.json({
            // Return in a structure that matches the contract's expectations
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
        console.error(`[ZK-API] Fail:`, error.message);
        return NextResponse.json({
            error: error.message || 'Unknown ZK error'
        }, { status: 500 });
    }
}
