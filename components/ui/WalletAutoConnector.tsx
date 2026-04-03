'use client';
import { useEffect, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount, useSwitchChain } from 'wagmi';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { useGameContext } from '../../contexts/GameContext';
import { ACTIVE_DEPLOYMENT } from '../../contracts/config';

/**
 * WalletAutoConnector — officially recommended pattern by Privy.
 * After selecting the wallet, ensures the chain is switched to the active deployment network.
 */
export function WalletAutoConnector() {
    const { useEmbeddedWallet } = useGameContext();
    const { ready, authenticated } = usePrivy();
    const { wallets } = useWallets();
    const { setActiveWallet } = useSetActiveWallet();
    const { switchChainAsync } = useSwitchChain();
    const { address: activeAddress, chainId, isConnecting, isReconnecting } = useAccount();
    const switchingRef = useRef(false);

    useEffect(() => {
        if (!ready || !authenticated || wallets.length === 0) return;

        // Wait for wagmi to finish its initial reconnection to avoid prompting Metamask
        if (isConnecting || isReconnecting) return;

        // SE-FIX: Respect user preference for Embedded vs External
        const preferredWallet = useEmbeddedWallet
            ? wallets.find(w => w.walletClientType === 'privy')
            : wallets.find(w => w.walletClientType !== 'privy');

        // Fallback if preferred not available
        const targetWallet = preferredWallet || wallets[0];

        if (targetWallet && targetWallet.address.toLowerCase() !== activeAddress?.toLowerCase()) {
            // Avoid annoying metamask popups on every reload
            // Don't force setActiveWallet for external wallets if wagmi has no active address yet,
            // as this prompts the user. Only force it if it's a privy wallet.
            if (!activeAddress && targetWallet.walletClientType !== 'privy') {
                return;
            }

            console.log(`[WalletAutoConnector] Switching active wallet to ${targetWallet.address} (type: ${targetWallet.walletClientType}, preferred: ${useEmbeddedWallet ? 'embedded' : 'external'})`);
            setActiveWallet(targetWallet);
        }
    }, [ready, authenticated, wallets, setActiveWallet, activeAddress, useEmbeddedWallet, isConnecting, isReconnecting]);

    // Ensure the active chain matches the deployment target
    const targetChainId = ACTIVE_DEPLOYMENT.chainId;

    useEffect(() => {
        if (!ready || !authenticated || !activeAddress) return;
        if (isConnecting || isReconnecting) return;
        if (!chainId || chainId === targetChainId) return;
        if (switchingRef.current) return;

        const doSwitch = async () => {
            switchingRef.current = true;
            try {
                console.log(`[WalletAutoConnector] Chain mismatch: wallet on ${chainId}, switching to ${targetChainId}`);
                await switchChainAsync({ chainId: targetChainId });
                console.log(`[WalletAutoConnector] Chain switched to ${targetChainId}`);
            } catch (err) {
                console.warn('[WalletAutoConnector] switchChain failed:', err);
            } finally {
                switchingRef.current = false;
            }
        };

        doSwitch();
    }, [ready, authenticated, activeAddress, chainId, targetChainId, isConnecting, isReconnecting, switchChainAsync]);

    return null;
}
