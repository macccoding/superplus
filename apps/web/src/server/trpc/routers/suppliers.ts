import { z } from 'zod';
import { router, managerProcedure } from '../init';

export const suppliersRouter = router({
  list: managerProcedure.query(async ({ ctx }) => {
    return ctx.db.supplier.findMany({
      where: { storeId: ctx.storeId, isActive: true },
      include: { _count: { select: { orders: true } } },
      orderBy: { name: 'asc' },
    });
  }),
  create: managerProcedure
    .input(z.object({ name: z.string().min(1).max(100), contact: z.string().max(100).optional(), phone: z.string().max(20).optional(), email: z.string().email().optional(), notes: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.supplier.create({ data: { storeId: ctx.storeId, ...input } });
    }),
  update: managerProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(100).optional(), contact: z.string().max(100).optional(), phone: z.string().max(20).optional(), email: z.string().email().optional(), notes: z.string().max(500).optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.supplier.update({ where: { id, storeId: ctx.storeId }, data });
    }),
});
