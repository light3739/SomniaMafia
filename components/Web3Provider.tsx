import React from 'react';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { http } from 'viem';
import { createConfig } from '@privy-io/wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';

import { SOMNIA_TESTNET, AVALANCHE_FUJI } from '@/contracts/config';

export const config = createConfig({
  chains: [AVALANCHE_FUJI, SOMNIA_TESTNET],
  transports: {
    [AVALANCHE_FUJI.id]: http(),
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
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        } as any,
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
