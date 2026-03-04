import { type Address } from 'viem';
export declare const avalancheFuji: {
    blockExplorers: {
        readonly default: {
            readonly name: "Snowtrace";
            readonly url: "https://testnet.snowtrace.io";
        };
    };
    blockTime?: number | undefined | undefined;
    contracts?: {
        [x: string]: import("viem").ChainContract | {
            [sourceId: number]: import("viem").ChainContract | undefined;
        } | undefined;
        ensRegistry?: import("viem").ChainContract | undefined;
        ensUniversalResolver?: import("viem").ChainContract | undefined;
        multicall3?: import("viem").ChainContract | undefined;
        erc6492Verifier?: import("viem").ChainContract | undefined;
    } | undefined;
    ensTlds?: readonly string[] | undefined;
    id: 43113;
    name: "Avalanche Fuji C-Chain";
    nativeCurrency: {
        readonly name: "Avalanche";
        readonly symbol: "AVAX";
        readonly decimals: 18;
    };
    experimental_preconfirmationTime?: number | undefined | undefined;
    rpcUrls: {
        readonly default: {
            readonly http: readonly [string];
        };
    };
    sourceId?: number | undefined | undefined;
    testnet: true;
    custom?: Record<string, unknown> | undefined;
    extendSchema?: Record<string, unknown> | undefined;
    fees?: import("viem").ChainFees<undefined> | undefined;
    formatters?: undefined;
    prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
        runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
    }] | undefined;
    serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
    verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
};
export declare const somniaTestnet: {
    blockExplorers: {
        readonly default: {
            readonly name: "Explorer";
            readonly url: "https://shannon-explorer.somnia.network";
        };
    };
    blockTime?: number | undefined | undefined;
    contracts?: {
        [x: string]: import("viem").ChainContract | {
            [sourceId: number]: import("viem").ChainContract | undefined;
        } | undefined;
        ensRegistry?: import("viem").ChainContract | undefined;
        ensUniversalResolver?: import("viem").ChainContract | undefined;
        multicall3?: import("viem").ChainContract | undefined;
        erc6492Verifier?: import("viem").ChainContract | undefined;
    } | undefined;
    ensTlds?: readonly string[] | undefined;
    id: 50312;
    name: "Somnia Testnet";
    nativeCurrency: {
        readonly name: "STT";
        readonly symbol: "STT";
        readonly decimals: 18;
    };
    experimental_preconfirmationTime?: number | undefined | undefined;
    rpcUrls: {
        readonly default: {
            readonly http: readonly [string];
        };
    };
    sourceId?: number | undefined | undefined;
    testnet: true;
    custom?: Record<string, unknown> | undefined;
    extendSchema?: Record<string, unknown> | undefined;
    fees?: import("viem").ChainFees<undefined> | undefined;
    formatters?: undefined;
    prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
        runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
    }] | undefined;
    serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable> | undefined;
    verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
};
export declare const DIAMOND_ABI: readonly [{
    readonly type: "function";
    readonly name: "resolveNightAsGameMaster";
    readonly inputs: readonly [{
        readonly name: "roomId";
        readonly type: "uint256";
    }, {
        readonly name: "killTarget";
        readonly type: "address";
    }, {
        readonly name: "healTarget";
        readonly type: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "getRoom";
    readonly inputs: readonly [{
        readonly name: "roomId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "id";
            readonly type: "uint64";
        }, {
            readonly name: "host";
            readonly type: "address";
        }, {
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly name: "phase";
            readonly type: "uint8";
        }, {
            readonly name: "maxPlayers";
            readonly type: "uint8";
        }, {
            readonly name: "playersCount";
            readonly type: "uint8";
        }, {
            readonly name: "aliveCount";
            readonly type: "uint8";
        }, {
            readonly name: "dayCount";
            readonly type: "uint16";
        }, {
            readonly name: "currentShufflerIndex";
            readonly type: "uint8";
        }, {
            readonly name: "lastActionTimestamp";
            readonly type: "uint32";
        }, {
            readonly name: "phaseDeadline";
            readonly type: "uint32";
        }, {
            readonly name: "confirmedCount";
            readonly type: "uint8";
        }, {
            readonly name: "votedCount";
            readonly type: "uint8";
        }, {
            readonly name: "committedCount";
            readonly type: "uint8";
        }, {
            readonly name: "revealedCount";
            readonly type: "uint8";
        }, {
            readonly name: "keysSharedCount";
            readonly type: "uint8";
        }, {
            readonly name: "depositPool";
            readonly type: "uint128";
        }, {
            readonly name: "depositPerPlayer";
            readonly type: "uint128";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "getPlayers";
    readonly inputs: readonly [{
        readonly name: "roomId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly name: "wallet";
            readonly type: "address";
        }, {
            readonly name: "nickname";
            readonly type: "string";
        }, {
            readonly name: "publicKey";
            readonly type: "bytes";
        }, {
            readonly name: "flags";
            readonly type: "uint32";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "sessionKeys";
    readonly inputs: readonly [{
        readonly name: "wallet";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "sessionAddress";
            readonly type: "address";
        }, {
            readonly name: "expiresAt";
            readonly type: "uint32";
        }, {
            readonly name: "roomId";
            readonly type: "uint64";
        }, {
            readonly name: "isActive";
            readonly type: "bool";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "playerRoles";
    readonly inputs: readonly [{
        readonly name: "roomId";
        readonly type: "uint256";
    }, {
        readonly name: "player";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "PhaseChanged";
    readonly inputs: readonly [{
        readonly name: "roomId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "newPhase";
        readonly type: "uint8";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly name: "NightResolvedByGM";
    readonly inputs: readonly [{
        readonly name: "roomId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "killTarget";
        readonly type: "address";
        readonly indexed: false;
    }, {
        readonly name: "healTarget";
        readonly type: "address";
        readonly indexed: false;
    }];
}];
export declare const GM_ADDRESS: `0x${string}`;
export declare function getChainConfig(chainId?: number): {
    public: any;
    wallet: any;
    diamond: Address;
};
/** GamePhase enum values matching Solidity */
export declare const GamePhase: {
    readonly LOBBY: 0;
    readonly SHUFFLING: 1;
    readonly REVEAL: 2;
    readonly DAY: 3;
    readonly VOTING: 4;
    readonly NIGHT: 5;
    readonly ENDED: 6;
};
/** FLAG constants matching LibGame.sol exactly */
export declare const FLAGS: {
    readonly CONFIRMED_ROLE: 1;
    readonly ACTIVE: 2;
    readonly HAS_VOTED: 4;
    readonly HAS_COMMITTED: 8;
    readonly HAS_REVEALED: 16;
    readonly HAS_SHARED_KEYS: 32;
    readonly DECK_COMMITTED: 64;
    readonly CLAIMED_MAFIA: 128;
    readonly CLAIMED_DETECTIVE: 256;
};
/** Role enum matching MafiaTypes.sol */
export declare const Role: {
    readonly NONE: 0;
    readonly MAFIA: 1;
    readonly DOCTOR: 2;
    readonly DETECTIVE: 3;
    readonly CITIZEN: 4;
};
/** Map action type string to required role (used for logging only) */
export declare const ACTION_TO_ROLE: Record<string, number>;
export declare function getRoom(roomId: bigint, chainId?: number): Promise<any>;
export declare function getPlayers(roomId: bigint, chainId?: number): Promise<any>;
export declare function hasCommittedRole(roomId: bigint, player: Address, chainId?: number): Promise<boolean>;
export declare function getSessionKey(mainWallet: Address, chainId?: number): Promise<any>;
export declare function resolveNight(roomId: bigint, killTarget: Address, healTarget: Address, chainId?: number): Promise<{
    hash: any;
    receipt: any;
}>;
export declare function assertChainConfigOrThrow(): Promise<void>;
