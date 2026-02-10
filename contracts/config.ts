import MafiaDiamondABI from './MafiaDiamondABI.json';

export const MAFIA_CONTRACT_ADDRESS = "0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1" as `0x${string}`;
export const VERIFIER_CONTRACT_ADDRESS = "0xfa208d4ce645c9ce9c1957267d172d3627b9bd94" as `0x${string}`;
export const MAFIA_ABI = MafiaDiamondABI;

// GM Server URL
export const GM_SERVER_URL = "http://213.21.253.190:3001";

// Somnia testnet chain config - centralized here to avoid duplication
export const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: {
            http: ['https://dream-rpc.somnia.network'],
            webSocket: ['wss://dream-rpc.somnia.network/ws']
        },
    },
} as const;