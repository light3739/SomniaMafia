/**
 * Test: How does Somnia RPC handle different blockTag values?
 * - 'latest' vs 'pending' vs no tag vs specific block number
 * Also test: does Somnia eth_call return different results on rapid sequential calls?
 * (i.e., is there hidden caching/replication lag?)
 */
const { createPublicClient, http, encodeFunctionData, decodeFunctionResult } = require('viem');

const RPC = 'https://dream-rpc.somnia.network';
const CONTRACT = '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1';
const FN_ABI = [{ inputs: [], name: 'nextRoomId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }];

async function rawEthCall(blockTag, label) {
    const calldata = encodeFunctionData({ abi: FN_ABI, functionName: 'nextRoomId' });
    const t0 = Date.now();
    const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: CONTRACT, data: calldata }, blockTag]
        })
    });
    const json = await res.json();
    const dt = Date.now() - t0;
    if (json.error) {
        console.log(`  ${label}: ERROR ${json.error.message} (${dt}ms)`);
        return null;
    }
    const result = decodeFunctionResult({ abi: FN_ABI, functionName: 'nextRoomId', data: json.result });
    console.log(`  ${label}: nextRoomId=${result} (${dt}ms)`);
    return result;
}

async function rawGetBlockNumber() {
    const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })
    });
    const json = await res.json();
    return BigInt(json.result);
}

async function main() {
    console.log('=== Test 1: Different blockTag values ===\n');

    const blockNum = await rawGetBlockNumber();
    console.log(`  Current block: ${blockNum}\n`);

    // All standard blockTag values
    await rawEthCall('latest', 'blockTag="latest"    ');
    await rawEthCall('pending', 'blockTag="pending"   ');
    await rawEthCall('earliest', 'blockTag="earliest"  ');
    await rawEthCall('safe', 'blockTag="safe"      ');
    await rawEthCall('finalized', 'blockTag="finalized" ');
    await rawEthCall(`0x${blockNum.toString(16)}`, `blockTag=0x${blockNum.toString(16).slice(0,6)}.. (current)`);
    await rawEthCall(`0x${(blockNum - 5n).toString(16)}`, `blockTag=0x${(blockNum-5n).toString(16).slice(0,6)}.. (current-5)`);

    console.log('\n=== Test 2: Rapid sequential calls (check for replication lag) ===\n');
    console.log('  10 rapid eth_call(latest) to same endpoint:\n');

    const results = [];
    for (let i = 0; i < 10; i++) {
        const calldata = encodeFunctionData({ abi: FN_ABI, functionName: 'nextRoomId' });
        const t0 = Date.now();
        const res = await fetch(RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: i, method: 'eth_call',
                params: [{ to: CONTRACT, data: calldata }, 'latest']
            })
        });
        const json = await res.json();
        const dt = Date.now() - t0;
        const val = decodeFunctionResult({ abi: FN_ABI, functionName: 'nextRoomId', data: json.result });
        results.push({ val, dt });
        console.log(`    Call ${i+1}: nextRoomId=${val} (${dt}ms)`);
    }

    const allSame = results.every(r => r.val === results[0].val);
    console.log(`\n  All 10 results identical: ${allSame}`);

    console.log('\n=== Test 3: Parallel calls (simulate browser batch) ===\n');
    const calldata = encodeFunctionData({ abi: FN_ABI, functionName: 'nextRoomId' });
    const t0 = Date.now();
    const parallelResults = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
            fetch(RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: i, method: 'eth_call',
                    params: [{ to: CONTRACT, data: calldata }, 'latest']
                })
            }).then(r => r.json()).then(j => ({
                val: decodeFunctionResult({ abi: FN_ABI, functionName: 'nextRoomId', data: j.result }),
                dt: Date.now() - t0,
            }))
        )
    );
    parallelResults.forEach((r, i) => console.log(`    Call ${i+1}: nextRoomId=${r.val} (${r.dt}ms)`));
    const allParallelSame = parallelResults.every(r => r.val === parallelResults[0].val);
    console.log(`\n  All 10 parallel results identical: ${allParallelSame}`);

    console.log('\n=== Test 4: Does viem blockTag: "latest" work with deployless multicall? ===\n');
    const client = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: [RPC] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http(RPC),
        batch: { multicall: { deployless: true, wait: 50 } },
    });

    // Run with explicit blockTag: 'latest'
    const t1 = Date.now();
    const ABI_getRoom = {
        inputs: [{ name: 'roomId', type: 'uint256' }],
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
        stateMutability: 'view', type: 'function',
    };

    try {
        const [nextId, room16] = await Promise.all([
            client.readContract({ address: CONTRACT, abi: FN_ABI, functionName: 'nextRoomId', blockTag: 'latest' }),
            client.readContract({ address: CONTRACT, abi: [ABI_getRoom], functionName: 'getRoom', args: [16n], blockTag: 'latest' }),
        ]);
        console.log(`  Deployless multicall with blockTag=latest:`);
        console.log(`    nextRoomId=${nextId}, room16.host=${room16.host?.slice(0,10)}... (${Date.now()-t1}ms)`);
    } catch (e) {
        console.log(`  Deployless multicall with blockTag=latest: ERROR: ${e.message}`);
        
        // Try WITHOUT blockTag
        const t2 = Date.now();
        try {
            const [nextId2, room16_2] = await Promise.all([
                client.readContract({ address: CONTRACT, abi: FN_ABI, functionName: 'nextRoomId' }),
                client.readContract({ address: CONTRACT, abi: [ABI_getRoom], functionName: 'getRoom', args: [16n] }),
            ]);
            console.log(`  Deployless multicall WITHOUT blockTag:`);
            console.log(`    nextRoomId=${nextId2}, room16.host=${room16_2.host?.slice(0,10)}... (${Date.now()-t2}ms)`);
        } catch (e2) {
            console.log(`  Deployless multicall WITHOUT blockTag: ALSO ERROR: ${e2.message}`);
        }
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
