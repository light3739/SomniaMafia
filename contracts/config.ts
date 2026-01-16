import MafiaABI from './MafiaPortal.json';

export const MAFIA_CONTRACT_ADDRESS = "0xa1c287ba3289ccc074a4826f5ca0eaf713c446bd";
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