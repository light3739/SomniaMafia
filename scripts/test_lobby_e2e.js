/**
 * Full end-to-end test of lobby visibility.
 * Tests whether viem caches readContract results and if nextRoomId 
 * returns stale data across multiple calls.
 */
const { createPublicClient, http } = require('viem');

const CONTRACT = '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1';
const ABI = [
    { inputs: [], name: 'nextRoomId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    {
        inputs: [{ internalType: 'uint256', name: 'roomId', type: 'uint256' }],
        name: 'getRoom',
        outputs: [{
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
            internalType: 'struct MafiaTypes.GameRoom', name: '', type: 'tuple',
        }],
        stateMutability: 'view', type: 'function',
    }
];

// Test 1: Does viem cache readContract on the same client instance?
async function testViemCaching() {
    console.log('=== TEST 1: Viem client-level caching ===\n');
    
    // Client WITH deployless multicall (same as providers.tsx)
    const client = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http('https://dream-rpc.somnia.network'),
        batch: { multicall: { deployless: true, wait: 50 } },
    });

    // Call nextRoomId 5 times with 2 second intervals
    for (let i = 0; i < 5; i++) {
        const t0 = Date.now();
        const nextId = await client.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
        const t1 = Date.now();
        console.log(`  Call ${i+1}: nextRoomId=${nextId}, time=${t1-t0}ms`);
        if (i < 4) await new Promise(r => setTimeout(r, 2000));
    }
}

// Test 2: Does viem's cacheTime prevent fresh reads?
async function testCacheTimeBehavior() {
    console.log('\n=== TEST 2: Cache time behavior ===\n');
    
    // Client with cacheTime = 0 (no caching)
    const clientNoCache = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http('https://dream-rpc.somnia.network'),
        batch: { multicall: { deployless: true, wait: 50 } },
        cacheTime: 0,
    });

    // Client with default cacheTime
    const clientDefault = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http('https://dream-rpc.somnia.network'),
        batch: { multicall: { deployless: true, wait: 50 } },
    });

    console.log('  cacheTime=0:');
    const t0 = Date.now();
    const id1 = await clientNoCache.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
    const t1 = Date.now();
    const id2 = await clientNoCache.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
    const t2 = Date.now();
    console.log(`    Read1: ${id1} (${t1-t0}ms), Read2: ${id2} (${t2-t1}ms)`);

    console.log('  cacheTime=default (pollingInterval or 4000ms):');
    const t3 = Date.now();
    const id3 = await clientDefault.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
    const t4 = Date.now();
    const id4 = await clientDefault.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
    const t5 = Date.now();
    console.log(`    Read1: ${id3} (${t4-t3}ms), Read2: ${id4} (${t5-t4}ms)`);
    console.log(`    Second read was ${(t5-t4) < 5 ? 'CACHED (instant)' : 'NOT cached (hit RPC)'}`);
}

// Test 3: Full fetchRooms simulation — exactly what JoinLobby does
async function testFullFetchRooms() {
    console.log('\n=== TEST 3: Full fetchRooms simulation ===\n');

    const client = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http('https://dream-rpc.somnia.network'),
        batch: { multicall: { deployless: true, wait: 50 } },
        cacheTime: 0, // Force no cache
    });

    const t0 = Date.now();
    const nextId = await client.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
    const scanCount = 15n;
    const start = nextId > scanCount ? nextId - scanCount : 0n;
    
    const promises = [];
    for (let i = nextId - 1n; i >= start; i--) {
        promises.push(
            client.readContract({ address: CONTRACT, abi: ABI, functionName: 'getRoom', args: [i] })
                .then(data => ({ id: i, data, success: true }))
                .catch(() => ({ id: i, data: null, success: false }))
        );
    }
    const results = await Promise.all(promises);
    const t1 = Date.now();

    const now = Math.floor(Date.now() / 1000);
    let lobbyCount = 0;
    for (const res of results) {
        if (!res.success || !res.data) continue;
        const { data } = res;
        const phase = Number(data.phase);
        const host = data.host;
        const maxPlayers = Number(data.maxPlayers);
        const timestamp = Number(data.lastActionTimestamp);
        const isRecent = timestamp === 0 || (now - timestamp) < 14400;
        const isValid = host !== '0x0000000000000000000000000000000000000000' && maxPlayers > 0;
        
        if (phase === 0 && isRecent && isValid) {
            lobbyCount++;
            console.log(`  Room #${res.id}: "${data.name}" players=${data.playersCount}/${maxPlayers} age=${now-timestamp}s`);
        }
    }
    console.log(`\n  Total: nextRoomId=${nextId}, scanned=${results.length}, lobbies=${lobbyCount}, time=${t1-t0}ms`);
}

// Test 4: WebSocket transport stale read test
async function testWSvHTTP() {
    console.log('\n=== TEST 4: HTTP vs WebSocket freshness ===\n');
    
    const httpClient = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http('https://dream-rpc.somnia.network'),
        cacheTime: 0,
    });

    // Read block number from HTTP
    const httpBlock = await httpClient.getBlockNumber();
    const httpNextId = await httpClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
    console.log(`  HTTP:      block=${httpBlock}, nextRoomId=${httpNextId}`);

    // Try WebSocket
    try {
        const { webSocket: wsTransport } = require('viem');
        const wsClient = createPublicClient({
            chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
            transport: wsTransport('wss://dream-rpc.somnia.network/ws'),
            cacheTime: 0,
        });
        const wsBlock = await wsClient.getBlockNumber();
        const wsNextId = await wsClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
        console.log(`  WebSocket: block=${wsBlock}, nextRoomId=${wsNextId}`);
        console.log(`  Block delta: ${Number(wsBlock) - Number(httpBlock)}`);
        
        // Clean up WS
        wsClient.transport.close && wsClient.transport.close();
    } catch (e) {
        console.log(`  WebSocket test skipped: ${e.message}`);
    }
}

async function main() {
    await testViemCaching();
    await testCacheTimeBehavior();
    await testFullFetchRooms();
    await testWSvHTTP();
    
    console.log('\n=== ALL TESTS COMPLETE ===');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
