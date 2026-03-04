import { defineChain } from 'viem';
import MafiaDiamondABI from './MafiaDiamondABI.json';

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
    rpcUrls: { default: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] } },
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
            MafiaDiamond: '0xb34f8430f8a755c8c1bdc9dd19f14e263fc3f6b1',
            Groth16Verifier: '0xfa208d4ce645c9ce9c1957267d172d3627b9bd94',
            LobbyFacet: '0x5e0b3dbc999dc367c8f403bcf6169d6a599025ab',
            ShuffleFacet: '0x08d216915a693a9715cbaecfd34ebff272fd28ea',
            VotingFacet: '0xc1bd63870d30fa3d7f724dddeb28d6b0be3ca331',
            NightFacet: '0x4a3609c0acecf27b5cb02b11bd53a3ecf23dff60',
            GameEndFacet: '0xdbe019aef9864e859f069f2936a502e5ff051bc9',
        },
    },
    avalanche_fuji: {
        chain: AVALANCHE_FUJI,
        chainId: 43113,
        explorer: 'https://testnet.snowtrace.io',
        contracts: {
            MafiaDiamond: '0x3c1bd1923f8318247e2b60e41b0f280391c4e1e1',
            Groth16Verifier: '0x32d3612009c2d30c71c19d2548822e1eecb8d165',
            LobbyFacet: '0xb718ba5b6bccfa418f2971ea094f5b52a105c049',
            ShuffleFacet: '0xffa18547fde97a6d2f4df8af0ac545db9f5ae789',
            VotingFacet: '0x78616f773e7d9fef5dd7c6583dc642b238033a61',
            NightFacet: '0x72d4cfa33b2e7e6cce4a85bbd31147659f04a3be',
            GameEndFacet: '0xca5556d70fbb02544a1418c31cbc1a032d9676d8',
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

export const DIAMOND_ADDRESS = ACTIVE_DEPLOYMENT.contracts.MafiaDiamond as `0x${string}`;

export const FACETS = {
    LobbyFacet: ACTIVE_DEPLOYMENT.contracts.LobbyFacet,
    ShuffleFacet: ACTIVE_DEPLOYMENT.contracts.ShuffleFacet,
    VotingFacet: ACTIVE_DEPLOYMENT.contracts.VotingFacet,
    NightFacet: ACTIVE_DEPLOYMENT.contracts.NightFacet,
    GameEndFacet: ACTIVE_DEPLOYMENT.contracts.GameEndFacet,
} as const;

export const ZK_VERIFIER = ACTIVE_DEPLOYMENT.contracts.Groth16Verifier as `0x${string}`;

export const DIAMOND_ABI = MafiaDiamondABI;

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
    revealRole: 'VotingFacet',
    endGameAutomatically: 'VotingFacet',
    forcePhaseTimeout: 'VotingFacet',
    claimRefund: 'VotingFacet',

    commitNightAction: 'NightFacet',
    revealNightAction: 'NightFacet',
    sendMafiaMessage: 'NightFacet',
    commitMafiaTarget: 'NightFacet',
    revealMafiaTarget: 'NightFacet',
    endNight: 'NightFacet',
    resolveNightAsGameMaster: 'NightFacet',

    endGameZK: 'GameEndFacet',
} as const;

// Backward-compatible exports used across existing frontend modules
export const MAFIA_CONTRACT_ADDRESS = DIAMOND_ADDRESS;
export const VERIFIER_CONTRACT_ADDRESS = ZK_VERIFIER;
export const MAFIA_ABI = DIAMOND_ABI;
export const somniaChain = ACTIVE_DEPLOYMENT.chain;

// GM Server URL
export const GM_SERVER_URL = "https://mafia-voice.serveminecraft.net/gm";