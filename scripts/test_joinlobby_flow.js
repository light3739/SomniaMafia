/**
 * Simulate EXACTLY what JoinLobby.tsx does — same logic, same flow.
 * This tests whether fetchRooms works correctly.
 */
const { createPublicClient, http, webSocket, fallback } = require('viem');

const CONTRACT = '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1';
const ABI_getRoom = {
    inputs: [{ name: 'roomId', type: 'uint256' }],
    name: 'getRoom',
    outputs: [{
        components: [
            { name: 'id', type: 'uint64' },
            { name: 'host', type: 'address' },
            { name: 'name', type: 'string' },
            { name: 'phase', type: 'uint8' },
            { name: 'maxPlayers', type: 'uint8' },
            { name: 'playersCount', type: 'uint8' },
            { name: 'aliveCount', type: 'uint8' },
            { name: 'dayCount', type: 'uint16' },
            { name: 'currentShufflerIndex', type: 'uint8' },
            { name: 'lastActionTimestamp', type: 'uint32' },
            { name: 'phaseDeadline', type: 'uint32' },
            { name: 'confirmedCount', type: 'uint8' },
            { name: 'votedCount', type: 'uint8' },
            { name: 'committedCount', type: 'uint8' },
            { name: 'revealedCount', type: 'uint8' },
            { name: 'keysSharedCount', type: 'uint8' },
            { name: 'depositPool', type: 'uint128' },
            { name: 'depositPerPlayer', type: 'uint128' },
        ],
        name: '',
        type: 'tuple',
    }],
    stateMutability: 'view',
    type: 'function',
};
const ABI_nextRoomId = { inputs: [], name: 'nextRoomId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' };

const chain = {
    id: 50312, name: 'Somnia',
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'], webSocket: ['wss://dream-rpc.somnia.network/ws'] } },
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
};

async function simulateFetchRooms(client, label) {
    console.log(`\n=== ${label} ===`);
    const t0 = Date.now();

    // Step 1: Get nextRoomId (same as JoinLobby)
    const nextId = await client.readContract({
        address: CONTRACT, abi: [ABI_nextRoomId], functionName: 'nextRoomId',
    });
    console.log(`  nextRoomId = ${nextId} (${Date.now() - t0}ms)`);

    // Step 2: Scan last 15 rooms (same as JoinLobby)
    const scanCount = 15n;
    const start = nextId > scanCount ? nextId - scanCount : 0n;
    const fetchPromises = [];
    for (let i = nextId - 1n; i >= start; i--) {
        fetchPromises.push(
            client.readContract({
                address: CONTRACT, abi: [ABI_getRoom], functionName: 'getRoom', args: [i],
            }).then(data => ({ id: i, data, success: true }))
              .catch(err => ({ id: i, data: null, success: false, error: err.message }))
        );
    }
    const results = await Promise.all(fetchPromises);
    console.log(`  Fetched ${results.length} rooms (${Date.now() - t0}ms)`);

    // Step 3: Apply EXACTLY the same filter as JoinLobby
    const now = Math.floor(Date.now() / 1000);
    const roomList = [];

    for (const res of results) {
        if (!res.success || !res.data) {
            console.log(`  Room ${res.id}: FAILED - ${res.error}`);
            continue;
        }
        const { id, data } = res;

        // Check data type
        const isArray = Array.isArray(data);

        let phase, timestamp, host, name, playersCount, maxPlayers;
        if (isArray) {
            phase = Number(data[3]);
            timestamp = Number(data[9]);
            host = data[1];
            name = data[2];
            playersCount = Number(data[5]);
            maxPlayers = Number(data[4]);
        } else {
            phase = Number(data.phase);
            timestamp = Number(data.lastActionTimestamp);
            host = data.host;
            name = data.name;
            playersCount = Number(data.playersCount);
            maxPlayers = data.maxPlayers; // NOTE: No Number() here — same as JoinLobby!
        }

        const isRecent = timestamp === 0 || (now - timestamp) < 14400;
        const isValid = host !== '0x0000000000000000000000000000000000000000' && maxPlayers > 0;

        const passesFilter = phase === 0 && isRecent && isValid;

        console.log(`  Room ${id}: isArray=${isArray} phase=${phase} host=${host.slice(0,10)}... ts=${timestamp} maxP=${maxPlayers}(${typeof maxPlayers}) players=${playersCount} valid=${isValid} recent=${isRecent} → ${passesFilter ? 'SHOWN' : 'FILTERED OUT'}`);

        if (passesFilter) {
            roomList.push({ id: Number(data.id || id), host, name, players: playersCount, max: maxPlayers });
        }
    }

    console.log(`  → ${roomList.length} rooms would be shown`);
    console.log(`  Total time: ${Date.now() - t0}ms`);
    return roomList;
}

async function main() {
    // Test 1: Same transport as providers.tsx (WS first)
    const wsFirstClient = createPublicClient({
        chain, transport: fallback([
            webSocket('wss://dream-rpc.somnia.network/ws'),
            http('https://dream-rpc.somnia.network'),
        ]),
        batch: { multicall: { deployless: true, wait: 50 } },
    });

    // Test 2: HTTP only (no WS)
    const httpClient = createPublicClient({
        chain, transport: http('https://dream-rpc.somnia.network'),
        batch: { multicall: { deployless: true, wait: 50 } },
    });

    // Test 3: No deployless multicall (individual calls)
    const noBatchClient = createPublicClient({
        chain, transport: http('https://dream-rpc.somnia.network'),
    });

    await simulateFetchRooms(wsFirstClient, 'WS-first fallback + deployless multicall (same as providers.tsx)');
    await simulateFetchRooms(httpClient, 'HTTP only + deployless multicall');
    await simulateFetchRooms(noBatchClient, 'HTTP only, NO batching');

    // Test 4: Run twice in quick succession (test fetchInFlight-like behavior)
    console.log('\n=== Rapid double-fetch test (same client) ===');
    const [r1, r2] = await Promise.all([
        simulateFetchRooms(httpClient, 'Concurrent fetch 1'),
        simulateFetchRooms(httpClient, 'Concurrent fetch 2'),
    ]);
    console.log(`\n  Both returned same results: ${JSON.stringify(r1.map(r=>r.id)) === JSON.stringify(r2.map(r=>r.id))}`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
