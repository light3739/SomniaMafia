'use client';
import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { useSetActiveWallet } from '@privy-io/wagmi';

/**
 * WalletAutoConnector — officially recommended pattern by Privy.
 */
export function WalletAutoConnector() {
    const { ready, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const { setActiveWallet } = useSetActiveWallet();
    const { address: activeAddress } = useAccount();

    useEffect(() => {
        if (!ready || !authenticated || wallets.length === 0) return;

        const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
            ?? wallets[0];

        if (embeddedWallet && embeddedWallet.address.toLowerCase() !== activeAddress?.toLowerCase()) {
            console.log(`[WalletAutoConnector] Setting active wallet to ${embeddedWallet.address}`);
            setActiveWallet(embeddedWallet);
        }
    }, [ready, authenticated, wallets, setActiveWallet, activeAddress]);

    return null;
}
