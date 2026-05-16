import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { LogCategory } from '@superplus/db';

export const logbookRouter = router({
  listByDate: protectedProcedure
    .input(z.object({
      date: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const date = input?.date ?? new Date();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return ctx.db.logEntry.findMany({
        where: {
          storeId: ctx.storeId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      body: z.string().min(1).max(2000),
      category: z.nativeEnum(LogCategory).optional(),
      isFlagged: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.logEntry.create({
        data: {
          storeId: ctx.storeId,
          authorId: ctx.user.id,
          date: new Date(),
          body: input.body,
          category: input.category,
          isFlagged: input.isFlagged,
        },
      });
    }),

  flagged: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.logEntry.findMany({
        where: { storeId: ctx.storeId, isFlagged: true },
        include: { author: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }),
});
