/**
 * useWalletManager — Wallet selection, session wallet, chain switching.
 *
 * Handles:
 * - Active wallet selection (Privy embedded vs external vs Wagmi)
 * - Session key wallet client caching with nonceManager
 * - Chain switching
 * - Lobby funding value calculation
 */
import { useCallback, useRef, useMemo } from 'react';
import { createWalletClient, http, fallback, parseEther, custom, type WalletClient } from 'viem';
import { privateKeyToAccount, nonceManager } from 'viem/accounts';
import { loadSession } from '../../services/sessionKeyService';
import type { GameRefs } from './useGameRefs';

export function useWalletManager(refs: GameRefs, useEmbeddedWallet: boolean) {
    const walletSwitchPromiseRef = useRef<Promise<void> | null>(null);

    // === LOBBY FUNDING VALUE ===
    const LOBBY_FUNDING_VALUE = useMemo(() => {
        const chainId = Number(refs.runtimeChain.id);
        const isSomnia = (chainId === 5031 || chainId === 50312);
        return isSomnia ? parseEther('0.8') : parseEther('0.8');
    }, [refs.runtimeChain.id]);

    // === ACTIVE WALLET CLIENT ===
    const getActiveWalletClient = useCallback(async () => {
        const wallets = refs.walletsRef.current;
        const targetChain = refs.runtimeChainRef.current;

        let selectedWallet: any = null;
        if (useEmbeddedWallet) {
            selectedWallet = wallets.find(w => w.walletClientType === 'privy');
        } else {
            selectedWallet = wallets.find(w => w.walletClientType !== 'privy');

            if (!selectedWallet && refs.walletClientRef.current && refs.addressRef.current) {
                console.log('[WalletSelect] Using Wagmi-connected balance/wallet client');
                try {
                    const currentChainId = await refs.walletClientRef.current.getChainId();
                    if (currentChainId !== targetChain.id) {
                        try {
                            await refs.walletClientRef.current.switchChain({ id: targetChain.id });
                        } catch (swErr) {
                            console.warn('[WalletSelect] Wagmi switchChain failed, continuing...', swErr);
                        }
                    }
                } catch (e) {
                    console.error('[WalletSelect] Wagmi client error:', e);
                }

                if (refs.walletClientRef.current.account) {
                    refs.addressRef.current = refs.walletClientRef.current.account.address;
                }
                return { client: refs.walletClientRef.current, account: refs.addressRef.current as `0x${string}` };
            }
        }

        if (!selectedWallet && wallets.length > 0) {
            console.log('[WalletSelect] Preferred wallet not found, falling back to first available Privy wallet');
            selectedWallet = wallets[0];
        }

        if (selectedWallet) {
            refs.addressRef.current = selectedWallet.address as `0x${string}`;

            const rawChainId = selectedWallet.chainId;
            let currentChainId = 0;
            if (typeof rawChainId === 'string' && rawChainId.includes(':')) {
                currentChainId = Number(rawChainId.split(':')[1]);
            } else {
                currentChainId = Number(rawChainId);
            }

            if (currentChainId > 0 && Number.isFinite(currentChainId) && currentChainId !== targetChain.id) {
                if (!walletSwitchPromiseRef.current) {
                    console.log(`[Wallet] Switching wallet ${selectedWallet.address} from ${currentChainId} to ${targetChain.id}`);
                    walletSwitchPromiseRef.current = selectedWallet.switchChain(targetChain.id).finally(() => {
                        walletSwitchPromiseRef.current = null;
                    });
                }
                await walletSwitchPromiseRef.current;
            }

            const provider = await selectedWallet.getEthereumProvider();
            return {
                client: createWalletClient({
                    account: selectedWallet.address as `0x${string}`,
                    chain: targetChain,
                    transport: custom(provider)
                }),
                account: selectedWallet.address as `0x${string}`
            };
        }

        if (refs.walletClientRef.current && refs.addressRef.current) {
            return { client: refs.walletClientRef.current, account: refs.addressRef.current as `0x${string}` };
        }
        throw new Error("No connected wallet found");
    }, [useEmbeddedWallet, refs]);

    // === CACHED SESSION WALLET CLIENT ===
    const sessionClientRef = useRef<{ client: WalletClient; key: string } | null>(null);

    const getSessionWalletClient = useCallback(() => {
        const session = loadSession();
        if (!session || !session.registeredOnChain || Date.now() >= session.expiresAt) {
            return null;
        }

        try {
            const cacheKey = `${session.privateKey}:${session.roomId}`;
            if (sessionClientRef.current && sessionClientRef.current.key === cacheKey) {
                return sessionClientRef.current.client;
            }

            const account = privateKeyToAccount(session.privateKey, { nonceManager });
            console.log(`[Session Debug] Creating new cached client for ${account.address}`);

            const fallbackTransports = refs.runtimeChainRef.current.rpcUrls.default.http.map((url: string) => http(url, {
                timeout: 8_000,
                batch: { batchSize: 20, wait: 16 },
            }));

            const client = createWalletClient({
                account,
                chain: refs.runtimeChainRef.current,
                transport: fallback(fallbackTransports, {
                    rank: {
                        interval: 60_000,
                        timeout: 5_000,
                    }
                }),
            });
            sessionClientRef.current = { client, key: cacheKey };
            return client;
        } catch (err) {
            console.error("[Session Debug] Failed to create client:", err);
            return null;
        }
    }, [refs]);

    return {
        getActiveWalletClient,
        getSessionWalletClient,
        LOBBY_FUNDING_VALUE,
    };
}

export type WalletManager = ReturnType<typeof useWalletManager>;
