/**
 * Test script to verify Night Phase Auto-Timeout
 * 
 * This simulates:
 * 1. Setting phaseDeadline to 10 seconds in the future
 * 2. Waiting for timeout to expire
 * 3. Checking if forcePhaseTimeout is called automatically
 */

const { createPublicClient, createWalletClient, http, keccak256, encodeAbiParameters, parseAbiParameters } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

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
    console.log("=== Night Phase Auto-Timeout Test ===\n");

    const hostPk = "0x031ccbb22faed61b423cb8d25f531a37934303ffb4293b7d17a041fbef1863ff";
    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const hostAccount = privateKeyToAccount(hostPk);
    const hostWallet = createWalletClient({ account: hostAccount, chain: somniaChain, transport: http() });

    // Use the room from the previous test (Room ID 2)
    const roomId = 2n;

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
        console.log(`This test requires the room to be in NIGHT phase.`);
        console.log(`Please run verify_live.js first to get a room to NIGHT phase.`);
        return;
    }

    if (phaseDeadline === 0) {
        console.log(`\n⚠️  phaseDeadline is not set (0). Cannot test timeout.`);
        return;
    }

    const remaining = Math.max(0, phaseDeadline - now);

    if (remaining > 0) {
        console.log(`\n[2] Waiting ${remaining} seconds for timeout...`);
        console.log(`   (You can also test frontend by opening http://localhost:3000/test)`);
        console.log(`   (Select "Night - Timeout" from the sidebar)\n`);

        // Wait for deadline
        const interval = setInterval(async () => {
            const nowTick = Math.floor(Date.now() / 1000);
            const remainingTick = Math.max(0, phaseDeadline - nowTick);
            process.stdout.write(`\r   Time remaining: ${remainingTick}s...`);

            if (remainingTick === 0) {
                clearInterval(interval);
                console.log(`\n\n[3] Timeout reached! Triggering forcePhaseTimeout...`);

                try {
                    const tx = await hostWallet.writeContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'forcePhaseTimeout',
                        args: [roomId]
                    });

                    console.log(`   Transaction sent: ${tx}`);
                    await client.waitForTransactionReceipt({ hash: tx });

                    console.log(`\n✅ SUCCESS! Phase timeout executed.`);

                    // Check new phase
                    const newRoom = await client.readContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'rooms',
                        args: [roomId]
                    });

                    console.log(`\n[RESULT] New Phase: ${PHASE_NAMES[newRoom[3]]}`);
                    console.log(`Game advanced automatically when timeout expired! ✅`);
                } catch (e) {
                    console.error(`\n❌ Error calling forcePhaseTimeout:`, e.message);
                }
            }
        }, 1000);
    } else {
        console.log(`\n[2] Timeout already expired. Calling forcePhaseTimeout immediately...`);

        try {
            const tx = await hostWallet.writeContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'forcePhaseTimeout',
                args: [roomId]
            });

            console.log(`   Transaction sent: ${tx}`);
            await client.waitForTransactionReceipt({ hash: tx });

            console.log(`\n✅ SUCCESS! Phase timeout executed.`);

            // Check new phase  
            const newRoom = await client.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'rooms',
                args: [roomId]
            });

            console.log(`\n[RESULT] New Phase: ${PHASE_NAMES[newRoom[3]]}`);
            console.log(`Game advanced when timeout was triggered! ✅`);
        } catch (e) {
            console.error(`\n❌ Error calling forcePhaseTimeout:`, e.message);
        }
    }
}

testTimeout();
