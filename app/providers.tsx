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
import { WagmiProvider, http, fallback } from 'wagmi';
import { SOMNIA_TESTNET, AVALANCHE_FUJI } from '../contracts/config';
import { GameProvider } from '../contexts/GameContext';
import { AudioProvider } from '../contexts/AudioContext';
import '@rainbow-me/rainbowkit/styles.css';

const { wallets } = getDefaultWallets();

const config = getDefaultConfig({
    appName: 'Onchain Mafia',
    projectId: 'YOUR_PROJECT_ID', // TODO: Add real project ID
    wallets: [
        ...wallets,
        {
            groupName: 'Other',
            wallets: [argentWallet, trustWallet, ledgerWallet],
        },
    ],
    chains: [
        SOMNIA_TESTNET,
        AVALANCHE_FUJI,
    ],
    transports: {
        [SOMNIA_TESTNET.id]: fallback(SOMNIA_TESTNET.rpcUrls.default.http.map(url => http(url))),
        [AVALANCHE_FUJI.id]: fallback(AVALANCHE_FUJI.rpcUrls.default.http.map(url => http(url))),
    },
    // Use deployless multicall — works on ANY chain without needing Multicall3 deployed.
    // This sends multicall bytecode directly via eth_call, zero contract dependency.
    batch: {
        multicall: {
            deployless: true,
            wait: 20, // SPEED: 20ms batch window (was 50ms) — Somnia is fast, don't wait long
        },
    },
    // Lower polling interval — Somnia has fast blocks (~1s)
    // 1s matches Somnia's sub-second finality for fastest receipt detection
    pollingInterval: 1_000,
    ssr: true,
});

const queryClient = new QueryClient();

const customTheme = darkTheme({
    accentColor: '#916A47',
    accentColorForeground: 'white',
    borderRadius: 'large',
    fontStack: 'system',
    overlayBlur: 'large',
});

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={customTheme}>
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
