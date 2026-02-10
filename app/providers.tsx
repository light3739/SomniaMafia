'use client';

import * as React from 'react';
import {
    RainbowKitProvider,
    getDefaultWallets,
    getDefaultConfig,
    darkTheme,
} from '@rainbow-me/rainbowkit';
import {
    argentWallet,
    trustWallet,
    ledgerWallet,
} from '@rainbow-me/rainbowkit/wallets';
import {
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
import { WagmiProvider, http, webSocket, fallback } from 'wagmi';
import { somniaChain } from '../contracts/config';
import { GameProvider } from '../contexts/GameContext';
import { AudioProvider } from '../contexts/AudioContext';
import '@rainbow-me/rainbowkit/styles.css';

const { wallets } = getDefaultWallets();

const config = getDefaultConfig({
    appName: 'Somnia Mafia',
    projectId: 'YOUR_PROJECT_ID', // TODO: Add real project ID
    wallets: [
        ...wallets,
        {
            groupName: 'Other',
            wallets: [argentWallet, trustWallet, ledgerWallet],
        },
    ],
    chains: [
        somniaChain,
    ],
    transports: {
        [somniaChain.id]: fallback([
            webSocket(somniaChain.rpcUrls.default.webSocket![0]),
            http(somniaChain.rpcUrls.default.http[0])
        ])
    },
    // Use deployless multicall — works on ANY chain without needing Multicall3 deployed.
    // This sends multicall bytecode directly via eth_call, zero contract dependency.
    batch: {
        multicall: {
            deployless: true,
            wait: 50, // batch window 50ms to group parallel reads
        },
    },
    // Lower polling interval — Somnia has fast blocks (~1s)
    pollingInterval: 4_000,
    ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme()}>
                    <AudioProvider>
                        <GameProvider>
                            {children}
                        </GameProvider>
                    </AudioProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
