
const { createPublicClient, http } = require('viem');

const shannon = {
    id: 50312,
    name: 'Somnia Testnet',
    rpcUrls: {
        public: { http: ['https://dream-rpc.somnia.network'] },
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
};

const ABI = [
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "roomId",
                "type": "uint256"
            }
        ],
        "name": "rooms",
        "outputs": [
            { "internalType": "uint64", "name": "id", "type": "uint64" },
            { "internalType": "address", "name": "host", "type": "address" },
            { "internalType": "string", "name": "name", "type": "string" },
            { "internalType": "enum MafiaPortal.GamePhase", "name": "phase", "type": "uint8" },
            { "internalType": "uint8", "name": "maxPlayers", "type": "uint8" },
            { "internalType": "uint8", "name": "playersCount", "type": "uint8" },
            { "internalType": "uint8", "name": "aliveCount", "type": "uint8" },
            { "internalType": "uint16", "name": "dayCount", "type": "uint16" },
            { "internalType": "uint8", "name": "currentShufflerIndex", "type": "uint8" },
            { "internalType": "uint32", "name": "lastActionTimestamp", "type": "uint32" },
            { "internalType": "uint32", "name": "phaseDeadline", "type": "uint32" },
            { "internalType": "uint8", "name": "confirmedCount", "type": "uint8" },
            { "internalType": "uint8", "name": "votedCount", "type": "uint8" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const ADDR = '0x0eF10029B612cB48D35561BBa67d2B9C0feDF10C';

async function main() {
    const client = createPublicClient({
        chain: shannon,
        transport: http()
    });

    console.log("Checking Room #4...");
    try {
        const room = await client.readContract({
            address: ADDR,
            abi: ABI,
            functionName: 'rooms',
            args: [4n]
        });

        const phases = ["LOBBY", "SHUFFLING", "REVEAL", "DAY", "VOTING", "NIGHT", "ENDED"];
        console.log("Room #4 Data:", {
            id: room[0].toString(),
            phase: phases[room[3]],
            playersCount: room[5],
            aliveCount: room[6]
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main();
