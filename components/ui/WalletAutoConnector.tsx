'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { useSetActiveWallet } from '@privy-io/wagmi';

/** Read useEmbeddedWallet preference directly from localStorage (same key as GameContext) */
function getEmbeddedWalletPref(): boolean {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('mafia_use_embedded_wallet') !== 'false';
}

const subscribe = (cb: () => void) => {
    window.addEventListener('storage', cb);
    return () => window.removeEventListener('storage', cb);
};

/**
 * WalletAutoConnector — officially recommended pattern by Privy.
 *
 * Ensures the correct wallet (embedded vs external) is set as active
 * based on user's "Use In-Game Wallet" preference.
 *
 * Chain switching is NOT handled here. Privy supportedChains includes both
 * Somnia Testnet (default) and Somnia Mainnet; the active chain is driven
 * by NetworkSelector → wagmi useSwitchChain. This hook only picks the wallet.
 */
export function WalletAutoConnector() {
    const useEmbeddedWallet = useSyncExternalStore(subscribe, getEmbeddedWalletPref, () => true);
    const { ready, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const { setActiveWallet } = useSetActiveWallet();
    const { address: activeAddress, isConnecting, isReconnecting } = useAccount();

    useEffect(() => {
        if (!ready || !authenticated || wallets.length === 0) return;

        // Wait for wagmi to finish its initial reconnection to avoid prompting Metamask
        if (isConnecting || isReconnecting) return;

        // Respect user preference for Embedded vs External
        const preferredWallet = useEmbeddedWallet
            ? wallets.find(w => w.walletClientType === 'privy')
            : wallets.find(w => w.walletClientType !== 'privy');

        // When user wants external wallet: never fall back to embedded.
        // If MetaMask is locked/not yet detected, do nothing — the wallet manager
        // will prompt the user to unlock it via window.ethereum when they take action.
        if (!preferredWallet) {
            if (!useEmbeddedWallet) {
                console.log('[WalletAutoConnector] External wallet preferred but not yet available — skipping active wallet switch');
            }
            return;
        }

        const targetWallet = preferredWallet;

        if (targetWallet.address.toLowerCase() !== activeAddress?.toLowerCase()) {
            // Don't force setActiveWallet for external wallets if wagmi has no active address yet
            if (!activeAddress && targetWallet.walletClientType !== 'privy') {
                return;
            }

            console.log(`[WalletAutoConnector] Switching active wallet to ${targetWallet.address} (type: ${targetWallet.walletClientType}, preferred: ${useEmbeddedWallet ? 'embedded' : 'external'})`);
            setActiveWallet(targetWallet);
        }
    }, [ready, authenticated, wallets, setActiveWallet, activeAddress, useEmbeddedWallet, isConnecting, isReconnecting]);

    return null;
}
