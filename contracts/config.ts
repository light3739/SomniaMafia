import { MafiaABI as MafiaArtifact } from './MafiaPortal';

export const MAFIA_CONTRACT_ADDRESS = "0xa962880aceeaf638c597d78d324dab6fab5981b1" as `0x${string}`;
export const VERIFIER_CONTRACT_ADDRESS = "0x13467da1c154c4e0e8674744edf734985d66b4c9" as `0x${string}`;
export const MAFIA_ABI = MafiaArtifact.abi;

// Somnia testnet chain config - centralized here to avoid duplication
export const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
} as const;