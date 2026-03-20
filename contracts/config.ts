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
            LobbyFacet: '0xa4441d9106a37024965b90f7d9caf6dcae9a2f7c',
            ShuffleFacet: '0x491fc954e1dac0fcf9709846ca5726b7bd016cb3',
            VotingFacet: '0x149218b770dd5e16103972795d623ad7ad6fee4c',
            NightFacet: '0x7b97a1575e762003dd352b6af13aae3c443a32af',
            GameEndFacet: '0xec65050759cb1c78b957b564517cf2666befaf5a',
            TournamentFacet: '0x76ce2bdc9c06a5bed75e51c95c204da3b41fc968',
        },
    },
    avalanche_fuji: {
        chain: AVALANCHE_FUJI,
        chainId: 43113,
        explorer: 'https://testnet.snowtrace.io',
        contracts: {
            MafiaDiamond: '0x45343671c3a3149891bf95adadc2d87c52194149',
            Groth16Verifier: '0xe11f4204f78d07b58daee1ec3aef35e96474c220',
            LobbyFacet: '0xb10fe95b7ce212e5868d64167abedd7a62b9a1d1',
            ShuffleFacet: '0xf5790ea4862bf5652125cbf605d3807727ce95c9',
            VotingFacet: '0x83fa087234676414768e52f6603aae4a064b4ca8',
            NightFacet: '0x3979b67a7e01ae19bf3f28d7860834b2b06fd955',
            GameEndFacet: '0x5ff0aca7afbc6d1e6b64730a3ffbf956a20a3ec2',
            TournamentFacet: '0xa7230f6fa147db16a0a1f977a32808d4274b6c44',
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
    endNight: 'NightFacet',
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