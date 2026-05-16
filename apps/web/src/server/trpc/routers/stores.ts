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
      return ctx.db.store.findUniqueOrThrow({
        where: { id: input.id },
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
});
