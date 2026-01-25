/**
 * Test script to fetch past VoteCast events from the blockchain
 * This verifies the event structure is correct and events are being emitted
 */

const { createPublicClient, http, parseAbiItem } = require('viem');

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

async function fetchPastVoteEvents() {
    console.log("=== Fetching Past VoteCast Events ===\n");

    const client = createPublicClient({
        chain: somniaChain,
        transport: http()
    });

    // Get current block
    const blockNumber = await client.getBlockNumber();
    console.log(`Current block: ${blockNumber}`);

    // Look at last 1000 blocks (RPC limit)
    const fromBlock = blockNumber - 1000n;
    console.log(`Searching from block ${fromBlock} to ${blockNumber}...\n`);

    try {
        const logs = await client.getLogs({
            address: MAFIA_CONTRACT_ADDRESS,
            event: parseAbiItem('event VoteCast(uint256 indexed roomId, address voter, address target)'),
            fromBlock: fromBlock,
            toBlock: blockNumber
        });

        if (logs.length === 0) {
            console.log("No VoteCast events found in the last 10000 blocks.");
            console.log("This means no votes were cast recently, or maybe a different contract address.");
        } else {
            console.log(`Found ${logs.length} VoteCast events:\n`);

            // Show last 10 events
            const recentLogs = logs.slice(-10);
            recentLogs.forEach((log, i) => {
                console.log(`[${i + 1}] 🗳️ VoteCast Event`);
                console.log(`    Room ID: ${log.args.roomId}`);
                console.log(`    Voter: ${log.args.voter}`);
                console.log(`    Target: ${log.args.target}`);
                console.log(`    Block: ${log.blockNumber}`);
                console.log(`    TX: ${log.transactionHash}\n`);
            });
        }
    } catch (e) {
        console.error("Error fetching logs:", e.message);
    }
}

fetchPastVoteEvents().catch(console.error);
