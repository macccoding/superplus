import type { NextConfig } from 'next';
import { loadEnvConfig } from '@next/env';
import path from 'node:path';

const workspaceRoot = path.join(__dirname, '../../');
loadEnvConfig(workspaceRoot);
process.env.AUTH_SECRET ??= process.env.NEXTAUTH_SECRET;

const nextConfig: NextConfig = {
  transpilePackages: ['@superplus/ui', '@superplus/config', '@superplus/db'],
  outputFileTracingRoot: workspaceRoot,
  outputFileTracingIncludes: {
    '/**': [
      '../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/*',
      '../../node_modules/.pnpm/prisma*/node_modules/prisma/libquery_engine*',
    ],
  },
};

export default nextConfig;
