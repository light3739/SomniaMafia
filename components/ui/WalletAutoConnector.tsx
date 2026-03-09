'use client';
import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';

/**
 * WalletAutoConnector — officially recommended pattern by Privy.
 * After a social login (Google/Twitter/Discord/Email), Privy creates an
 * embedded wallet. This component finds it and calls setActiveWallet()
 * so Wagmi's useAccount().isConnected becomes true automatically.
 *
 * Docs: https://docs.privy.io/guide/wagmi#set-the-active-wallet
 */
export function WalletAutoConnector() {
    const { ready, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const { setActiveWallet } = useSetActiveWallet();

    useEffect(() => {
        if (!ready || !authenticated) return;
        if (wallets.length === 0) return;

        // Prefer the Privy embedded wallet (walletClientType === 'privy')
        // Fall back to first available wallet if no embedded wallet
        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
            ?? wallets[0];

        if (embeddedWallet) {
            setActiveWallet(embeddedWallet);
        }
    }, [ready, authenticated, wallets, setActiveWallet]);

    return null;
}
