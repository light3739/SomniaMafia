import type { NextConfig } from "next";

const nextConfig: any = {
  /* config options here */
  output: 'standalone',
  outputFileTracing: false,
  serverExternalPackages: ['snarkjs'],
};

export default nextConfig;
