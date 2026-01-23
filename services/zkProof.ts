export interface ZKProof {
    a: [bigint, bigint];
    b: [[bigint, bigint], [bigint, bigint]];
    c: [bigint, bigint];
    inputs: [bigint, bigint, bigint, bigint, bigint]; // [townWin, mafiaWin, roomId, mafiaCount, townCount]
}

/**
 * Generates an end-game ZK proof using the server-side API.
 * Uses /api/game/check-win which validates game state and generates proof.
 */
export const generateEndGameProof = async (
    roomId: bigint,
    _mafiaCount: number,  // Unused - server calculates from secrets
    _townCount: number    // Unused - server calculates from secrets  
): Promise<ZKProof> => {
    console.log("[ZK] Requesting Server Proof via check-win...", { roomId: roomId.toString() });

    try {
        const response = await fetch('/api/game/check-win', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: roomId.toString()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Proof generation failed');
        }

        const data = await response.json();

        if (!data.winDetected) {
            throw new Error(data.message || 'No win condition detected');
        }

        const { formatted } = data;

        console.log("[ZK] Formatted proof received from server!");

        if (!formatted || !formatted.a) {
            throw new Error("Invalid proof format received from server");
        }

        return {
            a: [BigInt(formatted.a[0]), BigInt(formatted.a[1])],
            b: [
                [BigInt(formatted.b[0][0]), BigInt(formatted.b[0][1])],
                [BigInt(formatted.b[1][0]), BigInt(formatted.b[1][1])]
            ],
            c: [BigInt(formatted.c[0]), BigInt(formatted.c[1])],
            inputs: formatted.inputs.map((s: string) => BigInt(s)) as [bigint, bigint, bigint, bigint, bigint]
        };
    } catch (e) {
        console.error("[ZK] Proof generation failed:", e);
        throw e;
    }
};
