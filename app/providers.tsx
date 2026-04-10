'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, webSocket, fallback } from 'viem';
import { createConfig } from '@privy-io/wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';

import { SOMNIA_TESTNET, ACTIVE_DEPLOYMENT } from '../contracts/config';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { AudioProvider } from '../contexts/AudioContext';
import { NoirDialogProvider } from '../contexts/NoirDialogContext';
import { WalletAutoConnector } from '../components/ui/WalletAutoConnector';
import { ChainGate } from '../components/ui/ChainGate';

export const config = createConfig({
    chains: [
        SOMNIA_TESTNET,
    ],
    transports: {
        [SOMNIA_TESTNET.id]: fallback([
            // WebSocket primary — real-time event subscriptions (watchContractEvent)
            ...(SOMNIA_TESTNET.rpcUrls.default.webSocket || []).map((url: string) =>
                webSocket(url, { reconnect: { delay: 2_000, attempts: 10 }, keepAlive: { interval: 25_000 } })
            ),
            // HTTP fallback — reliable for reads/writes, used when WS unavailable
            ...SOMNIA_TESTNET.rpcUrls.default.http.map((url: string) => http(url)),
        ]),
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
                    <MotionConfig reducedMotion="user">
                    <AudioProvider>
                        <NoirDialogProvider>
                            <WalletAutoConnector />
                            <ChainGate>
                            {children}
                            </ChainGate>
                            <Toaster
                                theme="dark"
                                position="bottom-right"
                                toastOptions={{
                                    style: {
                                        background: '#0D0D0D',
                                        border: '1px solid rgba(145, 106, 71, 0.3)',
                                        color: '#fff',
                                        fontFamily: 'var(--font-sans)',
                                    },
                                }}
                            />
                        </NoirDialogProvider>
                    </AudioProvider>
                    </MotionConfig>
                </WagmiProvider>
            </QueryClientProvider>
        </PrivyProvider>
    );
}
