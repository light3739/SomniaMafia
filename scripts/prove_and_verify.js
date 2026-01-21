const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');

async function main() {
    console.log("🚀 Starting Prove & Verify Test...");

    const wasmPath = path.join(process.cwd(), 'public', 'mafia_outcome.wasm');
    const zkeyPath = path.join(process.cwd(), 'public', 'mafia_outcome_0001.zkey');

    // 1. Generate ZK Proof
    console.log("Generating ZK Proof...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        { roomId: '12', mafiaCount: '0', townCount: '3' },
        wasmPath,
        zkeyPath
    );

    console.log("Proof Generated.");
    // console.log("Proof:", JSON.stringify(proof, null, 2));
    console.log("Signals:", publicSignals);

    // 2. Export Verification Key
    console.log("Exporting VK...");
    const vKey = await snarkjs.zKey.exportVerificationKey(zkeyPath);

    // 3. Verify Locally
    console.log("Verifying...");
    const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    if (res === true) {
        console.log("✅ Verification SUCCESS!");
    } else {
        console.error("❌ Verification FAILED!");
        console.error("The .wasm and .zkey files might be mismatched or corrupted.");
    }
}

main().catch(console.error);
