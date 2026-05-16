import 'server-only';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc/init';

export async function serverTrpc() {
  const ctx = await createContext();
  return appRouter.createCaller(ctx);
}
