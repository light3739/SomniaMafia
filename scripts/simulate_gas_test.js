const { createPublicClient, http } = require('viem');
const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');

// Contract Address & ABI
const MAFIA_CONTRACT_ADDRESS = '0xb58130d6183844b3bfb28ff1ffc96825eee82be3';
const MAFIA_ABI = require('../contracts/MafiaPortal.json').abi;

// Client Setup
const client = createPublicClient({
    chain: {
        id: 50312,
        name: 'Somnia Testnet',
        rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
        nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 }
    },
    transport: http()
});

async function main() {
    console.log("🚀 Starting Gas Simulation Test...");

    // 1. Generate ZK Proof
    console.log("Generating ZK Proof...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        { roomId: '12', mafiaCount: '0', townCount: '3' }, // Input showing Town Win
        path.join(process.cwd(), 'public/mafia_outcome.wasm'),
        path.join(process.cwd(), 'public/mafia_outcome_0001.zkey')
    );

    // 2. Format Proof for Contract
    const a = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const b = [
        [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
        [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]
    ];
    const c = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];
    const inputs = publicSignals.map(s => BigInt(s));

    console.log("Proof Generated. Simulating Transaction...");

    // 3. Estimate Gas
    try {
        // Use a random address with likely 0 balance to see if it triggers the high estimate
        // Or generic simulation using an account derived here is tricky without private key
        // BUT estimateContractGas works without funds if we just want the number (usually) 
        // unless the RPC checks balance first. 
        // Let's use the random address from logs that failed to see if we repro: 0xe40f2d3952C0625f16D3adB13C27757E50f351e7
        const account = '0xe40f2d3952C0625f16D3adB13C27757E50f351e7';

        const gasEstimate = await client.estimateContractGas({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'endGameZK',
            args: [12n, a, b, c, inputs], // Room 12 matches input
            account: account,
            // stateOverride can be used to fake balance but viem/somnia might not support it fully
        });

        console.log(`\n✅ ESTIMATED GAS: ${gasEstimate.toString()}`);
        console.log(`   (Normal usage is ~500,000. 68M is definitely an error)`);

    } catch (e) {
        console.log("\n❌ Simulation Failed:");
        console.log(e.shortMessage || e.message);
        if (e.cause) console.log("Cause:", e.cause);
    }
}

main().catch(console.error);
