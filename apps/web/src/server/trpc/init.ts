import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { auth } from '@/server/auth';
import { db } from '@superplus/db';
import type { Role } from '@superplus/config';
import { hasMinRole } from '@superplus/config';

export async function createContext() {
  const session = await auth();
  return { session, db };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      storeId: ctx.session.user.storeId,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

export function requireRole(minRole: Role) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    if (!hasMinRole(ctx.session.user.role as Role, minRole)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({
      ctx: {
        session: ctx.session,
        user: ctx.session.user,
        storeId: ctx.session.user.storeId,
      },
    });
  });
}

export const supervisorProcedure = t.procedure.use(requireRole('SUPERVISOR'));
export const managerProcedure = t.procedure.use(requireRole('MANAGER'));
export const ownerProcedure = t.procedure.use(requireRole('OWNER'));
