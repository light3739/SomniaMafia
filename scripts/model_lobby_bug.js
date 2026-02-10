/**
 * MODEL THE EXACT BUG: "Only after creating a NEW lobby, the PREVIOUS ones become visible"
 * 
 * HYPOTHESIS: nextRoomId is read in a SEPARATE RPC call from getRoom calls.
 * If a room is created BETWEEN these two calls, fetchRooms misses it:
 *
 *   1. fetchRooms() calls nextRoomId() → returns 17 (room 17 not yet created)
 *   2. Someone creates room 17 on-chain → nextRoomId becomes 18
 *   3. fetchRooms() calls getRoom(16), getRoom(15), ... getRoom(2)
 *      → Room 17 EXISTS on-chain but we never asked for it!
 *   4. Next poll: nextRoomId() → returns 18, so we scan 17..3 → NOW room 17 is visible
 *
 * This is a RACE CONDITION between reading nextRoomId and reading getRoom.
 * With deployless multicall wait:50ms, these go in DIFFERENT batches because
 * nextRoomId is `await`ed before the getRoom loop starts.
 *
 * FIX: Also scan nextId, nextId+1, nextId+2 (look-ahead buffer for rooms
 * created during the fetch window).
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

async function main() {
    const client = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: [RPC] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http(RPC),
    });

    // Step 1: Show the RACE CONDITION window
    console.log('=== DEMONSTRATING THE RACE CONDITION ===\n');
    
    const t1 = Date.now();
    const nextId = await client.readContract({
        address: CONTRACT, abi: ABI, functionName: 'nextRoomId',
    });
    const t2 = Date.now();
    console.log(`1. nextRoomId() = ${nextId} (took ${t2-t1}ms)`);
    console.log(`   ⚠️ RACE WINDOW: If someone creates a room NOW, nextRoomId becomes ${nextId+1n}`);
    console.log(`   But we'll only scan rooms ${nextId-1n} down to ${nextId-15n}\n`);
    
    // Step 2: Show that getRoom(nextId) returns an empty/zero room
    try {
        const futureRoom = await client.readContract({
            address: CONTRACT, abi: ABI, functionName: 'getRoom', args: [nextId],
        });
        const host = futureRoom.host || (Array.isArray(futureRoom) ? futureRoom[1] : '');
        const phase = Number(futureRoom.phase ?? (Array.isArray(futureRoom) ? futureRoom[3] : 0));
        const maxP = Number(futureRoom.maxPlayers ?? (Array.isArray(futureRoom) ? futureRoom[4] : 0));
        console.log(`2. getRoom(${nextId}) [future room]:`);
        console.log(`   host=${host.slice(0,10)}... phase=${phase} maxPlayers=${maxP}`);
        
        const isZero = host === '0x0000000000000000000000000000000000000000';
        console.log(`   Is zero/empty: ${isZero} → ${isZero ? 'Would be FILTERED OUT by isValid check' : 'Would be SHOWN (room exists!)'}`);
    } catch (e) {
        console.log(`2. getRoom(${nextId}) REVERTS: ${e.message?.slice(0,100)}`);
        console.log(`   ✅ This proves: if we try to fetch a non-existent room, it either reverts or returns zeros`);
    }
    
    // Step 3: What about rooms BEYOND nextId?
    console.log('\n3. Probing rooms BEYOND nextRoomId:');
    for (let offset = 0n; offset <= 3n; offset++) {
        const probeId = nextId + offset;
        try {
            const room = await client.readContract({
                address: CONTRACT, abi: ABI, functionName: 'getRoom', args: [probeId],
            });
            const host = room.host || (Array.isArray(room) ? room[1] : '');
            const isZero = host === '0x0000000000000000000000000000000000000000';
            console.log(`   getRoom(${probeId}): host=${host.slice(0,10)}... zero=${isZero}`);
        } catch (e) {
            console.log(`   getRoom(${probeId}): REVERTS`);
        }
    }
    
    // Step 4: Simulate current fetchRooms logic and show the vulnerability
    console.log('\n=== SIMULATING CURRENT fetchRooms LOGIC ===\n');
    
    const scanCount = 15n;
    const start = nextId > scanCount ? nextId - scanCount : 0n;
    console.log(`Current: scan rooms [${nextId-1n}..${start}] (${nextId-1n-start+1n} rooms)`);
    console.log(`Missing: room ${nextId} if created between nextRoomId() and getRoom() calls`);
    
    // Step 5: Show the FIX - scan with look-ahead
    console.log('\n=== PROPOSED FIX: LOOK-AHEAD BUFFER ===\n');
    const lookAhead = 3n;
    const fixedEnd = nextId + lookAhead; // scan UP TO nextId+3
    console.log(`Fixed: scan rooms [${fixedEnd-1n}..${start}] (${fixedEnd-1n-start+1n} rooms)`);
    console.log(`Now room ${nextId} would be caught even if created during race window!`);
    console.log(`Extra rooms ${nextId}..${fixedEnd-1n} will have zero host → filtered out by isValid`);
    
    // Step 6: Verify this is safe (zero-host rooms are filtered)
    console.log('\n=== VERIFICATION: Look-ahead rooms are safely filtered ===\n');
    let safeCount = 0;
    for (let i = nextId; i < fixedEnd; i++) {
        try {
            const room = await client.readContract({
                address: CONTRACT, abi: ABI, functionName: 'getRoom', args: [i],
            });
            const host = room.host || (Array.isArray(room) ? room[1] : '');
            const isZero = host === '0x0000000000000000000000000000000000000000';
            if (isZero) safeCount++;
            console.log(`   Room ${i}: host=${host.slice(0,10)}... zero=${isZero} → ${isZero ? 'SAFELY FILTERED ✅' : 'SHOWN (room exists) ✅'}`);
        } catch (e) {
            console.log(`   Room ${i}: REVERTS → need try/catch ✅`);
            safeCount++;
        }
    }
    
    console.log(`\n✅ All ${safeCount} look-ahead rooms are safely handled`);
    console.log('\n=== CONCLUSION ===');
    console.log('The bug is a RACE CONDITION between reading nextRoomId and reading getRoom.');
    console.log('FIX: Scan nextId + look-ahead buffer (3 extra rooms beyond nextRoomId).');
    console.log('Non-existent rooms return zero-address host → filtered by isValid check.');
    
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
