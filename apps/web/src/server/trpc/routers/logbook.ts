import { z } from 'zod';
import { router, protectedProcedure, supervisorProcedure } from '../init';
import { LogCategory } from '@superplus/db';

function getJamaicaDate(d?: Date): Date {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica' }).format(d ?? new Date());
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export const logbookRouter = router({
  listByDate: protectedProcedure
    .input(z.object({
      date: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const startOfDay = getJamaicaDate(input?.date);
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      return ctx.db.logEntry.findMany({
        where: {
          storeId: ctx.storeId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: { author: { select: { id: true, fullName: true, role: true } } },
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
          date: getJamaicaDate(),
          body: input.body,
          category: input.category,
          isFlagged: input.isFlagged,
        },
      });
    }),

  flagged: supervisorProcedure
    .query(async ({ ctx }) => {
      return ctx.db.logEntry.findMany({
        where: { storeId: ctx.storeId, isFlagged: true },
        include: { author: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }),
});
