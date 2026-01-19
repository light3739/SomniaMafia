export interface ZKProof {
    a: [bigint, bigint];
    b: [[bigint, bigint], [bigint, bigint]];
    c: [bigint, bigint];
    inputs: [bigint, bigint, bigint, bigint]; // [ok, roomId, mafiaCount, townCount]
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
            throw new Error(errorData.error || 'Failed to generate ZK proof on server');
        }

        const { proof, publicSignals } = await response.json();

        console.log("[ZK] Proof received from server!");

        // Transformation for Solidity Groth16 Verifier
        // SnarkJS -> Solidity requires coordinate swaps in the B matrix
        return {
            a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
            b: [
                [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
                [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
            ],
            c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
            inputs: publicSignals.map((s: string) => BigInt(s)) as [bigint, bigint, bigint, bigint]
        };
    } catch (e) {
        console.error("[ZK] Proof generation failed:", e);
        throw e;
    }
};
