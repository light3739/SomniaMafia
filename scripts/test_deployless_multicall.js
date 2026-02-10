/**
 * Test deployless multicall on Somnia testnet.
 * This is what wagmi will now use internally.
 */
const { createPublicClient, http } = require('viem');

const CONTRACT = '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1';
const ABI_NEXT = [{ inputs: [], name: 'nextRoomId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }];
const ABI_ROOM = [{
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
        internalType: 'struct MafiaTypes.GameRoom',
        name: '',
        type: 'tuple',
    }],
    stateMutability: 'view',
    type: 'function',
}];

async function test() {
    // 1. Test WITHOUT multicall (individual calls)
    const clientNoBatch = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http('https://dream-rpc.somnia.network'),
    });

    const nextId = await clientNoBatch.readContract({ address: CONTRACT, abi: ABI_NEXT, functionName: 'nextRoomId' });
    console.log('nextRoomId:', nextId.toString());

    const scanCount = 15;
    const start = Number(nextId) > scanCount ? Number(nextId) - scanCount : 0;

    console.log(`\n--- Test 1: ${scanCount} individual RPC calls ---`);
    const t0 = Date.now();
    const promises1 = [];
    for (let i = Number(nextId) - 1; i >= start; i--) {
        promises1.push(clientNoBatch.readContract({ address: CONTRACT, abi: ABI_ROOM, functionName: 'getRoom', args: [BigInt(i)] }));
    }
    const results1 = await Promise.all(promises1);
    const t1 = Date.now();
    console.log(`Time: ${t1 - t0}ms, Rooms fetched: ${results1.length}`);
    console.log(`Lobby rooms: ${results1.filter(r => Number(r.phase) === 0 && r.host !== '0x0000000000000000000000000000000000000000').length}`);

    // 2. Test WITH deployless multicall (single eth_call)
    const clientDeployless = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http('https://dream-rpc.somnia.network'),
        batch: {
            multicall: {
                deployless: true,
                wait: 50,
            },
        },
    });

    console.log(`\n--- Test 2: Deployless multicall (single batched eth_call) ---`);
    const t2 = Date.now();
    const promises2 = [];
    for (let i = Number(nextId) - 1; i >= start; i--) {
        promises2.push(clientDeployless.readContract({ address: CONTRACT, abi: ABI_ROOM, functionName: 'getRoom', args: [BigInt(i)] }));
    }
    const results2 = await Promise.all(promises2);
    const t3 = Date.now();
    console.log(`Time: ${t3 - t2}ms, Rooms fetched: ${results2.length}`);
    console.log(`Lobby rooms: ${results2.filter(r => Number(r.phase) === 0 && r.host !== '0x0000000000000000000000000000000000000000').length}`);

    // Print a couple results to verify data integrity
    for (let i = 0; i < Math.min(3, results2.length); i++) {
        const r = results2[i];
        console.log(`  Room #${Number(nextId) - 1 - i}: "${r.name}" phase=${r.phase} players=${r.playersCount}/${r.maxPlayers}`);
    }

    console.log(`\n--- Speedup: ${((t1-t0)/(t3-t2)).toFixed(1)}x faster with deployless multicall ---`);
}

test().catch(console.error);
