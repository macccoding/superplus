import { z } from 'zod';
import { router, managerProcedure, ownerProcedure } from '../init';

export const storesRouter = router({
  list: managerProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role === 'OWNER') {
        return ctx.db.store.findMany({ orderBy: { name: 'asc' } });
      }
      return ctx.db.store.findMany({
        where: { id: ctx.storeId },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.role === 'OWNER' ? input.id : ctx.storeId;
      return ctx.db.store.findUniqueOrThrow({
        where: { id: storeId },
        include: { _count: { select: { users: true, tasks: true } } },
      });
    }),

  create: ownerProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      parish: z.string().min(1).max(50),
      address: z.string().min(1).max(200),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.store.create({ data: input });
    }),

  updateConfig: managerProcedure
    .input(z.object({
      openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      openDays: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.store.update({
        where: { id: ctx.storeId },
        data: input,
      });
    }),
});
