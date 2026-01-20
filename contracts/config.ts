import { MafiaABI as MafiaArtifact } from './MafiaPortal';

export const MAFIA_CONTRACT_ADDRESS = "0x45f2018503668c8b91746912d65b32f50d3addae" as `0x${string}`;
export const VERIFIER_CONTRACT_ADDRESS = "0x15223267886bf176a3a1ed38aa71c31c6995dce9" as `0x${string}`;
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