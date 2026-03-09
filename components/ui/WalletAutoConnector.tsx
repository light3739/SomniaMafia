'use client';
import { useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useConnect } from 'wagmi';
import { config } from '../../app/providers';

/**
 * WalletAutoConnector — bridges Privy's embedded wallet into Wagmi.
 * After a social login (Google/Twitter/Discord), Privy creates an embedded
 * wallet but Wagmi doesn't know about it yet. This component watches for
 * that state and connects the wallet automatically.
 */
export function WalletAutoConnector() {
    const { authenticated, ready } = usePrivy();
    const { wallets } = useWallets();
    const { connect, connectors } = useConnect();

    useEffect(() => {
        if (!ready || !authenticated) return;
        if (wallets.length === 0) return;

        // Find the Privy connector registered in wagmi config
        const privyConnector = connectors.find(c => c.id === 'io.privy.wallet' || c.name?.toLowerCase().includes('privy'));
        if (!privyConnector) return;

        // Only connect if not already connected
        privyConnector.getAccounts().then(accounts => {
            if (accounts.length === 0) {
                connect({ connector: privyConnector });
            }
        }).catch(() => {
            // Connector not ready yet, will retry on next render
        });
    }, [ready, authenticated, wallets, connectors, connect]);

    return null;
}
