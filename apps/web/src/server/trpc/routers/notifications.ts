import { z } from 'zod';
import { router, protectedProcedure } from '../init';

export const notificationsRouter = router({
  publicVapidKey: protectedProcedure.query(() => {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
  }),

  preferences: protectedProcedure.query(async ({ ctx }) => {
    const existing = await ctx.db.notificationPreference.findUnique({ where: { userId: ctx.user.id } });
    return existing ?? {
      threadMentions: true,
      threadReplies: true,
      urgentThreads: true,
      taskAlerts: true,
      announcementAlerts: true,
      scheduleAlerts: true,
      stockAlerts: true,
      incidentAlerts: true,
      suggestionResponses: true,
      urgentOverrideQuiet: true,
      quietHoursStart: null,
      quietHoursEnd: null,
    };
  }),

  updatePreferences: protectedProcedure
    .input(z.object({
      threadMentions: z.boolean().optional(),
      threadReplies: z.boolean().optional(),
      urgentThreads: z.boolean().optional(),
      taskAlerts: z.boolean().optional(),
      announcementAlerts: z.boolean().optional(),
      scheduleAlerts: z.boolean().optional(),
      stockAlerts: z.boolean().optional(),
      incidentAlerts: z.boolean().optional(),
      suggestionResponses: z.boolean().optional(),
      urgentOverrideQuiet: z.boolean().optional(),
      quietHoursStart: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).nullable().optional(),
      quietHoursEnd: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.notificationPreference.upsert({
        where: { userId: ctx.user.id },
        create: { userId: ctx.user.id, ...input },
        update: input,
      });
    }),

  registerPushSubscription: protectedProcedure
    .input(z.object({
      endpoint: z.string().url().max(2000),
      keys: z.object({
        p256dh: z.string().min(1).max(500),
        auth: z.string().min(1).max(500),
      }),
      userAgent: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent,
          lastSeenAt: new Date(),
        },
        update: {
          userId: ctx.user.id,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent,
          lastSeenAt: new Date(),
        },
      });
    }),

  unregisterPushSubscription: protectedProcedure
    .input(z.object({ endpoint: z.string().url().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.pushSubscription.deleteMany({ where: { userId: ctx.user.id, endpoint: input.endpoint } });
      return { success: true };
    }),

  pushStatus: protectedProcedure.query(async ({ ctx }) => {
    const subscriptions = await ctx.db.pushSubscription.findMany({
      where: { userId: ctx.user.id },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, endpoint: true, userAgent: true, lastSeenAt: true, createdAt: true },
    });
    return {
      configured: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
      subscriptions,
    };
  }),

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
