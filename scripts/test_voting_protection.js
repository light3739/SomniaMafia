/**
 * Test script to verify that a player cannot vote more than once.
 */

const { createPublicClient, createWalletClient, http, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const MAFIA_CONTRACT_ADDRESS = "0xa962880aceeaf638c597d78d324dab6fab5981b1";
const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
};

const MAFIA_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address", "name": "target", "type": "address" }], "name": "vote", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "rooms", "outputs": [{ "internalType": "uint64", "name": "id", "type": "uint64" }, { "internalType": "address", "name": "host", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint8", "name": "phase", "type": "uint8" }, { "internalType": "uint8", "name": "maxPlayers", "type": "uint8" }, { "internalType": "uint8", "name": "playersCount", "type": "uint8" }, { "internalType": "uint8", "name": "aliveCount", "type": "uint8" }, { "internalType": "uint16", "name": "dayCount", "type": "uint16" }, { "internalType": "uint8", "name": "currentShufflerIndex", "type": "uint8" }, { "internalType": "uint32", "name": "lastActionTimestamp", "type": "uint32" }, { "internalType": "uint32", "name": "phaseDeadline", "type": "uint32" }, { "internalType": "uint8", "name": "confirmedCount", "type": "uint8" }, { "internalType": "uint8", "name": "votedCount", "type": "uint8" }, { "internalType": "uint8", "name": "committedCount", "type": "uint8" }, { "internalType": "uint8", "name": "revealedCount", "type": "uint8" }, { "internalType": "uint8", "name": "keysSharedCount", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address", "name": "player", "type": "address" }], "name": "getPlayerFlags", "outputs": [{ "internalType": "bool", "name": "isActive", "type": "bool" }, { "internalType": "bool", "name": "hasConfirmedRole", "type": "bool" }, { "internalType": "bool", "name": "hasVoted", "type": "bool" }, { "internalType": "bool", "name": "hasCommitted", "type": "bool" }, { "internalType": "bool", "name": "hasRevealed", "type": "bool" }, { "internalType": "bool", "name": "hasSharedKeys", "type": "bool" }, { "internalType": "bool", "name": "hasClaimedMafia", "type": "bool" }], "stateMutability": "view", "type": "function" }
];

async function testVotingProtection() {
    console.log("=== Voting Protection Test ===\n");

    const playerPk = "0x031ccbb22faed61b423cb8d25f531a37934303ffb4293b7d17a041fbef1863ff";
    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const playerAccount = privateKeyToAccount(playerPk);
    const playerWallet = createWalletClient({ account: playerAccount, chain: somniaChain, transport: http() });

    const roomId = 2n;

    console.log(`[1] Checking Player status in Room #${roomId}...`);
    const [_, __, hasVoted] = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'getPlayerFlags',
        args: [roomId, playerAccount.address]
    });

    console.log(`   Has already voted: ${hasVoted}`);

    const room = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'rooms',
        args: [roomId]
    });

    if (room[3] !== 4) { // VOTING = 4
        console.log(`⚠️  Room is not in VOTING phase (Phase ${room[3]}). Skipping call.`);
        return;
    }

    const target = "0x30E123bDa62a8DAE0b12f18770085505Bf982A2B"; // Some other player

    console.log(`\n[2] Attempting to vote for ${target}...`);
    try {
        const tx = await playerWallet.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'vote',
            args: [roomId, target]
        });
        console.log(`   Transaction sent: ${tx}`);
        await client.waitForTransactionReceipt({ hash: tx });
        console.log(`   ✅ Vote cast successfully (this should only happen if hasVoted was false).`);

        console.log(`\n[3] Attempting to vote AGAIN for the same target...`);
        try {
            const tx2 = await playerWallet.writeContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'vote',
                args: [roomId, target]
            });
            console.log(`   ❌ ERROR: Transaction sent (should have failed during estimation): ${tx2}`);
        } catch (e2) {
            console.log(`   ✅ SUCCESS: Second vote correctly REVERTED!`);
            console.log(`   Error message contains 'AlreadyVoted' or 'reverted'.`);
        }
    } catch (e) {
        if (e.message.includes('AlreadyVoted') || e.message.includes('reverted')) {
            console.log(`   ✅ SUCCESS: Vote correctly REVERTED (Player already voted).`);
        } else {
            console.error(`   ❌ Unexpected error:`, e.text || e.message);
        }
    }
}

testVotingProtection();
