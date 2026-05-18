import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, managerProcedure } from '../init';
import { Role } from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role as ConfigRole } from '@superplus/config';
import { TRPCError } from '@trpc/server';
import { hash } from 'bcryptjs';

export const usersRouter = router({
  loginList: publicProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: { isActive: true },
      include: { store: { select: { name: true } } },
      orderBy: { fullName: 'asc' },
    });
    return users.map(u => ({
      loginId: u.phone,
      fullName: u.fullName,
      firstName: u.fullName.split(' ')[0],
      initials: u.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
      role: u.role,
      storeName: u.store.name,
    }));
  }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        include: { store: true },
      });
    }),

  list: managerProcedure
    .input(z.object({ storeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.role === 'OWNER'
        ? (input?.storeId ?? ctx.storeId)
        : ctx.storeId;
      return ctx.db.user.findMany({
        where: { storeId },
        orderBy: { fullName: 'asc' },
      });
    }),

  create: managerProcedure
    .input(z.object({
      fullName: z.string().min(1).max(100),
      phone: z.string().min(10).max(15),
      pin: z.string().length(4).regex(/^\d{4}$/),
      role: z.nativeEnum(Role),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!hasMinRole(ctx.user.role as ConfigRole, input.role as ConfigRole)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot create user with higher role' });
      }
      const pinHash = await hash(input.pin, 10);
      return ctx.db.user.create({
        data: {
          storeId: ctx.storeId,
          fullName: input.fullName,
          phone: input.phone,
          pinHash,
          role: input.role,
        },
      });
    }),

  toggleActive: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });
      return ctx.db.user.update({
        where: { id: input.id },
        data: { isActive: !user.isActive },
      });
    }),

  resetPin: managerProcedure
    .input(z.object({
      id: z.string(),
      newPin: z.string().length(4).regex(/^\d{4}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.user.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });
      if (!hasMinRole(ctx.user.role as ConfigRole, target.role as ConfigRole)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot reset PIN for user with equal or higher role' });
      }
      const pinHash = await hash(input.newPin, 10);
      return ctx.db.user.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: { pinHash },
      });
    }),

  changeMyPin: protectedProcedure
    .input(z.object({
      currentPin: z.string().length(4),
      newPin: z.string().length(4).regex(/^\d{4}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
      });
      const { compare } = await import('bcryptjs');
      const valid = await compare(input.currentPin, user.pinHash);
      if (!valid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Current PIN is incorrect' });

      const pinHash = await hash(input.newPin, 10);
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { pinHash },
      });
    }),
});
