import { z } from 'zod';
import { router, protectedProcedure, supervisorProcedure } from '../init';
import { StockOutStatus } from '@superplus/db';
import { notifyByRole } from '../../notifications';

export const stockOutsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.nativeEnum(StockOutStatus).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.stockOutReport.findMany({
        where: {
          storeId: ctx.storeId,
          ...(input?.status ? { status: input.status } : { status: { not: StockOutStatus.RESTOCKED } }),
        },
        include: { reportedBy: { select: { id: true, fullName: true, role: true } }, product: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }),

  create: protectedProcedure
    .input(z.object({
      productName: z.string().min(1).max(200),
      productId: z.string().optional(),
      location: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.productId) {
        await ctx.db.product.findFirstOrThrow({
          where: { id: input.productId, storeId: ctx.storeId },
        });
      }
      const result = await ctx.db.stockOutReport.create({
        data: {
          storeId: ctx.storeId,
          reportedById: ctx.user.id,
          productName: input.productName,
          productId: input.productId,
          location: input.location,
        },
      });
      try {
        await notifyByRole(ctx.db, ctx.storeId, ['SUPERVISOR', 'MANAGER', 'OWNER'], 'STOCK_OUT', `Stock-out: ${input.productName}`, input.location || undefined, '/tools/stock-out');
      } catch {}
      return result;
    }),

  myRecent: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.stockOutReport.findMany({
      where: { storeId: ctx.storeId, reportedById: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }),

  updateStatus: supervisorProcedure
    .input(z.object({
      id: z.string(),
      status: z.nativeEnum(StockOutStatus),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.stockOutReport.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: {
          status: input.status,
          notes: input.notes,
          resolvedById: input.status === StockOutStatus.RESTOCKED ? ctx.user.id : undefined,
          resolvedAt: input.status === StockOutStatus.RESTOCKED ? new Date() : undefined,
        },
      });
    }),

  openCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.stockOutReport.count({
      where: { storeId: ctx.storeId, status: { not: StockOutStatus.RESTOCKED } },
    });
  }),
});
