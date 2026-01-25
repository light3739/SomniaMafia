import { MafiaABI as MafiaArtifact } from './MafiaPortal';

export const MAFIA_CONTRACT_ADDRESS = "0x3C1Bd1923F8318247e2B60E41B0F280391c4e1E1" as `0x${string}`;
export const VERIFIER_CONTRACT_ADDRESS = "0x32D3612009c2d30C71C19d2548822E1EECb8D165" as `0x${string}`;
export const MAFIA_ABI = MafiaArtifact.abi;

// Somnia Mainnet chain config
export const somniaChain = {
    id: 5031,
    name: 'Somnia Mainnet',
    nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
    rpcUrls: {
        default: {
            http: ['https://api.infra.mainnet.somnia.network'],
            webSocket: ['wss://dream-rpc.somnia.network/ws'],
        },
    },
    blockExplorers: {
        default: { name: 'Somnia Explorer', url: 'https://explorer.somnia.network' },
    },
} as const;