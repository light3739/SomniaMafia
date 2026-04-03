import React from 'react';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { http } from 'viem';
import { createConfig } from '@privy-io/wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';

import { SOMNIA_TESTNET } from '@/contracts/config';

export const config = createConfig({
  chains: [SOMNIA_TESTNET],
  transports: {
    [SOMNIA_TESTNET.id]: http(),
  },
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
        defaultChain: SOMNIA_TESTNET,
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        } as any,
        supportedChains: [SOMNIA_TESTNET],
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
