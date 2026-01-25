/**
 * Test eth_getLogs directly to see if we can retrieve VoteCast events
 */

const { createPublicClient, http, parseAbiItem } = require('viem');

const MAFIA_CONTRACT_ADDRESS = "0xa962880aceeaf638c597d78d324dab6fab5981b1";

const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
};

async function testGetLogs() {
    console.log("=== Testing eth_getLogs for VoteCast Events ===\n");

    const client = createPublicClient({
        chain: somniaChain,
        transport: http()
    });

    // Get current block
    const currentBlock = await client.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);

    // Look at last 100 blocks
    const fromBlock = currentBlock - 100n;
    console.log(`Searching blocks ${fromBlock} to ${currentBlock}...\n`);

    try {
        const logs = await client.getLogs({
            address: MAFIA_CONTRACT_ADDRESS,
            event: parseAbiItem('event VoteCast(uint256 indexed roomId, address voter, address target)'),
            fromBlock: fromBlock,
            toBlock: currentBlock
        });

        console.log(`Found ${logs.length} VoteCast events!\n`);

        logs.forEach((log, i) => {
            console.log(`[${i + 1}] VoteCast Event`);
            console.log(`    Room: ${log.args.roomId}`);
            console.log(`    Voter: ${log.args.voter}`);
            console.log(`    Target: ${log.args.target}`);
            console.log(`    Block: ${log.blockNumber}`);
            console.log(`    TX: ${log.transactionHash}\n`);
        });

        if (logs.length > 0) {
            console.log("✅ eth_getLogs WORKS! Events are retrievable.");
        } else {
            console.log("⚠️ No events found in last 100 blocks.");
        }
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

testGetLogs().catch(console.error);
