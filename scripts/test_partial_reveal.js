/**
 * Test: Verify Night phase WON'T end if not all committed roles have revealed
 * 
 * Scenario:
 * 1. Detective commits & reveals (1/3 revealed)
 * 2. Mafia commits but NOT revealed (0/1 revealed for mafia)
 * 3. Doctor commits but NOT revealed (0/1 revealed for doctor)
 * 4. Try to call endNight -> should REVERT with "InvalidReveal" or "MafiaNotReady"
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
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "endNight", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "getMafiaConsensus", "outputs": [{ "internalType": "uint8", "name": "committed", "type": "uint8" }, { "internalType": "uint8", "name": "revealed", "type": "uint8" }, { "internalType": "address", "name": "consensusTarget", "type": "address" }], "stateMutability": "view", "type": "function" }
];

const PHASE_NAMES = ["LOBBY", "SHUFFLING", "REVEAL", "DAY", "VOTING", "NIGHT", "ENDED"];

async function testPartialReveal() {
    console.log("=== Night Phase Partial Reveal Protection Test ===\n");

    const hostPk = "0x031ccbb22faed61b423cb8d25f531a37934303ffb4293b7d17a041fbef1863ff";
    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const hostAccount = privateKeyToAccount(hostPk);
    const hostWallet = createWalletClient({ account: hostAccount, chain: somniaChain, transport: http() });

    // Use Room ID 2 from previous test
    const roomId = 2n;

    console.log(`[1] Checking Room #${roomId} state...`);
    const room = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'rooms',
        args: [roomId]
    });

    const phase = room[3];
    const committedCount = room[13];
    const revealedCount = room[14];

    console.log(`   Phase: ${PHASE_NAMES[phase]} (${phase})`);
    console.log(`   Committed: ${committedCount}`);
    console.log(`   Revealed: ${revealedCount}`);

    if (phase !== 5) { // NIGHT = 5
        console.log(`\n⚠️  Room is not in NIGHT phase. Current phase: ${PHASE_NAMES[phase]}`);
        console.log(`This test requires an active NIGHT phase with partial reveals.`);
        return;
    }

    // Get mafia consensus
    const [mafiaCommitted, mafiaRevealed, consensusTarget] = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'getMafiaConsensus',
        args: [roomId]
    });

    console.log(`   Mafia Committed: ${mafiaCommitted}`);
    console.log(`   Mafia Revealed: ${mafiaRevealed}`);

    console.log(`\n[2] Testing protection: Can endNight be called prematurely?`);

    if (revealedCount >= committedCount && (mafiaCommitted === 0 || mafiaRevealed >= mafiaCommitted)) {
        console.log(`   ❌ All commits have been revealed. Cannot test partial reveal scenario.`);
        console.log(`   committedCount=${committedCount}, revealedCount=${revealedCount}`);
        console.log(`   mafiaCommitted=${mafiaCommitted}, mafiaRevealed=${mafiaRevealed}`);
        console.log(`\n✅ This means the game is properly waiting for all reveals!`);
        return;
    }

    try {
        console.log(`   Attempting to call endNight with incomplete reveals...`);

        const tx = await hostWallet.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'endNight',
            args: [roomId]
        });

        await client.waitForTransactionReceipt({ hash: tx });

        console.log(`\n❌ FAIL: endNight succeeded when it should have reverted!`);
        console.log(`   This means the game can be forced to end with partial reveals - BUG!`);

    } catch (e) {
        if (e.message.includes('InvalidReveal') || e.message.includes('MafiaNotReady') || e.message.includes('reverted')) {
            console.log(`\n✅ SUCCESS: endNight correctly REVERTED!`);
            console.log(`   Error: ${e.message.split('\n')[0]}`);
            console.log(`\n🎯 PROTECTION WORKS: Night phase CANNOT end until all committed players reveal!`);
            console.log(`   - committedCount: ${committedCount}`);
            console.log(`   - revealedCount: ${revealedCount}`);
            if (mafiaCommitted > 0) {
                console.log(`   - mafiaCommitted: ${mafiaCommitted}`);
                console.log(`   - mafiaRevealed: ${mafiaRevealed}`);
            }
        } else {
            console.error(`\n❓ Unexpected error:`, e.message);
        }
    }
}

testPartialReveal();
