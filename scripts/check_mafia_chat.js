const { createPublicClient, http } = require('viem');
const path = require('path');

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

function hexToString(hex) {
    let str = '';
    if (hex.startsWith('0x')) hex = hex.slice(2);
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}

async function run() {
    const roomId = process.argv[2] || "30";
    console.log(`--- MAFIA CHAT DIAGNOSTICS (Room #${roomId}) ---`);

    const client = createPublicClient({ chain: somniaChain, transport: http() });

    try {
        console.log("Fetching chat messages...");
        const messages = await client.readContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'getMafiaChat',
            args: [BigInt(roomId)]
        });

        console.log(`Found ${messages.length} messages.\n`);

        messages.forEach((msg, i) => {
            const raw = msg.encryptedMessage;
            const decoded = hexToString(raw);
            let parsed = decoded;

            try {
                if (decoded.trim().startsWith('{')) {
                    parsed = JSON.parse(decoded);
                }
            } catch (e) {
                // Keep as string
            }

            console.log(`[${i}] ${msg.sender.slice(0, 8)}... @ ${new Date(msg.timestamp * 1000).toLocaleTimeString()}`);
            if (typeof parsed === 'object') {
                console.log(`    TYPE: ${parsed.type}`);
                if (parsed.text) console.log(`    TEXT: ${parsed.text}`);
                if (parsed.targetName) console.log(`    TARGET: ${parsed.targetName}`);
            } else {
                console.log(`    RAW: ${parsed}`);
            }
            console.log("-".repeat(20));
        });

        if (messages.length === 0) {
            console.log("⚠️ No messages found. This could be a new room or chat is empty.");
        }

    } catch (e) {
        console.error("❌ Failed to fetch chat:", e.message);
    }
}

run();
