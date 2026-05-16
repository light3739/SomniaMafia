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
            // Redeployed 2026-05-16 from clean wallet 0x3D9297... (the old
            // testnet diamond 0x0406...c0 was owned by a drainer-compromised
            // wallet — addresses happen to match mainnet because the clean
            // wallet was nonce-zero on testnet at deploy time).
            MafiaDiamond: '0x031b6746155ce11c7b533935f4674f5fc4682338',
            Groth16Verifier: '0x69a17a154cf175c2e3488fb663c57b97fa0c06a1',
            LobbyFacet: '0x23e4d9b559c8c2b3fa57ce122617a8825132577d',
            ShuffleFacet: '0x3ff67d6ae70226bb2372c5c49ee69ba05b7bd392',
            VotingFacet: '0xa4831b9bf490441c65d1729d00ee25cfaf92ea23',
            NightFacet: '0x1938d49d78672a207ee6655ca3779e92f6d4f019',
            GameEndFacet: '0xb55d1bafd3bdda7f0683525b13832fe80c57bc9f',
            TournamentFacet: '0x93564b82c38d747573c1849e557b67c1c057207e',
            TimeoutsFacet: '0x754723f7d414cddda4f26b41ed8857567d54150d',
            RefundsFacet: '0x1faafda8ef301f5ae61e5bf2ec292df81ce478c1',
        },
    },
    somnia_mainnet: {
        chain: SOMNIA_MAINNET,
        chainId: 5031,
        explorer: 'https://explorer.somnia.network',
        contracts: {
            MafiaDiamond: '0x031b6746155ce11c7b533935f4674f5fc4682338',
            Groth16Verifier: '0x69a17a154cf175c2e3488fb663c57b97fa0c06a1',
            LobbyFacet: '0x23e4d9b559c8c2b3fa57ce122617a8825132577d',
            ShuffleFacet: '0x3ff67d6ae70226bb2372c5c49ee69ba05b7bd392',
            VotingFacet: '0xa4831b9bf490441c65d1729d00ee25cfaf92ea23',
            NightFacet: '0x1938d49d78672a207ee6655ca3779e92f6d4f019',
            GameEndFacet: '0xb55d1bafd3bdda7f0683525b13832fe80c57bc9f',
            TournamentFacet: '0x93564b82c38d747573c1849e557b67c1c057207e',
            TimeoutsFacet: '0x754723f7d414cddda4f26b41ed8857567d54150d',
            RefundsFacet: '0x1faafda8ef301f5ae61e5bf2ec292df81ce478c1',
        },
    },
};

// First-visit default when user has no chain preference yet.
// Runtime swap (NetworkSelector + wagmi useChainId) overrides this per-React-tree.
export const DEFAULT_NETWORK: SupportedNetwork = 'somnia_testnet';

const envNetwork = process.env.NEXT_PUBLIC_ACTIVE_NETWORK as SupportedNetwork | undefined;
// ACTIVE_NETWORK is the build-time fallback used only by non-React code paths
// (SSR, API routes that have no chainId in body). React code MUST resolve the
// current chain via useChainId() + getDeploymentByChainId().
export const ACTIVE_NETWORK: SupportedNetwork =
    envNetwork && envNetwork in NETWORKS ? envNetwork : DEFAULT_NETWORK;
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

export function chainIdToNetwork(chainId?: number | null): SupportedNetwork {
    if (chainId === SOMNIA_MAINNET.id) return 'somnia_mainnet';
    if (chainId === SOMNIA_TESTNET.id) return 'somnia_testnet';
    return ACTIVE_NETWORK;
}

export function getChainById(chainId?: number | null) {
    if (chainId === SOMNIA_MAINNET.id) return SOMNIA_MAINNET;
    if (chainId === SOMNIA_TESTNET.id) return SOMNIA_TESTNET;
    return DEPLOYMENTS[ACTIVE_NETWORK].chain;
}

export const SUPPORTED_CHAIN_IDS = [SOMNIA_MAINNET.id, SOMNIA_TESTNET.id] as const;

// Convenience aliases — STATIC, derived from build-time ACTIVE_NETWORK.
// Safe in SSR / non-React contexts. In React code prefer useChainId() +
// getDeploymentByChainId() so the user's current chain wins over the default.
export const somniaChain = ACTIVE_NETWORK === 'somnia_mainnet' ? SOMNIA_MAINNET : SOMNIA_TESTNET;
export const MAFIA_CONTRACT_ADDRESS = ACTIVE_DEPLOYMENT.contracts.MafiaDiamond as `0x${string}`;
export const MAFIA_ABI = DIAMOND_ABI;

export const GM_SERVER_URL = process.env.NEXT_PUBLIC_GM_SERVER_URL || 'https://gm-test.mafiaonchain.live';