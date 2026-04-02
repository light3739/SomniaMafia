import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';
import { DIAMOND_ABI } from './contracts/abi.js';

const somniaTestnet = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    network: 'somnia-testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
});

const client = createPublicClient({ chain: somniaTestnet, transport: http() });

async function main() {
    const roomId = 64n;
    const room = await client.readContract({
        address: '0xe5437f7857cf7abe40de67e8f462b87f9c8eecc8',
        abi: DIAMOND_ABI,
        functionName: 'getRoom',
        args: [roomId]
    }) as any;
    console.log("Room Phase:", room.phase); 
}
main().catch(console.error);
