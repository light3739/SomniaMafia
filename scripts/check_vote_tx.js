/**
 * Check if VoteCast event exists in transaction receipt
 * This verifies whether the contract actually emits the event
 */

const { createPublicClient, http, decodeEventLog, parseAbiItem } = require('viem');

const MAFIA_CONTRACT_ADDRESS = "0xa962880aceeaf638c597d78d324dab6fab5981b1";

const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
};

// Last vote TX hash from test
const VOTE_TX_HASH = "0xd82ea2c19e09cc97d049ef3d9a8ab8a3d467a2eea435d35244d69d7543f10059";

async function checkVoteTxReceipt() {
    console.log("=== Checking Vote TX Receipt for VoteCast Event ===\n");

    const client = createPublicClient({
        chain: somniaChain,
        transport: http()
    });

    console.log(`TX Hash: ${VOTE_TX_HASH}\n`);

    try {
        const receipt = await client.getTransactionReceipt({ hash: VOTE_TX_HASH });

        console.log(`Status: ${receipt.status}`);
        console.log(`Block: ${receipt.blockNumber}`);
        console.log(`Gas Used: ${receipt.gasUsed}`);
        console.log(`Logs Count: ${receipt.logs.length}\n`);

        if (receipt.logs.length === 0) {
            console.log("❌ NO LOGS in transaction - event was NOT emitted!");
        } else {
            console.log("Logs found:\n");
            receipt.logs.forEach((log, i) => {
                console.log(`[Log ${i}]`);
                console.log(`  Address: ${log.address}`);
                console.log(`  Topics: ${JSON.stringify(log.topics)}`);
                console.log(`  Data: ${log.data}`);

                // VoteCast event topic
                // event VoteCast(uint256 indexed roomId, address voter, address target)
                const VOTE_CAST_TOPIC = "0xcfff1651bcea794952a516ce970ab17518a85210bd939aaeaac670a8d3e65ec7";

                if (log.topics[0] === VOTE_CAST_TOPIC) {
                    console.log(`  ✅ THIS IS VOTECAST EVENT!`);
                }
                console.log("");
            });
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

checkVoteTxReceipt().catch(console.error);
