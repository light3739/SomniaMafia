import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';
import path from 'path';
import * as snarkjs from 'snarkjs';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

const FLAG_ACTIVE = 2; // From SomniaMafiaV4.sol

export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId } = await request.json();

        if (!rawRoomId) {
            return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        console.log(`[API/CheckWin] Checking Room #${roomId}`);

        // 1. Get room data from blockchain
        const roomData: any = await publicClient.readContract({
            address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
            abi: MAFIA_ABI,
            functionName: 'rooms',
            args: [BigInt(roomId)],
        });

        // roomData[3] is phase. 6 = ENDED
        const phase = Number(roomData[3]);
        if (phase === 0 || phase === 6) {
            return NextResponse.json({
                winDetected: false,
                phase,
                message: 'Game not in active phase or already ended'
            });
        }

        // 2. Get players from blockchain
        const players: any = await publicClient.readContract({
            address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
            abi: MAFIA_ABI,
            functionName: 'getPlayers',
            args: [BigInt(roomId)],
        });

        // 3. Match with server secrets
        const secrets = await ServerStore.getRoomSecrets(roomId.toString());
        if (!secrets) {
            return NextResponse.json({
                winDetected: false,
                message: 'No secrets found for this room'
            });
        }

        let mafiaCount = 0;
        let townCount = 0;
        const missingAddresses: string[] = [];

        for (const player of players) {
            const addr = player.wallet.toLowerCase();
            const flags = Number(player.flags);
            const isAlive = (flags & FLAG_ACTIVE) !== 0;

            if (isAlive) {
                const secret = secrets[addr];
                if (secret) {
                    // Role Mapping: MAFIA = 1, DOCTOR = 2, DETECTIVE = 3, CIVILIAN = 4
                    if (Number(secret.role) === 1) {
                        mafiaCount++;
                    } else {
                        townCount++;
                    }
                } else {
                    missingAddresses.push(addr);
                }
            }
        }

        const missingSecrets = missingAddresses.length;
        if (missingSecrets > 0) {
            console.log(`[API/CheckWin] Room #${roomId}: MISSING SECRETS for: ${missingAddresses.join(', ')}`);
        }

        console.log(`[API/CheckWin] Room #${roomId}: Mafia=${mafiaCount}, Town=${townCount}, Missing Secrets=${missingSecrets}`);

        // 4. Check Win Condition
        let result = null;

        // We only declare a win if we have ALL secrets for ALIVE players
        if (missingSecrets === 0) {
            if (mafiaCount === 0) {
                result = 'TOWN_WIN';
            } else if (mafiaCount >= townCount) {
                result = 'MAFIA_WIN';
            }
        }

        if (result) {
            // 5. Generate ZK Proof
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
        }

        return NextResponse.json({
            winDetected: false,
            message: missingSecrets > 0
                ? 'Waiting for secrets to sync'
                : 'Game continues'
        });

    } catch (error: any) {
        console.error('[API/CheckWin] Error:', error);
        return NextResponse.json({ error: error.message || 'CheckWin failed' }, { status: 500 });
    }
}
