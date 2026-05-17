import { z } from 'zod';
import { router, protectedProcedure } from '../init';

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.notification.findMany({ where: { userId: ctx.user.id }, orderBy: { createdAt: 'desc' }, take: input?.limit ?? 20 });
    }),
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.count({ where: { userId: ctx.user.id, isRead: false } });
  }),
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.notification.update({ where: { id: input.id, userId: ctx.user.id }, data: { isRead: true } });
    }),
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({ where: { userId: ctx.user.id, isRead: false }, data: { isRead: true } });
    return { success: true };
  }),
});
