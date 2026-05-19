import { z } from 'zod';
import { router, protectedProcedure, supervisorProcedure, managerProcedure } from '../init';
import { IncidentCategory, IncidentSeverity, LogCategory, LogEntryAttachmentType, TaskLinkType } from '@superplus/db';
import { adminStoreWhere, resolveAdminScope } from './admin-scope';
import {
  logbookStatusWhere,
  sortLogbookEntries,
  type LogbookStatusFilter,
} from './logbook-policy';

function getJamaicaDate(d?: Date): Date {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica' }).format(d ?? new Date());
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function jamaicaDayRange(d?: Date) {
  const startOfDay = getJamaicaDate(d);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

async function assertEntryInStore(db: any, storeId: string, entryId: string) {
  return db.logEntry.findFirstOrThrow({
    where: { id: entryId, storeId },
    select: { id: true, storeId: true, body: true, category: true, isFlagged: true, resolvedAt: true },
  });
}

async function assertSourceInStore(db: any, storeId: string, type: TaskLinkType, entityId: string) {
  switch (type) {
    case TaskLinkType.TASK:
      return db.task.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, title: true } });
    case TaskLinkType.INCIDENT:
      return db.incident.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, title: true } });
    case TaskLinkType.LOGBOOK:
      return db.logEntry.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, body: true } });
    case TaskLinkType.CHECKLIST:
      return db.checklistTemplate.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, name: true } });
    case TaskLinkType.PRODUCT:
      return db.product.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, name: true } });
    case TaskLinkType.STOCK_OUT:
      return db.stockOutReport.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, productName: true } });
    case TaskLinkType.EXPIRY_ALERT:
      return db.expiryAlert.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, productName: true } });
    case TaskLinkType.PURCHASE_ORDER:
      return db.purchaseOrder.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, orderNumber: true } });
    case TaskLinkType.SOP_GUIDE:
      return db.sOPGuide.findFirstOrThrow({
        where: { id: entityId, OR: [{ storeId }, { storeId: null }] },
        select: { id: true, title: true },
      });
    default:
      return { id: entityId };
  }
}

function sourceLabel(type: TaskLinkType, source: any, fallback?: string) {
  if (fallback) return fallback;
  if (source.title) return source.title;
  if (source.name) return source.name;
  if (source.productName) return source.productName;
  if (source.orderNumber) return source.orderNumber;
  if (source.body) return source.body.slice(0, 80);
  return type.replaceAll('_', ' ').toLowerCase();
}

const listInput = z.object({
  date: z.date().optional(),
  category: z.nativeEnum(LogCategory).optional(),
  status: z.enum(['all', 'flagged', 'open', 'resolved']).default('all'),
  query: z.string().max(120).optional(),
}).optional();

export const logbookRouter = router({
  listByDate: protectedProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { startOfDay, endOfDay } = jamaicaDayRange(input?.date);
      const status = (input?.status ?? 'all') as LogbookStatusFilter;

      const entries = await ctx.db.logEntry.findMany({
        where: {
          storeId: ctx.storeId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          ...(input?.category ? { category: input.category } : {}),
          ...logbookStatusWhere(status),
          ...(input?.query?.trim()
            ? { body: { contains: input.query.trim(), mode: 'insensitive' as const } }
            : {}),
        },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          resolvedBy: { select: { id: true, fullName: true, role: true } },
          reads: { where: { userId: ctx.user.id }, select: { id: true, readAt: true } },
          comments: {
            include: { author: { select: { id: true, fullName: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          attachments: {
            include: { uploadedBy: { select: { id: true, fullName: true, role: true } } },
            orderBy: { createdAt: 'desc' },
          },
          links: { orderBy: { createdAt: 'desc' } },
          _count: { select: { reads: true, comments: true, attachments: true, links: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return sortLogbookEntries(entries).map((entry) => ({
        ...entry,
        isUnread: entry.authorId !== ctx.user.id && entry.reads.length === 0,
        seenByCount: entry._count.reads,
        commentCount: entry._count.comments,
        attachmentCount: entry._count.attachments,
        linkCount: entry._count.links,
        reads: undefined,
        _count: undefined,
      }));
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

  addComment: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      body: z.string().min(1).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEntryInStore(ctx.db, ctx.storeId, input.entryId);
      return ctx.db.logEntryComment.create({
        data: {
          logEntryId: input.entryId,
          authorId: ctx.user.id,
          body: input.body.trim(),
        },
        include: { author: { select: { id: true, fullName: true, role: true } } },
      });
    }),

  addAttachment: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      type: z.nativeEnum(LogEntryAttachmentType).default(LogEntryAttachmentType.IMAGE),
      url: z.string().url(),
      label: z.string().max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEntryInStore(ctx.db, ctx.storeId, input.entryId);
      return ctx.db.logEntryAttachment.create({
        data: {
          logEntryId: input.entryId,
          uploadedById: ctx.user.id,
          type: input.type,
          url: input.url,
          label: input.label,
        },
        include: { uploadedBy: { select: { id: true, fullName: true, role: true } } },
      });
    }),

  addLink: supervisorProcedure
    .input(z.object({
      entryId: z.string(),
      type: z.nativeEnum(TaskLinkType),
      entityId: z.string(),
      label: z.string().max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEntryInStore(ctx.db, ctx.storeId, input.entryId);
      const source = await assertSourceInStore(ctx.db, ctx.storeId, input.type, input.entityId);
      return ctx.db.logEntryLink.upsert({
        where: { logEntryId_type_entityId: { logEntryId: input.entryId, type: input.type, entityId: input.entityId } },
        create: {
          logEntryId: input.entryId,
          type: input.type,
          entityId: input.entityId,
          label: sourceLabel(input.type, source, input.label),
        },
        update: { label: sourceLabel(input.type, source, input.label) },
      });
    }),

  readReceipts: supervisorProcedure
    .input(z.object({ entryId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertEntryInStore(ctx.db, ctx.storeId, input.entryId);
      const [reads, users] = await Promise.all([
        ctx.db.logEntryRead.findMany({
          where: { logEntryId: input.entryId, user: { storeId: ctx.storeId } },
          include: { user: { select: { id: true, fullName: true, role: true } } },
          orderBy: { readAt: 'desc' },
        }),
        ctx.db.user.findMany({
          where: { storeId: ctx.storeId, isActive: true },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: 'asc' },
        }),
      ]);
      const seenIds = new Set(reads.map((read: any) => read.userId));
      return {
        seenBy: reads.map((read: any) => ({ ...read.user, readAt: read.readAt })),
        notSeenBy: users.filter((user: any) => !seenIds.has(user.id)),
      };
    }),

  createStockOutFromEntry: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      productName: z.string().min(1).max(200),
      location: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEntryInStore(ctx.db, ctx.storeId, input.entryId);
      const stockOut = await ctx.db.stockOutReport.create({
        data: {
          storeId: ctx.storeId,
          reportedById: ctx.user.id,
          productName: input.productName,
          location: input.location,
        },
      });
      await ctx.db.logEntryLink.upsert({
        where: { logEntryId_type_entityId: { logEntryId: input.entryId, type: TaskLinkType.STOCK_OUT, entityId: stockOut.id } },
        create: { logEntryId: input.entryId, type: TaskLinkType.STOCK_OUT, entityId: stockOut.id, label: stockOut.productName },
        update: { label: stockOut.productName },
      });
      return stockOut;
    }),

  createExpiryFromEntry: protectedProcedure
    .input(z.object({
      entryId: z.string(),
      productName: z.string().min(1).max(200),
      expiryDate: z.date(),
      quantity: z.number().int().min(1).default(1),
      location: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertEntryInStore(ctx.db, ctx.storeId, input.entryId);
      const expiry = await ctx.db.expiryAlert.create({
        data: {
          storeId: ctx.storeId,
          reportedById: ctx.user.id,
          productName: input.productName,
          expiryDate: input.expiryDate,
          quantity: input.quantity,
          location: input.location,
        },
      });
      await ctx.db.logEntryLink.upsert({
        where: { logEntryId_type_entityId: { logEntryId: input.entryId, type: TaskLinkType.EXPIRY_ALERT, entityId: expiry.id } },
        create: { logEntryId: input.entryId, type: TaskLinkType.EXPIRY_ALERT, entityId: expiry.id, label: expiry.productName },
        update: { label: expiry.productName },
      });
      return expiry;
    }),

  createIncidentFromEntry: supervisorProcedure
    .input(z.object({
      entryId: z.string(),
      title: z.string().min(1).max(200),
      severity: z.nativeEnum(IncidentSeverity).default(IncidentSeverity.MEDIUM),
    }))
    .mutation(async ({ ctx, input }) => {
      const entry = await assertEntryInStore(ctx.db, ctx.storeId, input.entryId);
      const incident = await ctx.db.incident.create({
        data: {
          storeId: ctx.storeId,
          reportedById: ctx.user.id,
          category: IncidentCategory.OTHER,
          title: input.title,
          description: entry.body,
          severity: input.severity,
        },
      });
      await ctx.db.logEntryLink.upsert({
        where: { logEntryId_type_entityId: { logEntryId: input.entryId, type: TaskLinkType.INCIDENT, entityId: incident.id } },
        create: { logEntryId: input.entryId, type: TaskLinkType.INCIDENT, entityId: incident.id, label: incident.title },
        update: { label: incident.title },
      });
      return incident;
    }),

  markRead: protectedProcedure
    .input(z.object({ entryIds: z.array(z.string()).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const ids = [...new Set(input.entryIds)];
      if (ids.length === 0) return { count: 0 };
      const entries = await ctx.db.logEntry.findMany({
        where: { id: { in: ids }, storeId: ctx.storeId },
        select: { id: true },
      });
      const allowedIds = entries.map((entry) => entry.id);
      if (allowedIds.length === 0) return { count: 0 };
      return ctx.db.logEntryRead.createMany({
        data: allowedIds.map((logEntryId) => ({ logEntryId, userId: ctx.user.id })),
        skipDuplicates: true,
      });
    }),

  resolve: supervisorProcedure
    .input(z.object({ entryId: z.string(), scope: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      await ctx.db.logEntry.findFirstOrThrow({
        where: { id: input.entryId, ...adminStoreWhere(scope), isFlagged: true },
        select: { id: true },
      });
      return ctx.db.logEntry.update({
        where: { id: input.entryId },
        data: { resolvedAt: new Date(), resolvedById: ctx.user.id },
      });
    }),

  reopen: supervisorProcedure
    .input(z.object({ entryId: z.string(), scope: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      await ctx.db.logEntry.findFirstOrThrow({
        where: { id: input.entryId, ...adminStoreWhere(scope), isFlagged: true },
        select: { id: true },
      });
      return ctx.db.logEntry.update({
        where: { id: input.entryId },
        data: { resolvedAt: null, resolvedById: null },
      });
    }),

  flagged: supervisorProcedure
    .query(async ({ ctx }) => {
      return ctx.db.logEntry.findMany({
        where: { storeId: ctx.storeId, isFlagged: true, resolvedAt: null },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          resolvedBy: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }),

  dailyDigest: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      date: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const { startOfDay, endOfDay } = jamaicaDayRange(input?.date);
      const where = {
        ...adminStoreWhere(scope),
        date: { gte: startOfDay, lte: endOfDay },
      };
      const [entries, openCount, openFlags, resolvedFlags, inventoryNotes, handovers, incidents, taskLinks] = await Promise.all([
        ctx.db.logEntry.count({ where }),
        ctx.db.logEntry.count({ where: { ...where, isFlagged: true, resolvedAt: null } }),
        ctx.db.logEntry.findMany({
          where: { ...where, isFlagged: true, resolvedAt: null },
          include: { store: { select: { id: true, name: true } }, author: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        ctx.db.logEntry.count({ where: { ...where, isFlagged: true, resolvedAt: { not: null } } }),
        ctx.db.logEntry.count({ where: { ...where, category: LogCategory.INVENTORY } }),
        ctx.db.logEntry.count({ where: { ...where, category: LogCategory.HANDOVER } }),
        ctx.db.logEntry.count({ where: { ...where, category: LogCategory.INCIDENT } }),
        ctx.db.logEntryLink.count({ where: { type: TaskLinkType.TASK, logEntry: where } }),
      ]);
      return {
        scope,
        date: startOfDay,
        entries,
        openCount,
        resolvedCount: resolvedFlags,
        inventoryNotes,
        handovers,
        incidents,
        tasksCreated: taskLinks,
        openFlags,
      };
    }),

  reviewQueue: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      status: z.enum(['open', 'resolved', 'all']).default('open'),
      category: z.nativeEnum(LogCategory).optional(),
      query: z.string().max(120).optional(),
      take: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const status = input?.status ?? 'open';
      const where: any = {
        ...adminStoreWhere(scope),
        ...(input?.category ? { category: input.category } : {}),
        ...(status === 'open' ? { isFlagged: true, resolvedAt: null } : {}),
        ...(status === 'resolved' ? { resolvedAt: { not: null } } : {}),
        ...(input?.query?.trim() ? { body: { contains: input.query.trim(), mode: 'insensitive' } } : {}),
      };
      return ctx.db.logEntry.findMany({
        where,
        include: {
          store: { select: { id: true, name: true } },
          author: { select: { id: true, fullName: true, role: true } },
          resolvedBy: { select: { id: true, fullName: true, role: true } },
          attachments: true,
          links: true,
          _count: { select: { comments: true, reads: true, attachments: true, links: true } },
        },
        orderBy: [{ resolvedAt: 'asc' }, { createdAt: 'desc' }],
        take: input?.take ?? 50,
      });
    }),
});
