const snarkjs = require('snarkjs');
const { createPublicClient, http } = require('viem');
const path = require('path');

// Configuration from your project
const MAFIA_CONTRACT_ADDRESS = "0x45f2018503668c8b91746912d65b32f50d3addae";
const VERIFIER_CONTRACT_ADDRESS = "0x13467da1c154c4e0e8674744edf734985d66b4c9";

const MAFIA_ABI = [
    {
        "inputs": [],
        "name": "zkVerifier",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    }
];


const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
};

const VERIFIER_ABI = [
    {
        "inputs": [
            { "internalType": "uint256[2]", "name": "_pA", "type": "uint256[2]" },
            { "internalType": "uint256[2][2]", "name": "_pB", "type": "uint256[2][2]" },
            { "internalType": "uint256[2]", "name": "_pC", "type": "uint256[2]" },
            { "internalType": "uint256[5]", "name": "_pubSignals", "type": "uint256[5]" }
        ],
        "name": "verifyProof",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    }
];

async function run() {
    console.log("--- SYSTEM-WIDE ZK LINKAGE TEST ---");

    const client = createPublicClient({
        chain: somniaChain,
        transport: http()
    });

    console.log(`\n1. Checking MafiaPortal linkage...`);
    const linkedVerifier = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'zkVerifier'
    });

    console.log("Portal target:", MAFIA_CONTRACT_ADDRESS);
    console.log("Linked Verifier:", linkedVerifier);
    console.log("Expected Verifier:", VERIFIER_CONTRACT_ADDRESS);

    if (linkedVerifier.toLowerCase() === VERIFIER_CONTRACT_ADDRESS.toLowerCase()) {
        console.log("✅ [SUCCESS] MafiaPortal is correctly linked to the new Verifier.");
    } else {
        console.log("❌ [FAILURE] MafiaPortal is still pointing to the WRONG Verifier!");
        console.log("Please run: MafiaPortal.setZkVerifier('" + VERIFIER_CONTRACT_ADDRESS + "')");
        return;
    }

    // Test inputs
    const roomId = 888;
    const mafiaCount = 0;
    const townCount = 4;

    console.log(`\n1. Generating ZK proof for Room #${roomId}...`);

    const wasmPath = path.join(process.cwd(), 'public', 'mafia_outcome.wasm');
    const zkeyPath = path.join(process.cwd(), 'public', 'mafia_outcome_0001.zkey');

    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            { roomId, mafiaCount, townCount },
            wasmPath,
            zkeyPath
        );

        console.log("✅ Proof generated successfully.");

        console.log("\n2. Exporting Solidity CallData (The proper way)...");
        const callData = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);

        // Parse the callData string into a, b, c, inputs
        const argv = callData
            .replace(/["\[\]\s]/g, "")
            .split(",")
            .map(x => BigInt(x));

        const a = [argv[0], argv[1]];
        const b = [
            [argv[2], argv[3]],
            [argv[4], argv[5]]
        ];
        const c = [argv[6], argv[7]];
        const inputs = argv.slice(8);

        console.log("\n3. Simulating call on Somnia Testnet (via RPC)...");

        const client = createPublicClient({
            chain: somniaChain,
            transport: http()
        });

        const result = await client.readContract({
            address: VERIFIER_CONTRACT_ADDRESS,
            abi: VERIFIER_ABI,
            functionName: 'verifyProof',
            args: [a, b, c, inputs]
        });

        if (result === true) {
            console.log("\n✅ [SUCCESS] The on-chain Verifier contract accepted the proof!");
            console.log("Math is 100% correct. Now you can use it in the game safely.");
        } else {
            console.log("\n❌ [FAILURE] The on-chain Verifier contract REJECTED the proof.");
            console.log("This means the contract on-chain still doesn't match your local keys.");
        }

    } catch (e) {
        console.error("\n❌ ERROR:", e.message);
    }
}

run();
