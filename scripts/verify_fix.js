/**
 * VERIFY FIX: simulate the new fetchRooms logic with look-ahead buffer
 */
const { createPublicClient, http } = require('viem');

const RPC = 'https://dream-rpc.somnia.network';
const CONTRACT = '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1';
const ABI = [
    { inputs: [], name: 'nextRoomId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
    { inputs: [{ name: 'roomId', type: 'uint256' }],
      name: 'getRoom',
      outputs: [{ components: [
          { name: 'id', type: 'uint64' }, { name: 'host', type: 'address' }, { name: 'name', type: 'string' },
          { name: 'phase', type: 'uint8' }, { name: 'maxPlayers', type: 'uint8' }, { name: 'playersCount', type: 'uint8' },
          { name: 'aliveCount', type: 'uint8' }, { name: 'dayCount', type: 'uint16' }, { name: 'currentShufflerIndex', type: 'uint8' },
          { name: 'lastActionTimestamp', type: 'uint32' }, { name: 'phaseDeadline', type: 'uint32' },
          { name: 'confirmedCount', type: 'uint8' }, { name: 'votedCount', type: 'uint8' },
          { name: 'committedCount', type: 'uint8' }, { name: 'revealedCount', type: 'uint8' },
          { name: 'keysSharedCount', type: 'uint8' }, { name: 'depositPool', type: 'uint128' },
          { name: 'depositPerPlayer', type: 'uint128' },
      ], name: '', type: 'tuple' }],
      stateMutability: 'view', type: 'function' },
];

async function simulateOldLogic(client) {
    const nextId = await client.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
    const scanCount = 15n;
    const start = nextId > scanCount ? nextId - scanCount : 0n;
    
    const results = await Promise.allSettled(
        Array.from({ length: Number(nextId - start) }, (_, idx) => {
            const i = nextId - 1n - BigInt(idx);
            return client.readContract({ address: CONTRACT, abi: ABI, functionName: 'getRoom', args: [i] })
                .then(data => ({ i, data }));
        })
    );
    
    const rooms = [];
    for (const res of results) {
        if (res.status !== 'fulfilled') continue;
        const { i, data } = res.value;
        const host = data.host;
        const phase = Number(data.phase);
        const maxP = Number(data.maxPlayers);
        const isValid = host !== '0x0000000000000000000000000000000000000000' && maxP > 0;
        if (phase === 0 && isValid) rooms.push(Number(i));
    }
    return { nextId: Number(nextId), scanned: `${Number(nextId-1n)}..${Number(start)}`, rooms };
}

async function simulateNewLogic(client) {
    const nextId = await client.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' });
    const lookAhead = 3n;
    const scanEnd = nextId + lookAhead;
    const scanCount = 15n + lookAhead;
    const start = scanEnd > scanCount ? scanEnd - scanCount : 0n;
    
    const results = await Promise.allSettled(
        Array.from({ length: Number(scanEnd - start) }, (_, idx) => {
            const i = scanEnd - 1n - BigInt(idx);
            return client.readContract({ address: CONTRACT, abi: ABI, functionName: 'getRoom', args: [i] })
                .then(data => ({ i, data }));
        })
    );
    
    const rooms = [];
    for (const res of results) {
        if (res.status !== 'fulfilled') continue;
        const { i, data } = res.value;
        const host = data.host;
        const phase = Number(data.phase);
        const maxP = Number(data.maxPlayers);
        const isValid = host !== '0x0000000000000000000000000000000000000000' && maxP > 0;
        if (phase === 0 && isValid) rooms.push(Number(i));
    }
    return { nextId: Number(nextId), scanned: `${Number(scanEnd-1n)}..${Number(start)}`, rooms };
}

async function main() {
    const client = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: [RPC] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http(RPC),
    });

    console.log('=== OLD LOGIC (without look-ahead) ===\n');
    const old = await simulateOldLogic(client);
    console.log(`  nextRoomId = ${old.nextId}`);
    console.log(`  Scanned: rooms [${old.scanned}]`);
    console.log(`  Visible rooms: [${old.rooms.join(', ')}]`);
    console.log(`  Room ${old.nextId} visible: ${old.rooms.includes(old.nextId) ? 'YES ✅' : 'NO ❌ ← THIS IS THE BUG'}`);

    console.log('\n=== NEW LOGIC (with +3 look-ahead) ===\n');
    const nw = await simulateNewLogic(client);
    console.log(`  nextRoomId = ${nw.nextId}`);
    console.log(`  Scanned: rooms [${nw.scanned}]`);
    console.log(`  Visible rooms: [${nw.rooms.join(', ')}]`);
    console.log(`  Room ${nw.nextId} visible: ${nw.rooms.includes(nw.nextId) ? 'YES ✅ ← BUG FIXED!' : 'NO (room not created yet)'}`);
    
    // Check if new logic catches rooms that old missed
    const newOnly = nw.rooms.filter(r => !old.rooms.includes(r));
    if (newOnly.length > 0) {
        console.log(`\n  🎯 NEW rooms caught by look-ahead: [${newOnly.join(', ')}]`);
    }

    const totalDiff = nw.rooms.length - old.rooms.length;
    console.log(`\n  Old: ${old.rooms.length} rooms | New: ${nw.rooms.length} rooms | Diff: +${totalDiff}`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
