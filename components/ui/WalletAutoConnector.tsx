'use client';
import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useGameContext } from '../../contexts/GameContext';

/**
 * WalletAutoConnector — officially recommended pattern by Privy.
 */
export function WalletAutoConnector() {
    const { useEmbeddedWallet } = useGameContext();
    const { ready, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const { setActiveWallet } = useSetActiveWallet();
    const { address: activeAddress } = useAccount();

    useEffect(() => {
        if (!ready || !authenticated || wallets.length === 0) return;

        // SE-FIX: Respect user preference for Embedded vs External
        const preferredWallet = useEmbeddedWallet
            ? wallets.find(w => w.walletClientType === 'privy')
            : wallets.find(w => w.walletClientType !== 'privy');

        // Fallback if preferred not available
        const targetWallet = preferredWallet || wallets[0];

        if (targetWallet && targetWallet.address.toLowerCase() !== activeAddress?.toLowerCase()) {
            console.log(`[WalletAutoConnector] Switching active wallet to ${targetWallet.address} (type: ${targetWallet.walletClientType}, preferred: ${useEmbeddedWallet ? 'embedded' : 'external'})`);
            setActiveWallet(targetWallet);
        }
    }, [ready, authenticated, wallets, setActiveWallet, activeAddress, useEmbeddedWallet]);

    return null;
}
