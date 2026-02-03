/**
 * Test script to verify Night Phase Auto-Timeout (Decentralized)
 * 
 * This simulates:
 * 1. Setting phaseDeadline to 10 seconds in the future
 * 2. Waiting for timeout to expire
 * 3. Checking if forcePhaseTimeout is called automatically by a RANDOM funded wallet
 */

const { createPublicClient, createWalletClient, http, keccak256, encodeAbiParameters, parseAbiParameters, parseEther } = require('viem');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');

const MAFIA_CONTRACT_ADDRESS = "0xa962880aceeaf638c597d78d324dab6fab5981b1";
const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
};

const MAFIA_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "rooms", "outputs": [{ "internalType": "uint64", "name": "id", "type": "uint64" }, { "internalType": "address", "name": "host", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint8", "name": "phase", "type": "uint8" }, { "internalType": "uint8", "name": "maxPlayers", "type": "uint8" }, { "internalType": "uint8", "name": "playersCount", "type": "uint8" }, { "internalType": "uint8", "name": "aliveCount", "type": "uint8" }, { "internalType": "uint16", "name": "dayCount", "type": "uint16" }, { "internalType": "uint8", "name": "currentShufflerIndex", "type": "uint8" }, { "internalType": "uint32", "name": "lastActionTimestamp", "type": "uint32" }, { "internalType": "uint32", "name": "phaseDeadline", "type": "uint32" }, { "internalType": "uint8", "name": "confirmedCount", "type": "uint8" }, { "internalType": "uint8", "name": "votedCount", "type": "uint8" }, { "internalType": "uint8", "name": "committedCount", "type": "uint8" }, { "internalType": "uint8", "name": "revealedCount", "type": "uint8" }, { "internalType": "uint8", "name": "keysSharedCount", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "forcePhaseTimeout", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const PHASE_NAMES = ["LOBBY", "SHUFFLING", "REVEAL", "DAY", "VOTING", "NIGHT", "ENDED"];

async function testTimeout() {
    console.log("=== Night Phase Auto-Timeout Test (Decentralized) ===\n");

    const hostPk = "0x031ccbb22faed61b423cb8d25f531a37934303ffb4293b7d17a041fbef1863ff";
    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const hostAccount = privateKeyToAccount(hostPk);
    const hostWallet = createWalletClient({ account: hostAccount, chain: somniaChain, transport: http() });

    // 1. Setup "Good Samaritan" (Random player)
    const samaritanPk = generatePrivateKey();
    const samaritanAccount = privateKeyToAccount(samaritanPk);
    const samaritanWallet = createWalletClient({ account: samaritanAccount, chain: somniaChain, transport: http() });

    console.log(`Host: ${hostAccount.address}`);
    console.log(`Samaritan (Random): ${samaritanAccount.address}`);

    // Fund Samaritan
    console.log("Funding Samaritan with 0.1 STT...");
    const fundHash = await hostWallet.sendTransaction({
        to: samaritanAccount.address,
        value: parseEther("0.1")
    });
    await client.waitForTransactionReceipt({ hash: fundHash });
    console.log("Funded! ✅");

    // Use Room 35
    const roomId = 35n;

    console.log(`[1] Checking Room #${roomId} state...`);
    const room = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'rooms',
        args: [roomId]
    });

    const phase = room[3];
    const phaseDeadline = Number(room[10]);
    const now = Math.floor(Date.now() / 1000);

    console.log(`   Phase: ${PHASE_NAMES[phase]} (${phase})`);
    console.log(`   Deadline: ${phaseDeadline} (${phaseDeadline > 0 ? `${phaseDeadline - now}s remaining` : 'not set'})`);

    if (phase !== 5) { // NIGHT = 5
        console.log(`\n⚠️  Room is not in NIGHT phase. Current phase: ${PHASE_NAMES[phase]}`);
        return;
    }

    if (phaseDeadline === 0) {
        console.log(`\n⚠️  phaseDeadline is not set (0). Cannot test timeout.`);
        return;
    }

    const remaining = Math.max(0, phaseDeadline - now);

    const performTimeout = async () => {
        console.log(`\n[3] Triggering forcePhaseTimeout as SAMARITAN (Not Host)...`);
        try {
            const tx = await samaritanWallet.writeContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'forcePhaseTimeout',
                args: [roomId]
            });

            console.log(`   Transaction sent: ${tx}`);
            await client.waitForTransactionReceipt({ hash: tx });

            console.log(`\n✅ SUCCESS! Phase timeout executed by NON-HOST.`);

            // Check new phase
            const newRoom = await client.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'rooms',
                args: [roomId]
            });

            console.log(`\n[RESULT] New Phase: ${PHASE_NAMES[newRoom[3]]}`);
        } catch (e) {
            console.error(`\n❌ Error calling forcePhaseTimeout:`, e.message);
        }
    };

    if (remaining > 0) {
        console.log(`\n[2] Waiting ${remaining} seconds for timeout...`);
        const interval = setInterval(async () => {
            const nowTick = Math.floor(Date.now() / 1000);
            const remainingTick = Math.max(0, phaseDeadline - nowTick);
            process.stdout.write(`\r   Time remaining: ${remainingTick}s...`);

            if (remainingTick === 0) {
                clearInterval(interval);
                await performTimeout();
            }
        }, 1000);
    } else {
        console.log(`\n[2] Timeout already expired.`);
        await performTimeout();
    }
}

testTimeout();
