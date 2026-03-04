import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

const AVALANCHE_FUJI = defineChain({
    id: 43113,
    name: 'Avalanche Fuji C-Chain',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: { default: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] } },
});

const client = createPublicClient({ chain: AVALANCHE_FUJI, transport: http() });

const MAFIA_CONTRACT_ADDRESS = '0x3c1bd1923f8318247e2b60e41b0f280391c4e1e1';
const MAFIA_ABI = [{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"sessionKeys","outputs":[{"internalType":"address","name":"sessionAddress","type":"address"},{"internalType":"uint32","name":"expiresAt","type":"uint32"},{"internalType":"uint64","name":"roomId","type":"uint64"},{"internalType":"bool","name":"isActive","type":"bool"}],"stateMutability":"view","type":"function"}];

async function main() {
    // using one of user addresses from previous logs
    // 0xAC0E15218dC8B51B485C62C7c61fA8dFB273352e
    const address = '0xAC0E15218dC8B51B485C62C7c61fA8dFB273352e';
    const session = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'sessionKeys',
        args: [address]
    });
    console.log("Session for", address, session);
}
main().catch(console.error);
