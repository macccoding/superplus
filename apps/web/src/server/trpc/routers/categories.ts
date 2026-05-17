import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, managerProcedure } from '../init';

export const categoriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      where: { storeId: ctx.storeId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }),

  create: managerProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      defaultMarkupPercent: z.number().min(0).max(999),
    }))
    .mutation(async ({ ctx, input }) => {
      const maxSort = await ctx.db.category.aggregate({
        where: { storeId: ctx.storeId },
        _max: { sortOrder: true },
      });
      return ctx.db.category.create({
        data: {
          storeId: ctx.storeId,
          name: input.name,
          defaultMarkupPercent: input.defaultMarkupPercent,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });
    }),

  update: managerProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      defaultMarkupPercent: z.number().min(0).max(999).optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.category.update({
        where: { id, storeId: ctx.storeId },
        data,
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.category.delete({
          where: { id: input.id, storeId: ctx.storeId },
        });
      } catch (err: any) {
        if (err.code === 'P2003') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Cannot delete category with products. Reassign products first.' });
        }
        throw err;
      }
    }),
});
