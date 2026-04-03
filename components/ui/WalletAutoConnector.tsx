'use client';
import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useGameContext } from '../../contexts/GameContext';

/**
 * WalletAutoConnector — officially recommended pattern by Privy.
 * 
 * Ensures the correct wallet (embedded vs external) is set as active
 * based on user's "Use In-Game Wallet" preference.
 * 
 * Chain switching is NOT needed here because Privy is configured with
 * defaultChain: SOMNIA_TESTNET and supportedChains: [SOMNIA_TESTNET] only,
 * so both embedded and external wallets will be on Somnia by default.
 */
export function WalletAutoConnector() {
    const { useEmbeddedWallet } = useGameContext();
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

        // Fallback if preferred not available
        const targetWallet = preferredWallet || wallets[0];

        if (targetWallet && targetWallet.address.toLowerCase() !== activeAddress?.toLowerCase()) {
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
