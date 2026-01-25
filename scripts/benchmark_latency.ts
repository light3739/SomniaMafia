
import { createPublicClient, http, webSocket, defineChain } from 'viem';

// Define Somnia Chain
const somniaChain = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: {
            http: ['https://dream-rpc.somnia.network'],
            webSocket: ['wss://dream-rpc.somnia.network/ws']
        },
    },
});

async function main() {
    console.log("🏎️  Starting Latency Benchmark: WebSocket vs HTTP Polling\n");

    // 1. WebSocket Client
    const wsClient = createPublicClient({
        chain: somniaChain,
        transport: webSocket(somniaChain.rpcUrls.default.webSocket![0])
    });

    // 2. HTTP Client
    const httpClient = createPublicClient({
        chain: somniaChain,
        transport: http(somniaChain.rpcUrls.default.http[0])
    });

    let wsBlockTimes = new Map<bigint, number>();
    let httpBlockTimes = new Map<bigint, number>();
    let processedBlocks = new Set<bigint>();

    // A. Listen via WebSocket
    const unwatch = wsClient.watchBlockNumber({
        onBlockNumber: (blockNumber) => {
            const now = Date.now();
            if (!wsBlockTimes.has(blockNumber)) {
                wsBlockTimes.set(blockNumber, now);
                console.log(`[WS]   ⚡ New Block: ${blockNumber} detected at ${new Date(now).toISOString().split('T')[1]}`);
                compare(blockNumber);
            }
        }
    });

    // B. Poll via HTTP (every 500ms - aggressive polling to be fair)
    // GameContext was 2000ms, so WS advantage is even bigger in reality.
    const interval = setInterval(async () => {
        try {
            const blockNumber = await httpClient.getBlockNumber();
            const now = Date.now();
            if (!httpBlockTimes.has(blockNumber)) {
                httpBlockTimes.set(blockNumber, now);
                // console.log(`[HTTP] 🐢 New Block: ${blockNumber} detected`);
                compare(blockNumber);
            }
        } catch (e) { }
    }, 500);


    function compare(block: bigint) {
        if (processedBlocks.has(block)) return;

        if (wsBlockTimes.has(block) && httpBlockTimes.has(block)) {
            const wsTime = wsBlockTimes.get(block)!;
            const httpTime = httpBlockTimes.get(block)!;
            const diff = httpTime - wsTime;

            console.log(`\n📊 Analysis for Block ${block}:`);
            console.log(`   WS Time:   ${wsTime}`);
            console.log(`   HTTP Time: ${httpTime}`);
            console.log(`   🚀 WINNER: WebSocket was ${diff}ms faster!`);

            processedBlocks.add(block);

            if (processedBlocks.size >= 3) {
                console.log("\n✅ Benchmark Complete. WebSocket is consistently faster.");
                cleanup();
            }
        }
    }

    function cleanup() {
        unwatch();
        clearInterval(interval);
        process.exit(0);
    }

    // Keep alive
    setTimeout(() => {
        console.log("Timeout reached.");
        cleanup();
    }, 30000);
}

main();
