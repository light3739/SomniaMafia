"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.somniaChain = exports.MAFIA_ABI = exports.VERIFIER_CONTRACT_ADDRESS = exports.MAFIA_CONTRACT_ADDRESS = void 0;
const MafiaPortal_1 = require("./MafiaPortal");
exports.MAFIA_CONTRACT_ADDRESS = "0x3C1Bd1923F8318247e2B60E41B0F280391c4e1E1";
exports.VERIFIER_CONTRACT_ADDRESS = "0x32D3612009c2d30C71C19d2548822E1EECb8D165";
exports.MAFIA_ABI = MafiaPortal_1.MafiaABI.abi;
// Somnia Mainnet chain config
exports.somniaChain = {
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
};
