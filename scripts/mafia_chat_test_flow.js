const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const path = require('path');

// Configuration
const MAFIA_CONTRACT_ADDRESS = "0xb58130d6183844b3bfb28ff1ffc96825eee82be3";
const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
};

const MAFIA_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "roomName", "type": "string" },
            { "internalType": "uint8", "name": "maxPlayers", "type": "uint8" },
            { "internalType": "string", "name": "nickname", "type": "string" },
            { "internalType": "bytes", "name": "publicKey", "type": "bytes" },
            { "internalType": "address", "name": "sessionAddress", "type": "address" }
        ],
        "name": "createAndJoin",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "uint256", "name": "roomId", "type": "uint256" },
            { "internalType": "bytes", "name": "encryptedMessage", "type": "bytes" }
        ],
        "name": "sendMafiaMessage",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }],
        "name": "rooms",
        "outputs": [
            { "internalType": "uint64", "name": "id", "type": "uint64" },
            { "internalType": "address", "name": "host", "type": "address" },
            { "internalType": "string", "name": "name", "type": "string" },
            { "internalType": "uint8", "name": "phase", "type": "uint8" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "roomId", "type": "uint256" }],
        "name": "getMafiaChat",
        "outputs": [
            {
                "components": [
                    { "internalType": "bytes", "name": "encryptedMessage", "type": "bytes" },
                    { "internalType": "uint32", "name": "timestamp", "type": "uint32" },
                    { "internalType": "address", "name": "sender", "type": "address" }
                ],
                "internalType": "struct SomniaMafia.MafiaMessage[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const PHASE_LABELS = ['LOBBY', 'SHUFFLING', 'REVEAL', 'DAY', 'VOTING', 'NIGHT', 'ENDED'];

async function run() {
    const pk = process.env.PRIVATE_KEY;
    const roomIdInput = process.argv[2];

    if (!pk) {
        console.error("❌ ERROR: Please provide PRIVATE_KEY environment variable.");
        console.log("Example: PRIVATE_KEY=0x... node scripts/mafia_chat_test_flow.js");
        process.exit(1);
    }

    const account = privateKeyToAccount(pk);
    const client = createPublicClient({ chain: somniaChain, transport: http() });
    const wallet = createWalletClient({ account, chain: somniaChain, transport: http() });

    console.log(`Using Account: ${account.address}`);
    const balance = await client.getBalance({ address: account.address });
    console.log(`Balance: ${formatEther(balance)} STT`);

    let roomId = roomIdInput;

    if (!roomId) {
        console.log("\n--- CREATING NEW ROOM ---");
        try {
            const hash = await wallet.writeContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI,
                functionName: 'createAndJoin',
                args: ["Chat Test Room", 5, "AgentTester", "0x00", "0x0000000000000000000000000000000000000000"],
                value: 0n,
            });
            console.log(`Room creation TX sent: ${hash}. Waiting...`);
            const receipt = await client.waitForTransactionReceipt({ hash });

            // Extract roomId from logs - simplified for this test
            // (In a real app, you would parse the RoomCreated event)
            console.log(`✅ Room Created! Transaction status: ${receipt.status}`);
            console.log("Please find the Room ID in the explorer or run this script with a Room ID.");
            return;
        } catch (e) {
            console.error(`❌ Creation failed: ${e.message}`);
            return;
        }
    }

    console.log(`\n--- TESTING CHAT FOR ROOM #${roomId} ---`);
    const room = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'rooms',
        args: [BigInt(roomId)]
    });

    console.log(`Current Phase: ${PHASE_LABELS[room[3]]} (${room[3]})`);

    if (room[3] !== 5) {
        console.warn(`⚠️ Room is NOT in NIGHT phase. Contract will revert sendMafiaMessage.`);
    }

    const messageContent = { type: 'text', text: "Hello from the test script! 🕵️‍♂️" };
    const jsonStr = JSON.stringify(messageContent);
    const hexData = '0x' + Buffer.from(jsonStr).toString('hex');

    console.log(`Attempting to send message to Mafia Chat...`);
    try {
        const hash = await wallet.writeContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'sendMafiaMessage',
            args: [BigInt(roomId), hexData],
            gas: 500000n
        });
        console.log(`✅ Message TX sent: ${hash}. Waiting...`);
        const receipt = await client.waitForTransactionReceipt({ hash });
        console.log(`Message confirmed! Status: ${receipt.status}`);
        if (receipt.status === 'reverted') {
            console.log("❌ Transaction REVERTED on-chain.");
        }
    } catch (e) {
        console.error(`❌ Message failed: ${e.shortMessage || e.message}`);
        if (e.message.includes("WrongPhase")) {
            console.log("Tip: Use the /test/zk page to advance the room to NIGHT phase first.");
        }
    }

    // Always check the chat at the end
    console.log("\nReading Chat History...");
    const messages = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'getMafiaChat',
        args: [BigInt(roomId)]
    });

    console.log(`Found ${messages.length} messages.`);
    messages.forEach((m, i) => {
        const decoded = Buffer.from(m.encryptedMessage.slice(2), 'hex').toString();
        console.log(`[${i}] ${m.sender.slice(0, 8)}: ${decoded}`);
    });
}

run();
