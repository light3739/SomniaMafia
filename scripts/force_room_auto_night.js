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
    { "inputs": [{ "internalType": "string", "name": "roomName", "type": "string" }, { "internalType": "uint8", "name": "maxPlayers", "type": "uint8" }, { "internalType": "string", "name": "nickname", "type": "string" }, { "internalType": "bytes", "name": "publicKey", "type": "bytes" }, { "internalType": "address", "name": "sessionAddress", "type": "address" }], "name": "createAndJoin", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "string", "name": "nickname", "type": "string" }, { "internalType": "bytes", "name": "publicKey", "type": "bytes" }, { "internalType": "address", "name": "sessionAddress", "type": "address" }], "name": "joinRoom", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "startGame", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "deckHash", "type": "bytes32" }], "name": "commitDeck", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "string[]", "name": "deck", "type": "string[]" }, { "internalType": "string", "name": "salt", "type": "string" }], "name": "revealDeck", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address[]", "name": "recipients", "type": "address[]" }, { "internalType": "bytes[]", "name": "encryptedKeys", "type": "bytes[]" }], "name": "shareKeysToAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "roleHash", "type": "bytes32" }], "name": "commitAndConfirmRole", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "startVoting", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "address", "name": "target", "type": "address" }], "name": "vote", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes", "name": "encryptedMessage", "type": "bytes" }], "name": "sendMafiaMessage", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "rooms", "outputs": [{ "internalType": "uint64", "name": "id", "type": "uint64" }, { "internalType": "address", "name": "host", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint8", "name": "phase", "type": "uint8" }], "stateMutability": "view", "type": "function" }
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
        args: ["Auto Test Room", 5, "HostTester", "0x00", "0x0000000000000000000000000000000000000000"]
    });
    const createReceipt = await client.waitForTransactionReceipt({ hash: createHash });
    // Usually RoomID is hard to get from receipt without parsing events, so we use nextRoomId logic or just list
    // BUT we know Room 31 existed, so next is likely 32. Let's find out.
    // Hack: we'll check logs for RoomCreated topic: 0x...
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

        // Fund bot
        const hash = await hostWallet.sendTransaction({ to: acc.address, value: parseEther("0.1") });
        await client.waitForTransactionReceipt({ hash });

        // Join room
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

    // 2. Start Game
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
    const dummyDeck = ["0", "1", "2", "3", "4"];
    const dummySalt = "salt";
    const deckHash = keccak256(encodeAbiParameters(parseAbiParameters('string[], string'), [dummyDeck, dummySalt]));

    for (let i = 0; i < 5; i++) {
        await (async () => {
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
        })();
    }

    // 4. Reveal Phase
    console.log("\n4. Reveal Phase...");
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

        const roleHash = keccak256("0x00");
        const rcHash = await player.wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'commitAndConfirmRole',
            args: [roomId, roleHash]
        });
        await client.waitForTransactionReceipt({ hash: rcHash });
        console.log(`Player ${i} confirmed role`);
    }

    // 5. Day -> Voting -> Night
    console.log("\n5. Moving to Night...");
    const svHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'startVoting',
        args: [roomId]
    });
    await client.waitForTransactionReceipt({ hash: svHash });

    // VOTE FOR BOT_0 (allPlayers[1])
    for (let i = 0; i < 5; i++) {
        const vHash = await allPlayers[i].wal.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'vote',
            args: [roomId, allPlayers[1].acc.address]
        });
        await client.waitForTransactionReceipt({ hash: vHash });
        console.log(`Player ${i} voted for Bot 0`);
    }

    // 6. Send Mafia Chat as Host
    console.log("\n6. Sending Mafia Chat (HOST)...");
    const chatMsg = { type: 'text', text: "HOST SAYS HELLO! 🥂🚀" };
    const hexMsg = '0x' + Buffer.from(JSON.stringify(chatMsg)).toString('hex');
    const chatHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'sendMafiaMessage',
        args: [roomId, hexMsg]
    });
    console.log(`Chat TX sent: ${chatHash}`);
    const chatReceipt = await client.waitForTransactionReceipt({ hash: chatHash });
    console.log(`Status: ${chatReceipt.status}`);

    // Final check
    const history = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'rooms',
        args: [roomId]
    });
    console.log(`\nFinal Room Phase: ${history[3]}`);
}

run();
