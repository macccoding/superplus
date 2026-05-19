import { z } from 'zod';
import { router, managerProcedure } from '../init';
import { adminStoreWhere, resolveAdminScope, requireSingleAdminStore } from './admin-scope';
import { logAdminAction } from './admin-audit';

export const suppliersRouter = router({
  list: managerProcedure
  .input(z.object({ scope: z.string().optional() }).optional())
  .query(async ({ ctx, input }) => {
    const scope = await resolveAdminScope(ctx as any, input?.scope);
    return ctx.db.supplier.findMany({
      where: { ...adminStoreWhere(scope), isActive: true },
      include: { store: { select: { id: true, name: true } }, _count: { select: { orders: true } } },
      orderBy: { name: 'asc' },
    });
  }),
  create: managerProcedure
    .input(z.object({ scope: z.string().optional(), name: z.string().min(1).max(100), contact: z.string().max(100).optional(), phone: z.string().max(20).optional(), email: z.string().email().optional(), notes: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const storeId = requireSingleAdminStore(scope);
      const { scope: _scope, ...data } = input;
      const supplier = await ctx.db.supplier.create({ data: { storeId, ...data } });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'SUPPLIER_CREATED',
        storeId,
        sourceType: 'SUPPLIER',
        sourceId: supplier.id,
        note: supplier.name,
      });
      return supplier;
    }),
  update: managerProcedure
    .input(z.object({ scope: z.string().optional(), id: z.string(), name: z.string().min(1).max(100).optional(), contact: z.string().max(100).optional(), phone: z.string().max(20).optional(), email: z.string().email().optional(), notes: z.string().max(500).optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const { id, scope: _scope, ...data } = input;
      const current = await ctx.db.supplier.findFirstOrThrow({ where: { ...adminStoreWhere(scope), id } });
      const supplier = await ctx.db.supplier.update({ where: { id }, data });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: data.isActive === false ? 'SUPPLIER_DEACTIVATED' : 'SUPPLIER_UPDATED',
        storeId: current.storeId,
        sourceType: 'SUPPLIER',
        sourceId: supplier.id,
        note: supplier.name,
      });
      return supplier;
    }),
});
