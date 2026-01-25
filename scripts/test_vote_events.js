/**
 * Test script to verify VoteCast event listening works
 * This simulates what the frontend does with useWatchContractEvent
 */

const { createPublicClient, http } = require('viem');

const MAFIA_CONTRACT_ADDRESS = "0xa962880aceeaf638c597d78d324dab6fab5981b1";

const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
};

// VoteCast event ABI
const VOTE_CAST_ABI = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "roomId", "type": "uint256" },
            { "indexed": false, "name": "voter", "type": "address" },
            { "indexed": false, "name": "target", "type": "address" }
        ],
        "name": "VoteCast",
        "type": "event"
    }
];

async function testVoteEventListener() {
    console.log("=== VoteCast Event Listener Test ===\n");

    const client = createPublicClient({
        chain: somniaChain,
        transport: http()
    });

    console.log("[1] Setting up VoteCast event watcher...");
    console.log("    Contract:", MAFIA_CONTRACT_ADDRESS);
    console.log("    Listening for VoteCast events...\n");

    // Watch for VoteCast events (same as useWatchContractEvent does)
    const unwatch = client.watchContractEvent({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: VOTE_CAST_ABI,
        eventName: 'VoteCast',
        onLogs: (logs) => {
            logs.forEach(log => {
                const { roomId, voter, target } = log.args;
                console.log("🗳️ VoteCast Event Detected!");
                console.log(`   Room ID: ${roomId}`);
                console.log(`   Voter: ${voter}`);
                console.log(`   Target: ${target}`);
                console.log(`   Block: ${log.blockNumber}`);
                console.log(`   TX Hash: ${log.transactionHash}\n`);
            });
        },
        onError: (error) => {
            console.error("❌ Error watching events:", error.message);
        }
    });

    console.log("✅ Event watcher active. Watching for 60 seconds...");
    console.log("   (Vote in a game to see events appear here)\n");

    // Keep alive for 60 seconds
    await new Promise(resolve => setTimeout(resolve, 60000));

    unwatch();
    console.log("\n[2] Test complete. Stopped listening.");
}

testVoteEventListener().catch(console.error);
