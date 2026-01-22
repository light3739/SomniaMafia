const { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, encodeAbiParameters, parseAbiParameters } = require('viem');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');

// Configuration
const MAFIA_CONTRACT_ADDRESS = "0x45f2018503668c8b91746912d65b32f50d3addae";
const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
};

const MAFIA_ABI = [
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "string", "name": "nickname", "type": "string" }, { "internalType": "bytes", "name": "publicKey", "type": "bytes" }, { "internalType": "address", "name": "sessionAddress", "type": "address" }], "name": "joinRoom", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "startGame", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "deckHash", "type": "bytes32" }], "name": "commitDeck", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "string[]", "name": "deck", "type": "string[]" }, { "internalType": "string", "name": "salt", "type": "string" }], "name": "revealDeck", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address[]", "name": "recipients", "type": "address[]" }, { "internalType": "bytes[]", "name": "encryptedKeys", "type": "bytes[]" }], "name": "shareKeysToAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "roleHash", "type": "bytes32" }], "name": "commitAndConfirmRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "startVoting", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address", "name": "target", "type": "address" }], "name": "vote", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes", "name": "encryptedMessage", "type": "bytes" }], "name": "sendMafiaMessage", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "rooms", "outputs": [{ "internalType": "uint64", "name": "id", "type": "uint64" }, { "internalType": "address", "name": "host", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint8", "name": "phase", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "getPlayers", "outputs": [{ "components": [{ "internalType": "address", "name": "wallet", "type": "address" }, { "internalType": "string", "name": "nickname", "type": "string" }, { "internalType": "bytes", "name": "publicKey", "type": "bytes" }, { "internalType": "uint32", "name": "flags", "type": "uint32" }], "internalType": "struct SomniaMafia.Player[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "getMafiaChat", "outputs": [{ "components": [{ "internalType": "bytes", "name": "encryptedMessage", "type": "bytes" }, { "internalType": "uint32", "name": "timestamp", "type": "uint32" }, { "internalType": "address", "name": "sender", "type": "address" }], "internalType": "struct SomniaMafia.MafiaMessage[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" }
];

async function run() {
    const hostPk = "0x031ccbb22faed61b423cb8d25f531a37934303ffb4293b7d17a041fbef1863ff";
    const roomId = 31n;

    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const hostAccount = privateKeyToAccount(hostPk);
    const hostWallet = createWalletClient({ account: hostAccount, chain: somniaChain, transport: http() });

    console.log(`Host: ${hostAccount.address}`);

    // 1. Generate and Fund 4 bots
    console.log("\n1. Joining 4 bots...");
    const bots = [];
    for (let i = 0; i < 4; i++) {
        const pk = generatePrivateKey();
        const acc = privateKeyToAccount(pk);
        const wal = createWalletClient({ account: acc, chain: somniaChain, transport: http() });
        bots.push({ acc, wal });

        // Fund bot
        const hash = await hostWallet.sendTransaction({ to: acc.address, value: parseEther("0.1") });
        await client.waitForTransactionReceipt({ hash });
        console.log(`Bot ${i} funded: ${acc.address}`);

        // Join room
        const joinHash = await wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'joinRoom',
            args: [roomId, `Bot_${i}`, "0x00", "0x0000000000000000000000000000000000000000"]
        });
        await client.waitForTransactionReceipt({ hash: joinHash });
        console.log(`Bot ${i} joined Room 31`);
    }

    const allPlayers = [{ acc: hostAccount, wal: hostWallet }, ...bots];

    // 2. Start Game
    console.log("\n2. Starting Game...");
    const startHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'startGame',
        args: [roomId]
    });
    await client.waitForTransactionReceipt({ hash: startHash });
    console.log("Game Started!");

    // 3. Shuffle Phase
    console.log("\n3. Shuffle Phase...");
    const dummyDeck = Array.from({ length: 5 }, (_, i) => i.toString());
    const dummySalt = "salt";
    const deckHash = keccak256(encodeAbiParameters(parseAbiParameters('string[], string'), [dummyDeck, dummySalt]));

    for (let i = 0; i < 5; i++) {
        console.log(`Shuffler ${i} (${allPlayers[i].acc.address}) committing...`);
        const cHash = await allPlayers[i].wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'commitDeck',
            args: [roomId, deckHash]
        });
        await client.waitForTransactionReceipt({ hash: cHash });

        console.log(`Shuffler ${i} revealing...`);
        const rHash = await allPlayers[i].wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'revealDeck',
            args: [roomId, dummyDeck, dummySalt]
        });
        await client.waitForTransactionReceipt({ hash: rHash });
    }
    console.log("Shuffle Phase Complete!");

    // 4. Reveal Phase
    console.log("\n4. Reveal Phase...");
    const addresses = allPlayers.map(p => p.acc.address);
    for (let i = 0; i < 5; i++) {
        console.log(`Player ${i} sharing keys and confirming role...`);
        const recipients = addresses.filter(a => a !== allPlayers[i].acc.address);
        const dummyKeys = recipients.map(() => "0x00");

        const sHash = await allPlayers[i].wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'shareKeysToAll',
            args: [roomId, recipients, dummyKeys]
        });
        await client.waitForTransactionReceipt({ hash: sHash });

        const roleHash = keccak256("0x00"); // Dummy role hash
        const rcHash = await allPlayers[i].wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'commitAndConfirmRole',
            args: [roomId, roleHash]
        });
        await client.waitForTransactionReceipt({ hash: rcHash });
    }
    console.log("Reveal Phase Complete! Game is now in DAY.");

    // 5. Advance to NIGHT
    console.log("\n5. Advancing to Night...");
    const svHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'startVoting',
        args: [roomId]
    });
    await client.waitForTransactionReceipt({ hash: svHash });
    console.log("Voting Started!");

    for (let i = 0; i < 5; i++) {
        console.log(`Player ${i} voting...`);
        const vHash = await allPlayers[i].wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'vote',
            args: [roomId, allPlayers[0].acc.address] // All vote for host for speed
        });
        await client.waitForTransactionReceipt({ hash: vHash });
    }
    console.log("Voting Finalized! Game should be in NIGHT phase.");

    // 6. Send Mafia Chat
    console.log("\n6. Sending Mafia Chat...");
    const chatMsg = { type: 'text', text: "HOST SAYS HELLO TO MAFIA! 🕵️‍♂️🥂" };
    const hexMsg = '0x' + Buffer.from(JSON.stringify(chatMsg)).toString('hex');
    try {
        const chatHash = await hostWallet.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'sendMafiaMessage',
            args: [roomId, hexMsg]
        });
        console.log(`Chat sent! TX: ${chatHash}`);
        await client.waitForTransactionReceipt({ hash: chatHash });
        console.log("Message confirmed on-chain!");
    } catch (e) {
        console.error(`❌ Chat failed: ${e.shortMessage || e.message}`);
        console.log("Checking if host is actually Mafia...");
    }

    // Read chat
    const history = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'getMafiaChat',
        args: [roomId]
    });
    console.log(`\nChat History (Found ${history.length} messages):`);
    history.forEach((m, i) => {
        const decoded = Buffer.from(m.encryptedMessage.slice(2), 'hex').toString();
        console.log(`[${i}] ${m.sender.slice(0, 8)}: ${decoded}`);
    });
}

run();
