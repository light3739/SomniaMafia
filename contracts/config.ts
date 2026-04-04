import { defineChain } from 'viem';
import { DIAMOND_ABI } from './abi';

export const SOMNIA_TESTNET = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'Somnia Testnet Token', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network/'] } },
    blockExplorers: { default: { name: 'Explorer', url: 'https://shannon-explorer.somnia.network' } },
    testnet: true,
});

/** @deprecated Avalanche Fuji is no longer used. Kept for backward compatibility of imports. */
export const AVALANCHE_FUJI = SOMNIA_TESTNET;

export const NETWORKS = {
    somnia_testnet: SOMNIA_TESTNET,
} as const;

export type SupportedNetwork = keyof typeof NETWORKS;

export const DEPLOYMENTS = {
    somnia_testnet: {
        chain: SOMNIA_TESTNET,
        chainId: 50312,
        explorer: 'https://shannon-explorer.somnia.network',
        contracts: {
            MafiaDiamond: (process.env.NEXT_PUBLIC_MAFIA_DIAMOND || '0x0406a14729b0c77c187ac5229c8c2317589e73c0') as string,
            Groth16Verifier: '0xe0fb727e1bd7bfcfc8a71d8e3f10d3c8959ff001',
            LobbyFacet: '0xafa5c91404355de38250415c4943eddf3d1e4572',
            ShuffleFacet: '0x145d9e1cf80b8398765de2dfd1e633f5325443e5',
            VotingFacet: '0xe9e52ff5e79dc99489ac510905793b9f0de4bdd7',
            NightFacet: '0xd922ad1aa14817ddf84bf86eaab66d614cbe0e5b',
            GameEndFacet: '0x8bc94fbafa667689307acc3a4b26375436cfc06a',
            TournamentFacet: '0x6e680944ff2a88c3b853649b5627b6c4245c9563',
        },
    },
} as const;

export const ACTIVE_NETWORK: SupportedNetwork = 'somnia_testnet';
export const ACTIVE_DEPLOYMENT = DEPLOYMENTS.somnia_testnet;

export function getDeployment(_network: SupportedNetwork) {
    return ACTIVE_DEPLOYMENT;
}

export function getDeploymentByChainId(_chainId?: number | null) {
    return ACTIVE_DEPLOYMENT;
}

// Convenience aliases (used throughout the app)
export const somniaChain = SOMNIA_TESTNET;
export const MAFIA_CONTRACT_ADDRESS = ACTIVE_DEPLOYMENT.contracts.MafiaDiamond as `0x${string}`;
export const MAFIA_ABI = DIAMOND_ABI;

export const GM_SERVER_URL = process.env.NEXT_PUBLIC_GM_SERVER_URL || 'https://gm-test.mafiaonchain.live';