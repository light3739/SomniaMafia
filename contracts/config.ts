import { defineChain } from 'viem';
import MafiaPortalArtifact from './MafiaDiamondABI.json';

// Self-hosted RPC proxy URL — bypasses Avalanche CORS restrictions.
// On production: https://test.mafiaonchain.live/api/rpc/fuji
// Locally: /api/rpc/fuji (Next.js rewrite handles it)
const APP_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) || '';
const FUJI_PROXY_RPC = `${APP_URL}/api/rpc/fuji`;

export const SOMNIA_TESTNET = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'Somnia Testnet Token', symbol: 'ETH', decimals: 18 },
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
            MafiaDiamond: '0x0406a14729b0c77c187ac5229c8c2317589e73c0',
            Groth16Verifier: '0xb56df1a4a17d3c6b404b2644ee123fd29f418eef',
            LobbyFacet: '0x18e9c58fe6551afa478857383f27e3d2a63e5865',
            ShuffleFacet: '0x491fc954e1dac0fcf9709846ca5726b7bd016cb3',
            VotingFacet: '0x149218b770dd5e16103972795d623ad7ad6fee4c',
            NightFacet: '0x7b97a1575e762003dd352b6af13aae3c443a32af',
            GameEndFacet: '0xec65050759cb1c78b957b564517cf2666befaf5a',
            TournamentFacet: '0xbb414c08e021cba12c3c1da17a2ffde55a38af9d',
        },
    },
    avalanche_fuji: {
        chain: AVALANCHE_FUJI,
        chainId: 43113,
        explorer: 'https://testnet.snowtrace.io',
        contracts: {
            MafiaDiamond: '0x740d9e5095acc228860509e46cfac1b8a517998c',
            Groth16Verifier: '0x13467da1c154c4e0e8674744edf734985d66b4c9',
            LobbyFacet: '0x175d551902ceb466ceaaee3ab644017a162f90a2',
            ShuffleFacet: '0x4816443d62531cb89a0f8441de5ea6b3f2cb9852',
            VotingFacet: '0x5543f217fe2134b2d9e38695e4660194725dff53',
            NightFacet: '0x411b39bf773f6e646427ab8d8bc4fda9cc141b82',
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
export const DIAMOND_ABI = MafiaPortalArtifact as any;

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
    resolveNightAsGameMaster: 'NightFacet',

    endGameZK: 'GameEndFacet',

    createTournament: 'TournamentFacet',
    cancelTournament: 'TournamentFacet',
    joinTournament: 'TournamentFacet',
    getTournament: 'TournamentFacet',
    isTournamentParticipant: 'TournamentFacet',
    distributeMafiaPrizes: 'TournamentFacet',
    toggleTournamentWhitelist: 'TournamentFacet',
    addToTournamentWhitelist: 'TournamentFacet',
    removeFromTournamentWhitelist: 'TournamentFacet',
    createTournamentAndRoom: 'TournamentFacet',
} as const;

// Backward-compatible exports used across existing frontend modules
export const MAFIA_CONTRACT_ADDRESS = DIAMOND_ADDRESS;
export const VERIFIER_CONTRACT_ADDRESS = ZK_VERIFIER;
export const MAFIA_ABI = DIAMOND_ABI;
export const somniaChain = ACTIVE_DEPLOYMENT.chain;

// GM Server URL
export const GM_SERVER_URL = process.env.NEXT_PUBLIC_GM_SERVER_URL || "https://gm.mafiaonchain.live";