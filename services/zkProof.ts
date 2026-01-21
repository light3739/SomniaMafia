export interface ZKProof {
    a: [bigint, bigint];
    b: [[bigint, bigint], [bigint, bigint]];
    c: [bigint, bigint];
    inputs: [bigint, bigint, bigint, bigint, bigint]; // [townWin, mafiaWin, roomId, mafiaCount, townCount]
}

/**
 * Generates an end-game ZK proof using the server-side API.
 * This offloads heavy computation from the client and ensures reliability.
 */
export const generateEndGameProof = async (
    roomId: bigint,
    mafiaCount: number,
    townCount: number
): Promise<ZKProof> => {
    console.log("[ZK] Requesting Server Proof...", { roomId: roomId.toString(), mafiaCount, townCount });

    try {
        const response = await fetch('/api/zk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId: roomId.toString(),
                mafiaCount,
                townCount
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Proof generation failed');
        }

        const { formatted } = await response.json();

        console.log("[ZK] Formatted proof received from server!", formatted);

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
