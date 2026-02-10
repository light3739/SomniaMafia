/**
 * Diagnostic script to check lobby visibility on-chain.
 * Simulates what JoinLobby.tsx does to find rooms.
 */
const { createPublicClient, http } = require('viem');

const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
};

const CONTRACT = '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1';

// Minimal ABI for diagnostics
const ABI = [
    {
        inputs: [],
        name: 'nextRoomId',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'uint256', name: 'roomId', type: 'uint256' }],
        name: 'getRoom',
        outputs: [
            {
                components: [
                    { internalType: 'uint64', name: 'id', type: 'uint64' },
                    { internalType: 'address', name: 'host', type: 'address' },
                    { internalType: 'string', name: 'name', type: 'string' },
                    { internalType: 'enum MafiaTypes.GamePhase', name: 'phase', type: 'uint8' },
                    { internalType: 'uint8', name: 'maxPlayers', type: 'uint8' },
                    { internalType: 'uint8', name: 'playersCount', type: 'uint8' },
                    { internalType: 'uint8', name: 'aliveCount', type: 'uint8' },
                    { internalType: 'uint16', name: 'dayCount', type: 'uint16' },
                    { internalType: 'uint8', name: 'currentShufflerIndex', type: 'uint8' },
                    { internalType: 'uint32', name: 'lastActionTimestamp', type: 'uint32' },
                    { internalType: 'uint32', name: 'phaseDeadline', type: 'uint32' },
                    { internalType: 'uint8', name: 'confirmedCount', type: 'uint8' },
                    { internalType: 'uint8', name: 'votedCount', type: 'uint8' },
                    { internalType: 'uint8', name: 'committedCount', type: 'uint8' },
                    { internalType: 'uint8', name: 'revealedCount', type: 'uint8' },
                    { internalType: 'uint8', name: 'keysSharedCount', type: 'uint8' },
                    { internalType: 'uint128', name: 'depositPool', type: 'uint128' },
                    { internalType: 'uint128', name: 'depositPerPlayer', type: 'uint128' },
                ],
                internalType: 'struct MafiaTypes.GameRoom',
                name: '',
                type: 'tuple',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
];

const PHASES = ['LOBBY', 'SHUFFLING', 'REVEAL', 'DAY', 'VOTING', 'NIGHT', 'ENDED'];

async function main() {
    const client = createPublicClient({
        chain: somniaChain,
        transport: http(),
    });

    // 1. Read nextRoomId
    const nextId = await client.readContract({
        address: CONTRACT,
        abi: ABI,
        functionName: 'nextRoomId',
    });

    console.log(`\n=== Contract: ${CONTRACT} ===`);
    console.log(`nextRoomId: ${nextId}`);
    console.log(`Total rooms created: ${nextId}\n`);

    if (nextId === 0n) {
        console.log('No rooms exist yet.');
        return;
    }

    // 2. Scan last 20 rooms (same as JoinLobby.tsx)
    const scanCount = 20n;
    const start = nextId > scanCount ? nextId - scanCount : 0n;

    console.log(`Scanning rooms ${start} to ${nextId - 1n}...\n`);

    const now = Math.floor(Date.now() / 1000);
    let lobbyRooms = 0;

    for (let i = nextId - 1n; i >= start; i--) {
        try {
            const data = await client.readContract({
                address: CONTRACT,
                abi: ABI,
                functionName: 'getRoom',
                args: [i],
            });

            const phase = Number(data.phase);
            const timestamp = Number(data.lastActionTimestamp);
            const isRecent = timestamp === 0 || (now - timestamp) < 14400; // 4 hours
            const host = data.host;
            const isValid = host !== '0x0000000000000000000000000000000000000000' && Number(data.maxPlayers) > 0;
            const ageSeconds = timestamp > 0 ? now - timestamp : 'N/A (timestamp=0)';

            // Check data types
            const dataTypes = {
                id: typeof data.id,
                host: typeof data.host,
                name: typeof data.name,
                phase: typeof data.phase,
                maxPlayers: typeof data.maxPlayers,
                playersCount: typeof data.playersCount,
                lastActionTimestamp: typeof data.lastActionTimestamp,
            };

            const isLobby = phase === 0;
            const wouldShow = phase === 0 && isRecent && isValid;

            console.log(`--- Room #${i} ---`);
            console.log(`  Name: "${data.name}"`);
            console.log(`  Host: ${data.host}`);
            console.log(`  Phase: ${phase} (${PHASES[phase] || 'UNKNOWN'})`);
            console.log(`  Players: ${data.playersCount}/${data.maxPlayers}`);
            console.log(`  Timestamp: ${timestamp} (age: ${ageSeconds}s)`);
            console.log(`  isLobby: ${isLobby}, isRecent: ${isRecent}`);
            console.log(`  >> Would show in JoinLobby: ${wouldShow ? 'YES ✓' : 'NO ✗'}`);
            console.log(`  Data types: ${JSON.stringify(dataTypes)}`);
            console.log(`  Array.isArray(data): ${Array.isArray(data)}`);
            console.log('');

            if (wouldShow) lobbyRooms++;
        } catch (e) {
            console.log(`--- Room #${i}: FETCH ERROR: ${e.message} ---\n`);
        }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total scanned: ${Number(nextId - start)}`);
    console.log(`Visible lobby rooms: ${lobbyRooms}`);
    console.log(`Current time (unix): ${now}`);
    console.log(`12-min cutoff time: ${now - 720}`);
}

main().catch(console.error);
