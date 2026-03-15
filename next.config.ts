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
  async rewrites() {
    return [
      {
        // Proxy /api/rpc/fuji → Avalanche Fuji RPC (server-side, bypasses CORS)
        source: '/api/rpc/fuji',
        destination: 'https://api.avax-test.network/ext/bc/C/rpc',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          /*
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.privy.io https://privy.io",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "frame-src 'self' https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
              "connect-src 'self' https://auth.privy.io https://api.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org https://*.walletconnect.com https://*.walletconnect.org https://*.rpc.privy.systems https://*.somnia.network https://*.avax.network https://*.avax-test.network wss://*.somnia.network https://*.drpc.org wss://*.drpc.org https://*.publicnode.com wss://*.publicnode.com https://*.llamarpc.com https://*.ankr.com https://*.infura.io https://*.alchemy.com https://*.mafiaonchain.live wss://*.mafiaonchain.live",
              "img-src 'self' data: blob: https:",
            ].join('; '),
          },
          */
        ],
      },
    ];
  },
};

export default nextConfig;
