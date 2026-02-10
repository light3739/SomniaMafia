/**
 * Test: Does WebSocket return stale blocks compared to HTTP?
 * Runs 10 sequential reads with both transports to compare freshness.
 */
const { createPublicClient, http, webSocket } = require('viem');

const CONTRACT = '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1';
const ABI = [{ inputs: [], name: 'nextRoomId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }];

async function main() {
    const httpClient = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: http('https://dream-rpc.somnia.network'),
        cacheTime: 0,
    });

    const wsClient = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: webSocket('wss://dream-rpc.somnia.network/ws'),
        cacheTime: 0,
    });

    // Fallback with WS first (same as current providers.tsx)
    const fallbackWsFirst = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: require('viem').fallback([
            webSocket('wss://dream-rpc.somnia.network/ws'),
            http('https://dream-rpc.somnia.network'),
        ]),
        cacheTime: 0,
    });

    // Fallback with HTTP first (proposed fix)
    const fallbackHttpFirst = createPublicClient({
        chain: { id: 50312, name: 'Somnia', rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } }, nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 } },
        transport: require('viem').fallback([
            http('https://dream-rpc.somnia.network'),
            webSocket('wss://dream-rpc.somnia.network/ws'),
        ]),
        cacheTime: 0,
    });

    console.log('=== Block freshness comparison (10 samples, 1s apart) ===\n');
    console.log('Sample | HTTP Block | WS Block | FB(WS→HTTP) | FB(HTTP→WS) | Delta(WS-HTTP)');
    console.log('-------|-----------|----------|-------------|-------------|---------------');

    for (let i = 0; i < 10; i++) {
        const [httpBlock, wsBlock, fbWsBlock, fbHttpBlock] = await Promise.all([
            httpClient.getBlockNumber(),
            wsClient.getBlockNumber(),
            fallbackWsFirst.getBlockNumber(),
            fallbackHttpFirst.getBlockNumber(),
        ]);
        
        const delta = Number(wsBlock) - Number(httpBlock);
        console.log(`   ${(i+1).toString().padStart(2)}   | ${httpBlock} | ${wsBlock} | ${fbWsBlock}    | ${fbHttpBlock}    | ${delta >= 0 ? '+' : ''}${delta}`);
        
        if (i < 9) await new Promise(r => setTimeout(r, 1000));
    }

    console.log('\n=== nextRoomId comparison ===\n');
    for (let i = 0; i < 5; i++) {
        const [httpId, wsId, fbWsId, fbHttpId] = await Promise.all([
            httpClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' }),
            wsClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' }),
            fallbackWsFirst.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' }),
            fallbackHttpFirst.readContract({ address: CONTRACT, abi: ABI, functionName: 'nextRoomId' }),
        ]);
        console.log(`  Sample ${i+1}: HTTP=${httpId} WS=${wsId} FB(WS→HTTP)=${fbWsId} FB(HTTP→WS)=${fbHttpId}`);
        if (i < 4) await new Promise(r => setTimeout(r, 2000));
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
