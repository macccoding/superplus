import { z } from 'zod';
import { router, protectedProcedure } from '../init';

export const availabilityRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const records = await ctx.db.staffAvailability.findMany({
      where: { userId: ctx.user.id },
      orderBy: { dayOfWeek: 'asc' },
    });
    const days = Array.from({ length: 7 }, (_, i) => {
      const existing = records.find(r => r.dayOfWeek === i);
      return existing || { id: null, userId: ctx.user.id, dayOfWeek: i, available: true, note: null };
    });
    return days;
  }),

  update: protectedProcedure
    .input(z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      available: z.boolean(),
      note: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.staffAvailability.upsert({
        where: {
          userId_dayOfWeek: { userId: ctx.user.id, dayOfWeek: input.dayOfWeek },
        },
        update: { available: input.available, note: input.note || null },
        create: {
          userId: ctx.user.id,
          dayOfWeek: input.dayOfWeek,
          available: input.available,
          note: input.note || null,
        },
      });
    }),
});
