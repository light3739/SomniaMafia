/**
 * Full game simulation with VoteCast event verification using MANUAL POLLING
 * Simulates the fix implemented in the frontend: using getLogs polling instead of watchContractEvent
 */

const { createPublicClient, createWalletClient, http, parseEther, keccak256, encodeAbiParameters, parseAbiParameters, parseAbiItem } = require('viem');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');

const MAFIA_CONTRACT_ADDRESS = "0xa962880aceeaf638c597d78d324dab6fab5981b1";
const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
};

const MAFIA_ABI = [
    { "inputs": [{ "internalType": "string", "name": "roomName", "type": "string" }, { "internalType": "uint8", "name": "maxPlayers", "type": "uint8" }, { "internalType": "string", "name": "nickname", "type": "string" }, { "internalType": "bytes", "name": "publicKey", "type": "bytes" }, { "internalType": "address", "name": "sessionAddress", "type": "address" }], "name": "createAndJoin", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "string", "name": "nickname", "type": "string" }, { "internalType": "bytes", "name": "publicKey", "type": "bytes" }, { "internalType": "address", "name": "sessionAddress", "type": "address" }], "name": "joinRoom", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "startGame", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "deckHash", "type": "bytes32" }], "name": "commitDeck", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "string[]", "name": "deck", "type": "string[]" }, { "internalType": "string", "name": "salt", "type": "string" }], "name": "revealDeck", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address[]", "name": "recipients", "type": "address[]" }, { "internalType": "bytes[]", "name": "encryptedKeys", "type": "bytes[]" }], "name": "shareKeysToAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "roleHash", "type": "bytes32" }], "name": "commitAndConfirmRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "startVoting", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address", "name": "target", "type": "address" }], "name": "vote", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "rooms", "outputs": [{ "internalType": "uint64", "name": "id", "type": "uint64" }, { "internalType": "address", "name": "host", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint8", "name": "phase", "type": "uint8" }, { "internalType": "uint8", "name": "maxPlayers", "type": "uint8" }, { "internalType": "uint8", "name": "playersCount", "type": "uint8" }, { "internalType": "uint8", "name": "aliveCount", "type": "uint8" }, { "internalType": "uint16", "name": "dayCount", "type": "uint16" }, { "internalType": "uint8", "name": "currentShufflerIndex", "type": "uint8" }, { "internalType": "uint32", "name": "lastActionTimestamp", "type": "uint32" }, { "internalType": "uint32", "name": "phaseDeadline", "type": "uint32" }, { "internalType": "uint8", "name": "confirmedCount", "type": "uint8" }, { "internalType": "uint8", "name": "votedCount", "type": "uint8" }, { "internalType": "uint8", "name": "committedCount", "type": "uint8" }, { "internalType": "uint8", "name": "revealedCount", "type": "uint8" }, { "internalType": "uint8", "name": "keysSharedCount", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "getPlayers", "outputs": [{ "components": [{ "internalType": "address", "name": "wallet", "type": "address" }, { "internalType": "string", "name": "nickname", "type": "string" }, { "internalType": "bytes", "name": "publicKey", "type": "bytes" }, { "internalType": "uint32", "name": "flags", "type": "uint32" }], "internalType": "struct SomniaMafia.Player[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }
];

const PHASE_NAMES = ["LOBBY", "SHUFFLING", "REVEAL", "DAY", "VOTING", "NIGHT", "ENDED"];

// Track received vote events
let votesReceived = new Set(); // Using Set to track by TX hash to detect duplicates if any

async function run() {
    console.log("=== FULL VOTING EVENT TEST (MANUAL POLLING) ===\n");

    const hostPk = "0x031ccbb22faed61b423cb8d25f531a37934303ffb4293b7d17a041fbef1863ff";
    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const hostAccount = privateKeyToAccount(hostPk);
    const hostWallet = createWalletClient({ account: hostAccount, chain: somniaChain, transport: http() });

    console.log(`[HOST] ${hostAccount.address}`);
    const wait = (ms = 3000) => new Promise(r => setTimeout(r, ms));

    // Capture start block for polling
    const startBlock = await client.getBlockNumber();
    console.log(`[1] Starting block: ${startBlock}`);

    // Create room
    console.log("[2] Creating room...");
    const createHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'createAndJoin',
        args: ["Poll Test Room", 5, "Host", "0x00", "0x0000000000000000000000000000000000000000"]
    });
    const createReceipt = await client.waitForTransactionReceipt({ hash: createHash });
    const roomId = BigInt(createReceipt.logs[0].topics[1]);
    console.log(`✅ Room ID: ${roomId}\n`);

    // Create and fund bots
    console.log("[3] Creating 4 bots...");
    const botWallets = [];
    for (let i = 0; i < 4; i++) {
        const pk = generatePrivateKey();
        const acc = privateKeyToAccount(pk);
        const wal = createWalletClient({ account: acc, chain: somniaChain, transport: http() });
        botWallets.push({ acc, wal, name: `Bot_${i}` });

        // Fund bot
        const tx = await hostWallet.sendTransaction({ to: acc.address, value: parseEther("0.1") });
        await client.waitForTransactionReceipt({ hash: tx });

        // Join room
        const joinHash = await wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'joinRoom',
            args: [roomId, `Bot_${i}`, "0x00", "0x0000000000000000000000000000000000000000"]
        });
        await client.waitForTransactionReceipt({ hash: joinHash });
        console.log(`   Bot_${i}: ${acc.address.slice(0, 10)}...`);
    }
    console.log("");

    // Start game
    console.log("[4] Starting game...");
    constBS = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'startGame',
        args: [roomId]
    });
    await client.waitForTransactionReceipt({ hash: constBS });
    console.log("✅ Game started!\n");

    // Get player list
    const playerList = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'getPlayers',
        args: [roomId]
    });

    const allWallets = [{ acc: hostAccount, wal: hostWallet }, ...botWallets];
    const indexToWallet = {};
    playerList.forEach((p, idx) => {
        const match = allWallets.find(w => w.acc.address.toLowerCase() === p.wallet.toLowerCase());
        indexToWallet[idx] = match;
    });

    // SHUFFLING PHASE
    console.log("[5] Shuffling phase...");
    const getRoom = () => client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'rooms',
        args: [roomId]
    });

    while (true) {
        const r = await getRoom();
        if (r[3] !== 1) break;
        const idx = r[8];
        const w = indexToWallet[idx];
        const deck = ["0", "1", "2", "3", "4"];
        const hash = keccak256(encodeAbiParameters(parseAbiParameters('string[] deck, string salt'), [deck, "salt"]));

        try {
            const tx1 = await w.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'commitDeck', args: [roomId, hash] });
            await client.waitForTransactionReceipt({ hash: tx1 });
            const tx2 = await w.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'revealDeck', args: [roomId, deck, "salt"] });
            await client.waitForTransactionReceipt({ hash: tx2 });
            console.log(`   Player ${idx} shuffled`);
        } catch (e) { }
        await wait(1000);
    }
    console.log("✅ Shuffle complete!\n");

    // REVEAL PHASE
    console.log("[6] Reveal phase...");
    while (true) {
        const r = await getRoom();
        if (r[3] !== 2) break;

        for (let i = 0; i < 5; i++) {
            const w = indexToWallet[i];
            const recipients = playerList.map(p => p.wallet).filter(a => a.toLowerCase() !== w.acc.address.toLowerCase());
            try {
                const tx1 = await w.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'shareKeysToAll', args: [roomId, recipients, recipients.map(() => "0x00")] });
                await client.waitForTransactionReceipt({ hash: tx1 });
                const tx2 = await w.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'commitAndConfirmRole', args: [roomId, keccak256("0x00")] });
                await client.waitForTransactionReceipt({ hash: tx2 });
                console.log(`   Player ${i} confirmed role`);
            } catch (e) { }
        }
        await wait(2000);
    }
    console.log("✅ Reveal complete!\n");

    // DAY PHASE -> Start Voting
    console.log("[7] Day phase -> Starting Voting...");
    let r = await getRoom();
    if (r[3] === 3) {
        const svHash = await hostWallet.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'startVoting',
            args: [roomId]
        });
        await client.waitForTransactionReceipt({ hash: svHash });
    }
    console.log("✅ Voting started!\n");

    // VOTING PHASE - MANUAL POLLING TEST
    console.log("========================================");
    console.log("[8] VOTING PHASE - Casting votes...");
    console.log("    Using manual getLogs polling...");
    console.log("========================================\n");

    // Start polling in background
    let pollingActive = true;
    const pollLogs = async () => {
        while (pollingActive) {
            try {
                const currentBlock = await client.getBlockNumber();
                const logs = await client.getLogs({
                    address: MAFIA_CONTRACT_ADDRESS,
                    event: parseAbiItem('event VoteCast(uint256 indexed roomId, address voter, address target)'),
                    fromBlock: startBlock,
                    toBlock: currentBlock
                });

                logs.forEach(log => {
                    if (BigInt(log.args.roomId) === roomId) {
                        if (!votesReceived.has(log.transactionHash)) {
                            console.log(`🗳️  POLL HIT: Voter ${log.args.voter} -> Target ${log.args.target}`);
                            votesReceived.add(log.transactionHash);
                        }
                    }
                });
            } catch (e) { console.error("Poll error:", e.message); }
            await wait(2000);
        }
    };
    pollLogs();

    const voteTarget = indexToWallet[4].acc.address;
    console.log(`   Target: ${voteTarget.slice(0, 10)}... (Player 4)\n`);

    for (let i = 0; i < 5; i++) {
        const w = indexToWallet[i];
        console.log(`   Player ${i} voting...`);
        try {
            const tx = await w.wal.writeContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'vote',
                args: [roomId, voteTarget]
            });
            await client.waitForTransactionReceipt({ hash: tx });
            console.log(`   ✅ Player ${i} vote submitted`);
        } catch (e) {
            console.log(`   ❌ Player ${i} vote failed: ${e.message.split('\n')[0]}`);
        }
        await wait(2000);
    }

    // Wait for final poll
    console.log("\n[9] Waiting for final poll...");
    await wait(5000);
    pollingActive = false;

    // Summary
    console.log("\n========================================");
    console.log("           TEST RESULTS");
    console.log("========================================\n");
    console.log(`Expected votes: 5`);
    console.log(`Events received via polling: ${votesReceived.size}`);

    if (votesReceived.size === 5) {
        console.log("\n✅ SUCCESS! All VoteCast events were received using polling!");
    } else {
        console.log("\n❌ FAIL: Missing events.");
    }

    process.exit(0);
}

run().catch(console.error);
