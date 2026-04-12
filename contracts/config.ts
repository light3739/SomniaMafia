import { defineChain } from 'viem';
import { DIAMOND_ABI } from './abi';

export const SOMNIA_TESTNET = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'Somnia Testnet Token', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: {
            http: ['https://api.infra.testnet.somnia.network/'],
            webSocket: ['wss://api.infra.testnet.somnia.network/ws'],
        },
    },
    blockExplorers: { default: { name: 'Explorer', url: 'https://shannon-explorer.somnia.network' } },
    testnet: true,
});

export const SOMNIA_MAINNET = defineChain({
    id: 5031,
    name: 'Somnia',
    nativeCurrency: { name: 'Somnia Token', symbol: 'SOMI', decimals: 18 },
    rpcUrls: {
        default: {
            http: ['https://api.infra.mainnet.somnia.network/'],
            webSocket: ['wss://api.infra.mainnet.somnia.network/ws'],
        },
    },
    blockExplorers: { default: { name: 'Somnia Explorer', url: 'https://explorer.somnia.network' } },
    testnet: false,
});

/** @deprecated Avalanche Fuji is no longer used. Kept for backward compatibility of imports. */
export const AVALANCHE_FUJI = SOMNIA_TESTNET;

export const NETWORKS = {
    somnia_testnet: SOMNIA_TESTNET,
    somnia_mainnet: SOMNIA_MAINNET,
} as const;

export type SupportedNetwork = keyof typeof NETWORKS;

type DeploymentConfig = {
    chain: ReturnType<typeof defineChain>;
    chainId: number;
    explorer: string;
    contracts: {
        MafiaDiamond: string;
        Groth16Verifier: string;
        LobbyFacet: string;
        ShuffleFacet: string;
        VotingFacet: string;
        NightFacet: string;
        GameEndFacet: string;
        TournamentFacet: string;
        TimeoutsFacet: string;
        RefundsFacet: string;
    };
};

export const DEPLOYMENTS: Record<SupportedNetwork, DeploymentConfig> = {
    somnia_testnet: {
        chain: SOMNIA_TESTNET,
        chainId: 50312,
        explorer: 'https://shannon-explorer.somnia.network',
        contracts: {
            MafiaDiamond: (process.env.NEXT_PUBLIC_MAFIA_DIAMOND || '0x0406a14729b0c77c187ac5229c8c2317589e73c0') as string,
            Groth16Verifier: '0xc5ece9781099a959626ca26529472af19cbc166f',
            LobbyFacet: '0x7bd7971f37fb455f4b38b9461e7b3f9e8c5a3787',
            ShuffleFacet: '0xdd1b4cdb7e647ac96cd7b34c971bba9f3390458d',
            VotingFacet: '0x277ca1b0123f4facff59830ae461086b64ba4719',
            NightFacet: '0x5475c783e17c65bb819db62b7ad29860d35cabc7',
            GameEndFacet: '0xe839ad0effcdc5c7090ab2da462a2e2b075edc57',
            TournamentFacet: '0x0a0870a5c0946c3386f485828958336e4917ff5e',
            TimeoutsFacet: '0x1c393242879ab7bda579d7bffe4bc6200eab08c9',
            RefundsFacet: '0x7f38c2292df18b77c6d83d7f0f3740aa0c1abcf8',
        },
    },
    somnia_mainnet: {
        chain: SOMNIA_MAINNET,
        chainId: 5031,
        explorer: 'https://explorer.somnia.network',
        contracts: {
            MafiaDiamond: process.env.NEXT_PUBLIC_MAFIA_DIAMOND || '',
            Groth16Verifier: process.env.NEXT_PUBLIC_GROTH16_VERIFIER || '',
            LobbyFacet: '',
            ShuffleFacet: '',
            VotingFacet: '',
            NightFacet: '',
            GameEndFacet: '',
            TournamentFacet: '',
            TimeoutsFacet: '',
            RefundsFacet: '',
        },
    },
};

const envNetwork = process.env.NEXT_PUBLIC_ACTIVE_NETWORK as SupportedNetwork | undefined;
export const ACTIVE_NETWORK: SupportedNetwork =
    envNetwork && envNetwork in NETWORKS ? envNetwork : 'somnia_testnet';
export const ACTIVE_DEPLOYMENT = DEPLOYMENTS[ACTIVE_NETWORK];

export function getDeployment(networkName: SupportedNetwork) {
    return DEPLOYMENTS[networkName];
}

export function getDeploymentByChainId(chainId?: number | null) {
    if (chainId == null) return ACTIVE_DEPLOYMENT;
    for (const deployment of Object.values(DEPLOYMENTS)) {
        if (deployment.chainId === chainId) return deployment;
    }
    return ACTIVE_DEPLOYMENT;
}

// Convenience aliases (used throughout the app)
export const somniaChain = ACTIVE_NETWORK === 'somnia_mainnet' ? SOMNIA_MAINNET : SOMNIA_TESTNET;
export const MAFIA_CONTRACT_ADDRESS = ACTIVE_DEPLOYMENT.contracts.MafiaDiamond as `0x${string}`;
export const MAFIA_ABI = DIAMOND_ABI;

export const GM_SERVER_URL = process.env.NEXT_PUBLIC_GM_SERVER_URL || 'https://gm-test.mafiaonchain.live';