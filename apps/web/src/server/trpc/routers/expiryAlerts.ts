import { z } from 'zod';
import { router, protectedProcedure, supervisorProcedure } from '../init';
import { ExpiryStatus } from '@superplus/db';

export const expiryAlertsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.nativeEnum(ExpiryStatus).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.expiryAlert.findMany({
        where: {
          storeId: ctx.storeId,
          status: input?.status ?? ExpiryStatus.ACTIVE,
        },
        include: { reportedBy: { select: { id: true, fullName: true, role: true } }, product: true },
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
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.expiryAlert.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: {
          status: input.status,
          resolvedAt: input.status === ExpiryStatus.RESOLVED ? new Date() : input.status === ExpiryStatus.ACTIVE ? null : undefined,
        },
      });
    }),
});
