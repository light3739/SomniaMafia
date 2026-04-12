import React from 'react';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { http, type Transport } from 'viem';
import { createConfig } from '@privy-io/wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';

import { somniaChain } from '@/contracts/config';

export const config = createConfig({
  chains: [somniaChain],
  transports: {
    [somniaChain.id]: http(),
  } as Record<number, Transport>,
});

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmmidpuf302i70ckzh1kvlog3"}
      config={{
        loginMethods: ['email', 'wallet', 'google', 'twitter', 'discord'],
        appearance: {
          theme: 'dark',
          accentColor: '#916A47',
          logo: '/assets/Icon.png',
        },
        defaultChain: somniaChain,
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        } as any,
        supportedChains: [somniaChain],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
};
