import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@superplus/ui', '@superplus/config', '@superplus/db'],
};

export default nextConfig;
