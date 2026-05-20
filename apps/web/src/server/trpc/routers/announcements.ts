import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { AnnouncePriority } from '@superplus/db';
import { TRPCError } from '@trpc/server';
import { notifyUsers } from '../../notifications';

const ANNOUNCEMENT_LINK = '/hub/announcements';
const notifyingPriorities = new Set<AnnouncePriority>([AnnouncePriority.CRITICAL, AnnouncePriority.IMPORTANT]);

const announcementInput = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  priority: z.nativeEnum(AnnouncePriority).default(AnnouncePriority.NORMAL),
  broadcast: z.boolean().default(false),
  expiresAt: z.date().nullable().optional(),
});

function managerScopeWhere(ctx: any) {
  if (ctx.user.role === 'OWNER') return {};
  return { OR: [{ storeId: ctx.storeId }, { storeId: null }] };
}

function activeAnnouncementWhere(now = new Date()) {
  return {
    OR: [
      { expiresAt: null },
      { expiresAt: { gte: now } },
    ],
  };
}

async function getTargetUsers(db: any, storeId: string | null) {
  return db.user.findMany({
    where: storeId ? { storeId, isActive: true } : { isActive: true },
    select: { id: true },
  });
}

async function createAnnouncementReceipts(db: any, announcementId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  await db.announcementReceipt.createMany({
    data: [...new Set(userIds)].map((userId) => ({ announcementId, userId })),
    skipDuplicates: true,
  });
}

async function deliverAnnouncement(db: any, announcement: any, body: string, shouldNotify: boolean) {
  const targets = await getTargetUsers(db, announcement.storeId);
  const userIds = targets.map((user: { id: string }) => user.id);
  await createAnnouncementReceipts(db, announcement.id, userIds);
  if (shouldNotify) {
    await notifyUsers(
      db,
      userIds,
      'ANNOUNCEMENT',
      announcement.priority === AnnouncePriority.CRITICAL ? `Urgent: ${announcement.title}` : announcement.title,
      body.substring(0, 140),
      ANNOUNCEMENT_LINK
    );
  }
}

function sortStaffAnnouncements(a: any, b: any) {
  const aUnacked = a.priority === AnnouncePriority.CRITICAL && !a.receipts?.[0]?.acknowledgedAt;
  const bUnacked = b.priority === AnnouncePriority.CRITICAL && !b.receipts?.[0]?.acknowledgedAt;
  if (aUnacked !== bUnacked) return aUnacked ? -1 : 1;
  const rank = { CRITICAL: 0, IMPORTANT: 1, NORMAL: 2 } as Record<string, number>;
  const priorityDiff = rank[a.priority] - rank[b.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export const announcementsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      const announcements = await ctx.db.announcement.findMany({
        where: {
          AND: [
            {
              OR: [
                { storeId: ctx.storeId },
                { storeId: null },
              ],
            },
            activeAnnouncementWhere(),
          ],
        },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          store: { select: { id: true, name: true } },
          receipts: { where: { userId: ctx.user.id }, select: { id: true, readAt: true, acknowledgedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return announcements.sort(sortStaffAnnouncements).map((announcement: any) => ({
        ...announcement,
        requiresAck: announcement.priority === AnnouncePriority.CRITICAL,
        acknowledgedAt: announcement.receipts[0]?.acknowledgedAt ?? null,
      }));
    }),

  listAdmin: managerProcedure
    .input(z.object({
      status: z.enum(['ACTIVE', 'EXPIRED', 'ALL']).default('ACTIVE'),
      priority: z.nativeEnum(AnnouncePriority).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const filters: any[] = [managerScopeWhere(ctx)];
      if (input?.priority) filters.push({ priority: input.priority });
      if ((input?.status ?? 'ACTIVE') === 'ACTIVE') {
        filters.push({ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] });
      }
      if (input?.status === 'EXPIRED') {
        filters.push({ expiresAt: { lt: now } });
      }
      const announcements = await ctx.db.announcement.findMany({
        where: { AND: filters },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          store: { select: { id: true, name: true } },
          receipts: { select: { id: true, acknowledgedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return announcements.map((announcement: any) => ({
        ...announcement,
        audience: announcement.storeId ? announcement.store?.name ?? 'Store' : 'All stores',
        canManage: ctx.user.role === 'OWNER' || announcement.storeId === ctx.storeId,
        receiptSummary: {
          target: announcement.receipts.length,
          read: announcement.receipts.filter((receipt: any) => !!receipt.readAt).length,
          acknowledged: announcement.receipts.filter((receipt: any) => !!receipt.acknowledgedAt).length,
        },
      }));
    }),

  create: managerProcedure
    .input(announcementInput)
    .mutation(async ({ ctx, input }) => {
      if (input.broadcast && ctx.user.role !== 'OWNER') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can broadcast to all stores' });
      }
      const announcement = await ctx.db.announcement.create({
        data: {
          storeId: input.broadcast ? null : ctx.storeId,
          authorId: ctx.user.id,
          title: input.title,
          body: input.body,
          priority: input.priority,
          expiresAt: input.expiresAt ?? null,
        },
      });
      await deliverAnnouncement(ctx.db, announcement, input.body, notifyingPriorities.has(input.priority));
      return announcement;
    }),

  update: managerProcedure
    .input(announcementInput.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.broadcast && ctx.user.role !== 'OWNER') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can broadcast to all stores' });
      }
      const existing = await ctx.db.announcement.findFirst({
        where: { id: input.id, ...managerScopeWhere(ctx) },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' });
      if (ctx.user.role !== 'OWNER' && existing.storeId !== ctx.storeId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot edit this announcement' });
      }
      const announcement = await ctx.db.announcement.update({
        where: { id: input.id },
        data: {
          storeId: input.broadcast ? null : existing.storeId ?? ctx.storeId,
          title: input.title,
          body: input.body,
          priority: input.priority,
          expiresAt: input.expiresAt ?? null,
        },
      });
      const newlyPromoted = existing.priority !== input.priority && notifyingPriorities.has(input.priority);
      await deliverAnnouncement(ctx.db, announcement, input.body, newlyPromoted);
      return announcement;
    }),

  expire: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.announcement.findFirst({
        where: { id: input.id, ...managerScopeWhere(ctx) },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Announcement not found' });
      if (ctx.user.role !== 'OWNER' && existing.storeId !== ctx.storeId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot expire this announcement' });
      }
      return ctx.db.announcement.update({
        where: { id: input.id },
        data: { expiresAt: new Date() },
      });
    }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const announcement = await ctx.db.announcement.findFirst({
        where: {
          id: input.id,
          priority: AnnouncePriority.CRITICAL,
          OR: [{ storeId: ctx.storeId }, { storeId: null }],
          AND: [activeAnnouncementWhere()],
        },
        select: { id: true },
      });
      if (!announcement) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Critical announcement not found' });
      }
      const now = new Date();
      return ctx.db.announcementReceipt.update({
        where: { announcementId_userId: { announcementId: input.id, userId: ctx.user.id } },
        data: { readAt: now, acknowledgedAt: now },
      });
    }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const visible = await ctx.db.announcement.findMany({
        where: {
          id: { in: input.ids },
          OR: [{ storeId: ctx.storeId }, { storeId: null }],
          AND: [activeAnnouncementWhere()],
        },
        select: { id: true },
      });
      const ids = visible.map((announcement: { id: string }) => announcement.id);
      if (ids.length === 0) return { count: 0 };
      const now = new Date();
      await Promise.all(ids.map((announcementId: string) =>
        ctx.db.announcementReceipt.upsert({
          where: { announcementId_userId: { announcementId, userId: ctx.user.id } },
          create: { announcementId, userId: ctx.user.id, readAt: now },
          update: { readAt: now },
        })
      ));
      return { count: ids.length };
    }),
});
