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

const PIN_RESET_ALLOWED_PATHS = new Set(['users.me', 'users.changeMyPin']);

const enforceAuth = t.middleware(({ ctx, next, path }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (ctx.session.user.mustChangePin && !PIN_RESET_ALLOWED_PATHS.has(path)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Create your new PIN before using SuperPlus' });
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
    const user = (ctx as any).user;
    if (!user || !hasMinRole(user.role as Role, minRole)) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx });
  });
}

export const supervisorProcedure = protectedProcedure.use(requireRole('SUPERVISOR'));
export const managerProcedure = protectedProcedure.use(requireRole('MANAGER'));
export const ownerProcedure = protectedProcedure.use(requireRole('OWNER'));
