import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { AnnouncePriority } from '@superplus/db';

export const announcementsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.announcement.findMany({
        where: {
          AND: [
            {
              OR: [
                { storeId: ctx.storeId },
                { storeId: null },
              ],
            },
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gte: new Date() } },
              ],
            },
          ],
        },
        include: { author: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      });
    }),

  create: managerProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(2000),
      priority: z.nativeEnum(AnnouncePriority).optional(),
      broadcast: z.boolean().optional(),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.announcement.create({
        data: {
          storeId: input.broadcast ? null : ctx.storeId,
          authorId: ctx.user.id,
          title: input.title,
          body: input.body,
          priority: input.priority,
          expiresAt: input.expiresAt,
        },
      });
    }),
});
