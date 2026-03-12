import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@superplus/ui', '@superplus/db', '@superplus/auth', '@superplus/config'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
