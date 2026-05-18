import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { AnnouncePriority } from '@superplus/db';
import { TRPCError } from '@trpc/server';
import { notifyStoreStaff } from '../../notifications';

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
        include: { author: { select: { id: true, fullName: true, role: true } } },
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
      if (input.broadcast && ctx.user.role !== 'OWNER') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can broadcast to all stores' });
      }
      const result = await ctx.db.announcement.create({
        data: {
          storeId: input.broadcast ? null : ctx.storeId,
          authorId: ctx.user.id,
          title: input.title,
          body: input.body,
          priority: input.priority,
          expiresAt: input.expiresAt,
        },
      });
      if (input.priority === 'CRITICAL' || input.priority === 'IMPORTANT') {
        try {
          if (input.broadcast) {
            const stores = await ctx.db.store.findMany({ select: { id: true } });
            await Promise.all(stores.map(s =>
              notifyStoreStaff(ctx.db, s.id, 'ANNOUNCEMENT', input.title, input.body?.substring(0, 100))
            ));
          } else {
            await notifyStoreStaff(ctx.db, ctx.storeId, 'ANNOUNCEMENT', input.title, input.body?.substring(0, 100));
          }
        } catch {}
      }
      return result;
    }),
});
