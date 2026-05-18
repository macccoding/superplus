import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@superplus/ui', '@superplus/config', '@superplus/db'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
