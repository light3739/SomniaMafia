const { createPublicClient, createWalletClient, http, parseEther, keccak256, encodeAbiParameters, parseAbiParameters } = require('viem');
const { privateKeyToAccount, generatePrivateKey } = require('viem/accounts');

// Configuration - MATCHING config.ts
const MAFIA_CONTRACT_ADDRESS = "0xb58130d6183844b3bfb28ff1ffc96825eee82be3";
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
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "rooms", "outputs": [{ "internalType": "uint64", "name": "id", "type": "uint64" }, { "internalType": "address", "name": "host", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "uint8", "name": "phase", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "hash", "type": "bytes32" }], "name": "commitNightAction", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
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
    const wait = (ms = 2000) => new Promise(r => setTimeout(r, ms));

    // 0. Create Room
    console.log("\n0. Creating Room...");
    const createHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'createAndJoin',
        args: ["Backend Fix Test", 5, "HostTester", "0x00", "0x0000000000000000000000000000000000000000"]
    });
    const createReceipt = await client.waitForTransactionReceipt({ hash: createHash });
    await wait();

    let roomId = null;
    for (const log of createReceipt.logs) {
        if (log.topics[0] === '0x34547214798993202685949d05e2675975d40078021b33989c922dfb64e59074') {
            roomId = BigInt(log.topics[1]);
            break;
        }
    }
    if (!roomId) roomId = BigInt(createReceipt.logs[0].topics[1]);
    console.log(`Room Created! ID: ${roomId}`);

    const bots = [];
    for (let i = 0; i < 4; i++) {
        const pk = generatePrivateKey();
        const acc = privateKeyToAccount(pk);
        const wal = createWalletClient({ account: acc, chain: somniaChain, transport: http() });
        bots.push({ acc, wal });
        const hash = await hostWallet.sendTransaction({ to: acc.address, value: parseEther("0.1") });
        await client.waitForTransactionReceipt({ hash });
        await wait();
        const joinHash = await wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'joinRoom', args: [roomId, `Bot_${i}`, "0x00", "0x0000000000000000000000000000000000000000"] });
        await client.waitForTransactionReceipt({ hash: joinHash });
        await wait();
    }
    const allPlayers = [{ acc: hostAccount, wal: hostWallet }, ...bots];

    // 2. Start Game
    const startHash = await hostWallet.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'startGame', args: [roomId] });
    await client.waitForTransactionReceipt({ hash: startHash });
    await wait();

    // 3. Shuffle
    const dummyDeck = ["0", "1", "2", "3", "4"];
    const dummySalt = "salt";
    const deckHash = keccak256(encodeAbiParameters(parseAbiParameters('string[], string'), [dummyDeck, dummySalt]));
    for (let i = 0; i < 5; i++) {
        const player = allPlayers[i];
        const h1 = await player.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'commitDeck', args: [roomId, deckHash] });
        await client.waitForTransactionReceipt({ hash: h1 });
        await wait();
        const h2 = await player.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'revealDeck', args: [roomId, dummyDeck, dummySalt] });
        await client.waitForTransactionReceipt({ hash: h2 });
        await wait();
        console.log(`Player ${i} shuffled.`);
    }

    // 4. Reveal/Keys
    const addresses = allPlayers.map(p => p.acc.address);
    for (let i = 0; i < 5; i++) {
        const player = allPlayers[i];
        const recipients = addresses.filter(a => a !== allPlayers[i].acc.address);
        const h1 = await allPlayers[i].wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'shareKeysToAll', args: [roomId, recipients, recipients.map(() => "0x00")] });
        await client.waitForTransactionReceipt({ hash: h1 });
        await wait();
        const h2 = await allPlayers[i].wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'commitAndConfirmRole', args: [roomId, keccak256("0x00")] });
        await client.waitForTransactionReceipt({ hash: h2 });
        await wait();
        console.log(`Player ${i} confirmed role.`);
    }

    // 5. Day -> Voting
    console.log("\n5. Moving to Night Phase...");
    const v1 = await hostWallet.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'startVoting', args: [roomId] });
    await client.waitForTransactionReceipt({ hash: v1 });
    await wait();
    for (let i = 0; i < 5; i++) {
        const voteHash = await allPlayers[i].wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'vote', args: [roomId, allPlayers[0].acc.address] });
        await client.waitForTransactionReceipt({ hash: voteHash });
        await wait();
    }

    console.log("Waiting 30s for global RPC synchronization...");
    await wait(30000);

    const roomInfo = await client.readContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'rooms', args: [roomId] });
    console.log(`Room Phase: ${roomInfo[3]}`);

    // 7. Last Player Reveal Scenario
    console.log("\n7. Detective (Player 0) acting...");
    const ACTION_CHECK = 3;
    const target = allPlayers[1].acc.address;
    const nightSalt = "nightsalt";
    const actionHash = keccak256(encodeAbiParameters(parseAbiParameters('uint8, address, string'), [ACTION_CHECK, target, nightSalt]));

    const cHash = await hostWallet.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'commitNightAction', args: [roomId, actionHash] });
    await client.waitForTransactionReceipt({ hash: cHash });
    await wait();
    console.log("Action committed.");

    const revealTxHash = await hostWallet.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'revealNightAction', args: [roomId, ACTION_CHECK, target, nightSalt] });
    await client.waitForTransactionReceipt({ hash: revealTxHash });
    await wait();
    console.log("Action revealed! Night finalized.");

    console.log("\n8. Waiting 5s for indexing...");
    await wait(5000);

    const onChainAction = await client.readContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'revealedActions', args: [roomId, hostAccount.address] });
    console.log(`On-chain Mapping Action: ${onChainAction} (0 means DELETED)`);

    console.log("\n9. Calling Backend API...");
    const response = await fetch('http://localhost:3000/api/game/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: roomId.toString(), detectiveAddress: hostAccount.address, targetAddress: target })
    });

    const status = response.status;
    const result = await response.json();
    console.log(`API Response Status: ${status}`);
    if (status === 403) console.error("FAILURE: API returns 403");
    else if (status === 404) console.log("SUCCESS: API passed verification (returned 404 role-not-found as expected)!");
    else console.log(`API Response: ${JSON.stringify(result)}`);
}
run();
