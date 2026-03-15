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
};

export default nextConfig;
