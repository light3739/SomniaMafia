'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, fallback } from 'viem';
import { createConfig } from '@privy-io/wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';

import { SOMNIA_TESTNET, ACTIVE_DEPLOYMENT } from '../contracts/config';
import { AudioProvider } from '../contexts/AudioContext';
import { NoirDialogProvider } from '../contexts/NoirDialogContext';
import { WalletAutoConnector } from '../components/ui/WalletAutoConnector';

export const config = createConfig({
    chains: [
        SOMNIA_TESTNET,
    ],
    transports: {
        [SOMNIA_TESTNET.id]: fallback(SOMNIA_TESTNET.rpcUrls.default.http.map((url: string) => http(url))),
    },
    batch: {
        multicall: {
            // @ts-ignore
            deployless: true,
            wait: 20,
        },
    },
    // @ts-ignore
    pollingInterval: 4_000,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmmidpuf302i70ckzh1kvlog3"}
            config={{
                loginMethods: ['email', 'wallet', 'google', 'twitter', 'discord'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#916A47',
                    logo: '/assets/somniayeal.png',
                },
                defaultChain: SOMNIA_TESTNET,
                embeddedWallets: {
                    createOnLogin: 'users-without-wallets',
                } as any,
                supportedChains: [SOMNIA_TESTNET],
                externalWallets: {
                    coinbaseWallet: {
                        connectionOptions: 'eoaOnly',
                    },
                } as any,
            }}
        >
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={config}>
                    <AudioProvider>
                        <NoirDialogProvider>
                            <WalletAutoConnector />
                            {children}
                        </NoirDialogProvider>
                    </AudioProvider>
                </WagmiProvider>
            </QueryClientProvider>
        </PrivyProvider>
    );
}
