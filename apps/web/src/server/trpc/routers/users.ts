import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { Role } from '@superplus/db';
import { hash } from 'bcryptjs';

export const usersRouter = router({
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
      const storeId = input?.storeId ?? ctx.storeId;
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
      if (!valid) throw new Error('Current PIN is incorrect');

      const pinHash = await hash(input.newPin, 10);
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { pinHash },
      });
    }),
});
