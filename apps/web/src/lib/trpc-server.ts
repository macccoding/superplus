import 'server-only';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/trpc/router';
import { createContext } from '@/server/trpc/init';

const createCaller = createCallerFactory(appRouter);

export async function serverTrpc() {
  const ctx = await createContext();
  return createCaller(ctx);
}
