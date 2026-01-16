import MafiaABI from './MafiaPortal.json';

export const MAFIA_CONTRACT_ADDRESS = "0x08b225818fd058f6f7a918a5bf90269faa47ff55";
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