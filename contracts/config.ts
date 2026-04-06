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
            Groth16Verifier: '0xc5ece9781099a959626ca26529472af19cbc166f',
            LobbyFacet: '0x84610227737791e51d60c4724c06404a451f6f0c',
            ShuffleFacet: '0x145d9e1cf80b8398765de2dfd1e633f5325443e5',
            VotingFacet: '0xe9e52ff5e79dc99489ac510905793b9f0de4bdd7',
            NightFacet: '0xd922ad1aa14817ddf84bf86eaab66d614cbe0e5b',
            GameEndFacet: '0x482388e3d8798f9491ee549bfecd05d31bc0779d',
            TournamentFacet: '0xd4f53e0e9fb191b9321646ce78441ad343762bbc',
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