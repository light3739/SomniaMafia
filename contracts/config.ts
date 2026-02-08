import { MafiaABI as MafiaArtifact } from './MafiaPortal';

export const MAFIA_CONTRACT_ADDRESS = "0xf62E44A4eAf1D19fA48718D026E184DaE40A7890" as `0x${string}`;
export const VERIFIER_CONTRACT_ADDRESS = "0xC9cAD20636aCC8f94714d47fA3Ff2DbC55849FAc" as `0x${string}`;
export const MAFIA_ABI = MafiaArtifact.abi;

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