import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['snarkjs'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos', pathname: '**' },
      { protocol: 'https', hostname: 'placehold.co', pathname: '**' },
      { protocol: 'https', hostname: 'api.dicebear.com', pathname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: allow self, inline (needed by Next.js), and Privy's auth iframe
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io https://privy.io",
              // Styles: allow self and inline
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Frames: Privy uses an iframe for its auth modal
              "frame-src 'self' https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
              // Connections: Privy API, WalletConnect, RPC providers
              "connect-src 'self' https://auth.privy.io https://api.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org https://*.rpc.privy.systems https://*.somnia.network https://*.avax.network wss://*.somnia.network https://*.drpc.org wss://*.drpc.org https://*.publicnode.com wss://*.publicnode.com https://*.llamarpc.com https://*.ankr.com https://*.infura.io https://*.alchemy.com",
              // Images
              "img-src 'self' data: blob: https:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
