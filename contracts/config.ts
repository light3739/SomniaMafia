import { defineChain } from 'viem';
import MafiaPortalArtifact from './MafiaPortal.json';

// Self-hosted RPC proxy URL — bypasses Avalanche CORS restrictions.
// On production: https://test.mafiaonchain.live/api/rpc/fuji
// Locally: /api/rpc/fuji (Next.js rewrite handles it)
const APP_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) || '';
const FUJI_PROXY_RPC = `${APP_URL}/api/rpc/fuji`;

export const SOMNIA_TESTNET = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
    rpcUrls: { default: { http: ['https://dream-rpc.somnia.network/'] } },
    blockExplorers: { default: { name: 'Explorer', url: 'https://shannon-explorer.somnia.network' } },
    testnet: true,
});

export const AVALANCHE_FUJI = defineChain({
    id: 43113,
    name: 'Avalanche Fuji C-Chain',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: {
        default: {
            http: [
                // CORS-friendly public RPCs first — these work from the browser
                'https://avalanche-fuji.drpc.org',
                'https://avalanche-fuji-c-chain-rpc.publicnode.com',
                // Self-hosted proxy: proxies api.avax-test.network server-side, no CORS issues
                FUJI_PROXY_RPC,
            ]
        }
    },
    blockExplorers: { default: { name: 'Snowtrace', url: 'https://testnet.snowtrace.io' } },
    testnet: true,
});

export const NETWORKS = {
    somnia_testnet: SOMNIA_TESTNET,
    avalanche_fuji: AVALANCHE_FUJI,
} as const;

export type SupportedNetwork = keyof typeof NETWORKS;

export const DEPLOYMENTS = {
    somnia_testnet: {
        chain: SOMNIA_TESTNET,
        chainId: 50312,
        explorer: 'https://shannon-explorer.somnia.network',
        contracts: {
            MafiaDiamond: '0x923db96df1193aba3f748e8af3922bdf07056b5c',
            Groth16Verifier: '0x89dc5dd2b0fde7567bf07378dea2d92b27f77dad',
            LobbyFacet: '0xed10a914c3e4d58a59c8a7187c00e22ebc61018f',
            ShuffleFacet: '0xa9891f7c304507e0d1b1a999b6bb4efce0a587e6',
            VotingFacet: '0xec4c0f50bdb5876f07876aaa7c1f60d1ac4b55eb',
            NightFacet: '0x3dc4aea47e47385c7e164e81f3493d8829d12be6',
            GameEndFacet: '0xb6f3b3ae08a8bea81f25f3a84e447a78d9d38d6a',
            TournamentFacet: '0xf4ce41ea79372d4e42bbaefa311304cc00536212',
        },
    },
    avalanche_fuji: {
        chain: AVALANCHE_FUJI,
        chainId: 43113,
        explorer: 'https://testnet.snowtrace.io',
        contracts: {
            MafiaDiamond: '0x740d9e5095acc228860509e46cfac1b8a517998c',
            Groth16Verifier: '0xd496f9db9ffd11f796e80defe7fe3d50d7cac054',
            LobbyFacet: '0x4588ae093e5a48c7fac26b64a9b2d76e3ea8f0f1',
            ShuffleFacet: '0x4816443d62531cb89a0f8441de5ea6b3f2cb9852',
            VotingFacet: '0xe1a108781eafc349ebc99c660256fe2a55529303',
            NightFacet: '0x9da23a22067aba881951314479e77cc2f1967010',
            GameEndFacet: '0x7a8a308455a41cc0be3ece888d993d3b5672b377',
            TournamentFacet: '0xa198a5828f5f168aecda19b36309d4c555264ca4',
        },
    },
} as const;

const envNetwork = process.env.NEXT_PUBLIC_ACTIVE_NETWORK as SupportedNetwork | undefined;
export const ACTIVE_NETWORK: SupportedNetwork = envNetwork && envNetwork in DEPLOYMENTS
    ? envNetwork
    : 'avalanche_fuji';
export const ACTIVE_DEPLOYMENT = DEPLOYMENTS[ACTIVE_NETWORK];

export function getDeployment(network: SupportedNetwork) {
    return DEPLOYMENTS[network];
}

export function getDeploymentByChainId(chainId?: number | null) {
    if (chainId === AVALANCHE_FUJI.id) return DEPLOYMENTS.avalanche_fuji;
    if (chainId === SOMNIA_TESTNET.id) return DEPLOYMENTS.somnia_testnet;
    return ACTIVE_DEPLOYMENT;
}

export const DIAMOND_ADDRESS = ACTIVE_DEPLOYMENT.contracts.MafiaDiamond as `0x${string}`;

export const FACETS = {
    LobbyFacet: ACTIVE_DEPLOYMENT.contracts.LobbyFacet,
    ShuffleFacet: ACTIVE_DEPLOYMENT.contracts.ShuffleFacet,
    VotingFacet: ACTIVE_DEPLOYMENT.contracts.VotingFacet,
    NightFacet: ACTIVE_DEPLOYMENT.contracts.NightFacet,
    GameEndFacet: ACTIVE_DEPLOYMENT.contracts.GameEndFacet,
} as const;

export const ZK_VERIFIER = ACTIVE_DEPLOYMENT.contracts.Groth16Verifier as `0x${string}`;

// Use the new monolithic ABI instead of the out-of-date Diamond ABI
export const DIAMOND_ABI = MafiaPortalArtifact.abi;

export const FUNCTION_MAP = {
    createAndJoin: 'LobbyFacet',
    joinRoom: 'LobbyFacet',
    startGame: 'LobbyFacet',
    setZkVerifier: 'LobbyFacet',
    setGameMaster: 'LobbyFacet',
    setDefaultDeposit: 'LobbyFacet',
    pause: 'LobbyFacet',
    unpause: 'LobbyFacet',
    withdrawFees: 'LobbyFacet',
    registerSessionKey: 'LobbyFacet',
    getPlayers: 'LobbyFacet',
    getRoom: 'LobbyFacet',
    getDeck: 'LobbyFacet',
    getPlayerDeposit: 'LobbyFacet',
    isSessionKeyValid: 'LobbyFacet',

    commitDeck: 'ShuffleFacet',
    revealDeck: 'ShuffleFacet',
    shareKeysToAll: 'ShuffleFacet',
    commitAndConfirmRole: 'ShuffleFacet',
    commitRole: 'ShuffleFacet',
    confirmRole: 'ShuffleFacet',

    startVoting: 'VotingFacet',
    vote: 'VotingFacet',
    finalizeVoting: 'VotingFacet',
    forcePhaseTimeout: 'VotingFacet',

    commitNightAction: 'NightFacet',
    revealNightAction: 'NightFacet',
    mafiaMessage: 'NightFacet',
    commitMafiaTarget: 'NightFacet',
    revealMafiaTarget: 'NightFacet',
    endNight: 'NightFacet',
    resolveNightAsGameMaster: 'NightFacet',

    endGameZK: 'GameEndFacet',

    createTournament: 'TournamentFacet',
    cancelTournament: 'TournamentFacet',
    joinTournament: 'TournamentFacet',
    distributeMafiaPrizes: 'TournamentFacet',
    toggleTournamentWhitelist: 'TournamentFacet',
    addToTournamentWhitelist: 'TournamentFacet',
    removeFromTournamentWhitelist: 'TournamentFacet',
} as const;

// Backward-compatible exports used across existing frontend modules
export const MAFIA_CONTRACT_ADDRESS = DIAMOND_ADDRESS;
export const VERIFIER_CONTRACT_ADDRESS = ZK_VERIFIER;
export const MAFIA_ABI = DIAMOND_ABI;
export const somniaChain = ACTIVE_DEPLOYMENT.chain;

// GM Server URL
export const GM_SERVER_URL = process.env.NEXT_PUBLIC_GM_SERVER_URL || "https://gm.mafiaonchain.live";