import MafiaABI from './MafiaPortal.json';

export const MAFIA_CONTRACT_ADDRESS = "0x3618a252ccca8460b30ac5d6c7a70cfbd226b61b";
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