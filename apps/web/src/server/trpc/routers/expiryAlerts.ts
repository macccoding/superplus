import { z } from 'zod';
import { router, protectedProcedure, supervisorProcedure } from '../init';
import { ExpiryStatus } from '@superplus/db';
import { adminStoreWhere, resolveAdminScope } from './admin-scope';
import { logAdminAction } from './admin-audit';

export const expiryAlertsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.nativeEnum(ExpiryStatus).optional(), scope: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      return ctx.db.expiryAlert.findMany({
        where: {
          ...adminStoreWhere(scope),
          status: input?.status ?? ExpiryStatus.ACTIVE,
        },
        include: { store: { select: { id: true, name: true } }, reportedBy: { select: { id: true, fullName: true, role: true } }, product: true },
        orderBy: { expiryDate: 'asc' },
        take: 100,
      });
    }),

  create: protectedProcedure
    .input(z.object({
      productName: z.string().min(1).max(200),
      productId: z.string().optional(),
      expiryDate: z.date(),
      quantity: z.number().int().min(1).default(1),
      location: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.productId) {
        await ctx.db.product.findFirstOrThrow({
          where: { id: input.productId, storeId: ctx.storeId },
        });
      }
      return ctx.db.expiryAlert.create({
        data: {
          storeId: ctx.storeId,
          reportedById: ctx.user.id,
          productName: input.productName,
          productId: input.productId,
          expiryDate: input.expiryDate,
          quantity: input.quantity,
          location: input.location,
        },
      });
    }),

  updateStatus: supervisorProcedure
    .input(z.object({
      id: z.string(),
      status: z.nativeEnum(ExpiryStatus),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const current = await ctx.db.expiryAlert.findFirstOrThrow({ where: { ...adminStoreWhere(scope), id: input.id } });
      const updated = await ctx.db.expiryAlert.update({
        where: { id: input.id },
        data: {
          status: input.status,
          resolvedAt: input.status === ExpiryStatus.RESOLVED ? new Date() : input.status === ExpiryStatus.ACTIVE ? null : undefined,
        },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'EXPIRY_STATUS_UPDATED',
        storeId: current.storeId,
        sourceType: 'EXPIRY_ALERT',
        sourceId: updated.id,
        note: updated.productName,
        metadata: { status: updated.status },
      });
      return updated;
    }),
});
