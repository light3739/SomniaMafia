const { createPublicClient, createWalletClient, http, parseEther, keccak256, encodeAbiParameters, parseAbiParameters } = require('viem');
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
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }], "name": "getPlayers", "outputs": [{ "components": [{ "internalType": "address", "name": "wallet", "type": "address" }, { "internalType": "string", "name": "nickname", "type": "string" }, { "internalType": "bytes", "name": "publicKey", "type": "bytes" }, { "internalType": "uint32", "name": "flags", "type": "uint32" }], "internalType": "struct SomniaMafia.Player[]", "name": "", "type": "tuple[]" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "bytes32", "name": "hash", "type": "bytes32" }], "name": "commitNightAction", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }, { "internalType": "uint8", "name": "action", "type": "uint8" }, { "internalType": "address", "name": "target", "type": "address" }, { "internalType": "string", "name": "salt", "type": "string" }], "name": "revealNightAction", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

const PHASE_NAMES = ["LOBBY", "SHUFFLING", "REVEAL", "DAY", "VOTING", "NIGHT", "ENDED"];

async function run() {
    const hostPk = "0x031ccbb22faed61b423cb8d25f531a37934303ffb4293b7d17a041fbef1863ff";
    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const hostAccount = privateKeyToAccount(hostPk);
    const hostWallet = createWalletClient({ account: hostAccount, chain: somniaChain, transport: http() });

    console.log(`[START] Host: ${hostAccount.address}`);
    const wait = (ms = 5000) => new Promise(r => setTimeout(r, ms));

    const retry = async (fn, name, maxRetries = 10) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const res = await fn();
                if (typeof res === 'string' && res.startsWith('0x')) {
                    await client.waitForTransactionReceipt({ hash: res });
                }
                return res;
            } catch (e) {
                console.log(`[RETRY] ${name} (${i + 1}/${maxRetries}): ${e.message.split('\n')[0]}`);
                await wait(10000);
            }
        }
        throw new Error(`Failed ${name}`);
    };

    const getRoom = () => client.readContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'rooms', args: [BigInt(roomId)] });

    // 0. CREATE & JOIN
    console.log("[LOBBY] Creating room...");
    const createHash = await hostWallet.writeContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'createAndJoin',
        args: ["Live Proof Server Sync", 5, "Host", "0x00", "0x0000000000000000000000000000000000000000"]
    });
    const createReceipt = await client.waitForTransactionReceipt({ hash: createHash });
    var roomId = BigInt(createReceipt.logs[0].topics[1]);
    console.log(`[SUCCESS] Room ID: ${roomId}`);

    const botWallets = [];
    for (let i = 0; i < 4; i++) {
        const pk = generatePrivateKey();
        const acc = privateKeyToAccount(pk);
        const wal = createWalletClient({ account: acc, chain: somniaChain, transport: http() });
        botWallets.push({ acc, wal });
        console.log(`[BOT] Funding ${acc.address}...`);
        const tx = await hostWallet.sendTransaction({ to: acc.address, value: parseEther("0.1") });
        await client.waitForTransactionReceipt({ hash: tx });
        await retry(() => wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'joinRoom', args: [roomId, `Bot_${i}`, "0x00", "0x0000000000000000000000000000000000000000"] }), `join${i}`);
    }

    console.log("[LOBBY] Starting Game...");
    await retry(() => hostWallet.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'startGame', args: [roomId] }), "startGame");

    // Map bots
    const playerList = await client.readContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'getPlayers', args: [roomId] });
    const allWallets = [{ acc: hostAccount, wal: hostWallet }, ...botWallets];
    const indexToWallet = {};
    playerList.forEach((p, idx) => {
        const match = allWallets.find(w => w.acc.address.toLowerCase() === p.wallet.toLowerCase());
        indexToWallet[idx] = match;
    });

    // 1. SHUFFLING
    console.log("[SHUFFLING] Start...");
    while (true) {
        const r = await getRoom();
        if (r[3] !== 1) break;
        const idx = r[8];
        const w = indexToWallet[idx];
        console.log(`[SHUFFLE] Turn: ${idx} (${w.acc.address.slice(0, 8)})`);
        const deck = ["0", "1", "2", "3", "4"];
        const hash = keccak256(encodeAbiParameters(parseAbiParameters('string[] deck, string salt'), [deck, "salt"]));
        await retry(() => w.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'commitDeck', args: [roomId, hash] }), `commitDeck${idx}`);
        await retry(() => w.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'revealDeck', args: [roomId, deck, "salt"] }), `revealDeck${idx}`);
        await wait(2000);
    }

    // 2. REVEAL
    console.log("[REVEAL] Syncing roles to server and confirming...");
    while (true) {
        const r = await getRoom();
        if (r[3] !== 2) break;
        console.log(`[REVEAL] Confirmed: ${r[11]} / 5`);
        for (let i = 0; i < 5; i++) {
            const w = indexToWallet[i];
            const recipients = playerList.map(p => p.wallet).filter(a => a.toLowerCase() !== w.acc.address.toLowerCase());
            try {
                // Sync to Server first
                const syncRes = await fetch('http://localhost:3000/api/game/reveal-secret', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: roomId.toString(),
                        address: w.acc.address,
                        role: i === 0 ? 3 : 0, // Detective (0) or Civilian (default)
                        salt: "salt"
                    })
                });
                if (syncRes.ok) console.log(`[SERVER] Role synced for ${w.acc.address.slice(0, 8)}`);

                const tx1 = await w.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'shareKeysToAll', args: [roomId, recipients, recipients.map(() => "0x00")] });
                await client.waitForTransactionReceipt({ hash: tx1 });
                const tx2 = await w.wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'commitAndConfirmRole', args: [roomId, keccak256("0x00")] });
                await client.waitForTransactionReceipt({ hash: tx2 });
            } catch (e) { }
        }
        await wait(10000);
    }

    // 3. DAY / 4. VOTING
    console.log("[DAY] Transitioning...");
    let r3 = await getRoom();
    if (r3[3] === 3) await retry(() => hostWallet.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'startVoting', args: [roomId] }), "startVoting");

    console.log("[VOTING] Start...");
    const voteTarget = indexToWallet[4].acc.address;
    while (true) {
        const r = await getRoom();
        if (r[3] !== 4) break;
        console.log(`[VOTING] Voted: ${r[12]} / 5`);
        for (let i = 0; i < 5; i++) {
            try {
                const tx = await indexToWallet[i].wal.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'vote', args: [roomId, voteTarget] });
                await client.waitForTransactionReceipt({ hash: tx });
            } catch (e) { }
        }
        await wait(10000);
    }

    // 5. NIGHT
    console.log("[NIGHT] DETECTIVE TEST...");
    while (true) {
        const r = await getRoom();
        if (r[3] === 5) break;
        console.log(`Waiting for night... Current phase: ${PHASE_NAMES[r[3]]}`);
        await wait(5000);
    }

    const investigativeTarget = indexToWallet[1].acc.address;
    console.log(`[NIGHT] Detective checking target: ${investigativeTarget}`);
    const actionHash = keccak256(encodeAbiParameters(parseAbiParameters('uint8, address, string'), [3, investigativeTarget, "salt"]));
    await retry(() => hostWallet.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'commitNightAction', args: [roomId, actionHash] }), "commitNight");
    await retry(() => hostWallet.writeContract({ address: MAFIA_CONTRACT_ADDRESS, abi: MAFIA_ABI, functionName: 'revealNightAction', args: [roomId, 3, investigativeTarget, "salt"] }), "revealNight");

    console.log("[API] CALLING INVESTIGATE...");
    for (let i = 0; i < 5; i++) {
        console.log(`[API] Attempt ${i + 1}`);
        const apiRes = await fetch('http://localhost:3000/api/game/investigate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: roomId.toString(), detectiveAddress: hostAccount.address, targetAddress: investigativeTarget })
        });
        const body = await apiRes.json();
        console.log(`[API] Status: ${apiRes.status} | Result: ${JSON.stringify(body)}`);
        if (apiRes.ok) {
            console.log("== SUCCESS: DETECTIVE VERIFIED VIA BLOCKCHAIN LOGS ==");
            process.exit(0);
        }
        await wait(10000);
    }
    process.exit(1);
}
run();
