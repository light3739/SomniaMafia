const { createPublicClient, http } = require('viem');

const client = createPublicClient({
    chain: {
        id: 50312,
        name: 'Somnia',
        rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
        nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    },
    transport: http(),
});

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const CONTRACT = '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1';
const ABI_NEXT = [{ inputs: [], name: 'nextRoomId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }];

async function test() {
    // 1. Check if Multicall3 is deployed (wagmi uses this for batch reads)
    try {
        const code = await client.getCode({ address: MULTICALL3 });
        const exists = code && code !== '0x';
        console.log('Multicall3 contract exists:', exists, '(code length:', code ? code.length : 0, ')');
    } catch (e) {
        console.log('Multicall3 check failed:', e.message);
    }

    // 2. Test sequential reads for caching
    const t0 = Date.now();
    const nextId1 = await client.readContract({ address: CONTRACT, abi: ABI_NEXT, functionName: 'nextRoomId' });
    const t1 = Date.now();
    const nextId2 = await client.readContract({ address: CONTRACT, abi: ABI_NEXT, functionName: 'nextRoomId' });
    const t2 = Date.now();
    console.log('Read 1 nextRoomId:', nextId1.toString(), 'took', t1 - t0, 'ms');
    console.log('Read 2 nextRoomId:', nextId2.toString(), 'took', t2 - t1, 'ms');

    // 3. Current block number
    const block = await client.getBlockNumber();
    console.log('Current block:', block.toString());
}

test().catch(console.error);
