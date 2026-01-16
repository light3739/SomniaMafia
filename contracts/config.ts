import MafiaABI from './MafiaPortal.json';

export const MAFIA_CONTRACT_ADDRESS = "0x8e032df086a100006744eb0251dcf6451963d8c4";
export const MAFIA_ABI = MafiaABI.abi;

// Somnia testnet chain config - centralized here to avoid duplication
export const somniaChain = {
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
} as const;