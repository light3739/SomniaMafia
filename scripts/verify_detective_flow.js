const { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, encodeAbiParameters, parseAbiParameters } = require('viem');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');

// Configuration
const MAFIA_CONTRACT_ADDRESS = "0xb58130d6183844b3bfb28ff1ffc96825eee82be3"; // Using the address from force_room_auto_night.js
const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
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
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "rooms", "outputs": [{ "internalType": "uint64", "name": "id", "type": "uint64" }, { "internalType": "address", "name": "host", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint8", "name": "phase", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    // Night Actions
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "commitHash", "type": "bytes32" }], "name": "commitNightAction", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "uint8", "name": "action", "type": "uint8" }, { "internalType": "address", "name": "target", "type": "address" }, { "internalType": "string", "name": "salt", "type": "string" }], "name": "revealNightAction", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address", "name": "player", "type": "address" }], "name": "revealedActions", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address", "name": "player", "type": "address" }], "name": "revealedTargets", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
];

async function run() {
    const hostPk = "0x031ccbb22faed61b423cb8d25f531a37934303ffb4293b7d17a041fbef1863ff";
    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const hostAccount = privateKeyToAccount(hostPk);
    const hostWallet = createWalletClient({ account: hostAccount, chain: somniaChain, transport: http() });

    console.log(`Host: ${hostAccount.address}`);

    // 0. Create Room
    console.log("\n0. Creating Room...");
    const createHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'createAndJoin',
        args: ["Detective Test Room", 5, "HostTester", "0x00", "0x0000000000000000000000000000000000000000"]
    });
    const createReceipt = await client.waitForTransactionReceipt({ hash: createHash });
    const roomId = BigInt(createReceipt.logs[0].topics[1] || 32);
    console.log(`Room Created! ID looks like: ${roomId}`);

    // 1. Join 4 bots
    console.log("\n1. Joining 4 bots...");
    const bots = [];
    for (let i = 0; i < 4; i++) {
        const pk = generatePrivateKey();
        const acc = privateKeyToAccount(pk);
        const wal = createWalletClient({ account: acc, chain: somniaChain, transport: http() });
        bots.push({ acc, wal });

        const hash = await hostWallet.sendTransaction({ to: acc.address, value: parseEther("0.1") });
        await client.waitForTransactionReceipt({ hash });

        const joinHash = await wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'joinRoom',
            args: [roomId, `Bot_${i}`, "0x00", "0x0000000000000000000000000000000000000000"]
        });
        await client.waitForTransactionReceipt({ hash: joinHash });
        console.log(`Bot ${i} joined: ${acc.address}`);
    }

    const allPlayers = [{ acc: hostAccount, wal: hostWallet }, ...bots];

    // 2. Start Game (Host)
    console.log("\n2. Starting Game...");
    const startHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'startGame',
        args: [roomId]
    });
    await client.waitForTransactionReceipt({ hash: startHash });

    // 3. Shuffle Phase
    console.log("\n3. Shuffle Phase...");
    // Force decks to produce a deterministic outcome? 
    // Actually, getting a specific role is hard without complex shuffle logic.
    // We will just proceed and try to act with EVERYONE.
    // The contract might revert if we act out of turn/role, but we can catch that.

    const dummyDeck = ["0", "1", "2", "3", "4"];
    const dummySalt = "salt";
    const deckHash = keccak256(encodeAbiParameters(parseAbiParameters('string[], string'), [dummyDeck, dummySalt]));

    for (let i = 0; i < 5; i++) {
        const player = allPlayers[i];
        const cHash = await player.wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'commitDeck',
            args: [roomId, deckHash]
        });
        await client.waitForTransactionReceipt({ hash: cHash });

        const rHash = await player.wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'revealDeck',
            args: [roomId, dummyDeck, dummySalt]
        });
        await client.waitForTransactionReceipt({ hash: rHash });
        console.log(`Player ${i} shuffled/revealed`);
    }

    // 4. Share Keys
    console.log("\n4. Reveal/Keys Phase...");
    const addresses = allPlayers.map(p => p.acc.address);
    for (let i = 0; i < 5; i++) {
        const player = allPlayers[i];
        const recipients = addresses.filter(a => a !== player.acc.address);
        const dummyKeys = recipients.map(() => "0x00");

        const sHash = await player.wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'shareKeysToAll',
            args: [roomId, recipients, dummyKeys]
        });
        await client.waitForTransactionReceipt({ hash: sHash });

        const roleHash = keccak256("0x00"); // Dummy role hash
        const rcHash = await player.wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'commitAndConfirmRole',
            args: [roomId, roleHash]
        });
        await client.waitForTransactionReceipt({ hash: rcHash });
        console.log(`Player ${i} confirmed role`);
    }

    // 5. Day -> Voting
    console.log("\n5. Moving to Night (via Voting)...");
    const svHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'startVoting',
        args: [roomId]
    });
    await client.waitForTransactionReceipt({ hash: svHash });

    // Ensure no one dies so we get to night with 5 players
    // Vote 2 for 0, 2 for 1, 1 for 2 (no majority)
    for (let i = 0; i < 2; i++) {
        await allPlayers[i].wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'vote', args: [roomId, allPlayers[0].acc.address] });
    }
    for (let i = 2; i < 4; i++) {
        await allPlayers[i].wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'vote', args: [roomId, allPlayers[1].acc.address] });
    }
    await allPlayers[4].wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'vote', args: [roomId, allPlayers[2].acc.address] });

    // Wait a bit for blocks
    await new Promise(r => setTimeout(r, 2000));

    // To verify we are in night, check phase
    const roomInfo = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'rooms',
        args: [roomId]
    });
    console.log(`Phase: ${roomInfo[3]}`); // Should be 3 (Night)

    // 6. Night Action (Detective Check)
    console.log("\n6. Attempting Detective Actions...");
    const ACTION_CHECK = 3;
    const target = allPlayers[1].acc.address;
    const salt = "nightsalt";
    const commitHash = keccak256(encodeAbiParameters(parseAbiParameters('uint8, address, string'), [ACTION_CHECK, target, salt]));

    let detectiveFound = false;

    for (let i = 0; i < 2; i++) {
        const player = allPlayers[i];
        try {
            // Commit
            const cHash = await player.wal.writeContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'commitNightAction',
                args: [roomId, commitHash]
            });
            await client.waitForTransactionReceipt({ hash: cHash });
            console.log(`Player ${i} committed action.`);
        } catch (e) {
            console.log(`Player ${i} commit failed: ${e.shortMessage || e.message}`);
        }
    }

    // Now reveal ONLY Player 0
    console.log("\nRevealing Player 0...");
    try {
        const player = allPlayers[0];
        // Reveal
        const rHash = await player.wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'revealNightAction',
            args: [roomId, ACTION_CHECK, target, salt]
        });
        await client.waitForTransactionReceipt({ hash: rHash });
        console.log(`Player 0 successfully REVEALED as Detective!`);
        detectiveFound = true;

        // Verify on-chain state immediately
        const revealedAction = await client.readContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'revealedActions',
            args: [roomId, player.acc.address]
        });
        const revealedTarget = await client.readContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'revealedTargets',
            args: [roomId, player.acc.address]
        });

        console.log(`Verification: Action=${revealedAction}, Target=${revealedTarget}`);
        if (revealedAction === ACTION_CHECK && revealedTarget.toLowerCase() === target.toLowerCase()) {
            console.log("SUCCESS: On-chain verification passed.");
        } else {
            console.error("FAILURE: On-chain values mismatch!");
        }

    } catch (e) {
        console.log(`Player 0 reveal failed: ${e.shortMessage || e.message}`);
    }

    if (!detectiveFound) {
        console.error("ERROR: No player could successfully reveal as Detective. Maybe deck shuffle excluded Detective?");
    }
}

run();
