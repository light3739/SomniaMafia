import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";
import { defineChain } from 'viem';

import { SOMNIA_TESTNET, AVALANCHE_FUJI } from '@/contracts/config';

const config = getDefaultConfig({
  appName: 'Onchain Mafia',
  projectId: 'YOUR_PROJECT_ID',
  chains: [AVALANCHE_FUJI, SOMNIA_TESTNET],
  ssr: false,
});

const queryClient = new QueryClient();

const theme = darkTheme();

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
