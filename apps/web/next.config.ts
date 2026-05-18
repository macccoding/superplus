import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@superplus/ui', '@superplus/config', '@superplus/db'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/**': [
      '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*',
      '../../node_modules/.pnpm/prisma*/node_modules/prisma/libquery_engine*',
    ],
  },
};

export default nextConfig;
