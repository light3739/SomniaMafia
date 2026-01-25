import { createPublicClient, webSocket, defineChain } from 'viem';

const somniaTestnet = defineChain({
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
    const wsUrl = somniaTestnet.rpcUrls.default.webSocket![0];
    console.log("🔌 Connecting to WebSocket:", wsUrl);

    try {
        const client = createPublicClient({
            chain: somniaTestnet,
            transport: webSocket(wsUrl, {
                retryCount: 3,
                timeout: 10_000,
            })
        });

        console.log("✅ Client initialized. Waiting for blocks...");

        // Timeout to kill the script if it hangs
        const timeout = setTimeout(() => {
            console.log("❌ Timeout: No blocks received in 15 seconds.");
            process.exit(1);
        }, 15000);

        const unwatch = client.watchBlockNumber({
            onBlockNumber: (blockNumber) => {
                console.log(`✨ New Block: ${blockNumber} (WS Alive!)`);
                clearTimeout(timeout);
                unwatch();
                console.log("✅ WebSocket test PASSED.");
                process.exit(0);
            },
            onError: (error) => {
                console.error("⚠️ WebSocket Error:", error);
                process.exit(1);
            }
        });

    } catch (error) {
        console.error("❌ Setup Failed:", error);
        process.exit(1);
    }
}

main();
