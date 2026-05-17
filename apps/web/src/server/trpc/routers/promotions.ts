import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { PromotionType } from '@superplus/db';

export const promotionsRouter = router({
  active: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    return ctx.db.promotion.findMany({
      where: { storeId: ctx.storeId, isActive: true, startDate: { lte: today }, endDate: { gte: today } },
      include: { items: true },
      orderBy: { startDate: 'desc' },
    });
  }),
  list: managerProcedure.query(async ({ ctx }) => {
    return ctx.db.promotion.findMany({ where: { storeId: ctx.storeId }, include: { items: true, _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' }, take: 50 });
  }),
  create: managerProcedure
    .input(z.object({
      title: z.string().min(1).max(200), description: z.string().max(500).optional(), type: z.nativeEnum(PromotionType),
      startDate: z.date(), endDate: z.date(),
      items: z.array(z.object({ productName: z.string().min(1), originalPrice: z.number().min(0), promoPrice: z.number().min(0), notes: z.string().optional() })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { items, ...data } = input;
      return ctx.db.promotion.create({ data: { storeId: ctx.storeId, createdById: ctx.user.id, ...data, items: { create: items } }, include: { items: true } });
    }),
  toggleActive: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const promo = await ctx.db.promotion.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      return ctx.db.promotion.update({ where: { id: input.id }, data: { isActive: !promo.isActive } });
    }),
});
