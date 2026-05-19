import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  Priority,
  TaskLinkType,
  TaskStatus,
  TaskUpdateType,
  ThreadAttachmentType,
  ThreadCategory,
  ThreadLifecycleEventType,
  ThreadModerationAction,
  ThreadReactionType,
} from '@superplus/db';
import type { Role } from '@superplus/config';
import { router, protectedProcedure, supervisorProcedure } from '../init';
import { createNotification } from '../../notifications';
import { detectThreadOpsSuggestions } from '../../thread-ops-rules';
import { adminStoreWhere, resolveAdminScope } from './admin-scope';
import {
  allowedThreadReactions,
  canDeleteThreadMessage,
  canEditThreadMessage,
  shouldNotifyFollower,
  threadViews,
  uniqueRecipients,
  unreadCountForThread,
} from './threads-policy';

const attachmentInput = z.object({
  type: z.nativeEnum(ThreadAttachmentType),
  url: z.string().url().max(2000),
  label: z.string().max(120).optional(),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().min(0).max(5_000_000).optional(),
  storageKey: z.string().max(500).optional(),
});

const linkInput = z.object({
  type: z.nativeEnum(TaskLinkType),
  entityId: z.string().min(1).max(120),
  label: z.string().max(120).optional(),
});

const mentionGroupInput = z.enum(['SUPERVISORS']);
type MentionGroup = z.infer<typeof mentionGroupInput>;

const threadTemplates = [
  {
    id: 'stock-issue',
    title: 'Stock Issue',
    icon: 'inventory_2',
    category: ThreadCategory.INVENTORY,
    topic: 'Stock issue',
    body: 'Item:\nLocation:\nWhat happened:\nHelp needed:',
  },
  {
    id: 'customer-complaint',
    title: 'Customer Complaint',
    icon: 'support_agent',
    category: ThreadCategory.URGENT,
    topic: 'Customer complaint',
    body: 'Customer issue:\nWhat was done so far:\nWho needs to know:',
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    icon: 'build',
    category: ThreadCategory.MAINTENANCE,
    topic: 'Maintenance needed',
    body: 'Area/equipment:\nProblem:\nCan we keep operating safely:',
  },
  {
    id: 'shift-handover',
    title: 'Shift Handover',
    icon: 'sync_alt',
    category: ThreadCategory.GENERAL,
    topic: 'Shift handover',
    body: 'Done:\nStill open:\nWatch out for:',
  },
] as const;

const messageInclude = {
  author: { select: { id: true, fullName: true, role: true } },
  deletedBy: { select: { id: true, fullName: true, role: true } },
  attachments: {
    include: { uploadedBy: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  mentions: {
    include: { user: { select: { id: true, fullName: true, role: true } } },
  },
  reactions: {
    include: { user: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  links: true,
};

function uniqueIds(ids?: string[]) {
  return [...new Set((ids || []).filter(Boolean))];
}

async function validateStoreUsers(db: any, storeId: string, userIds?: string[]) {
  const ids = uniqueIds(userIds);
  if (ids.length === 0) return [];
  const users = await db.user.findMany({
    where: { id: { in: ids }, storeId, isActive: true },
    select: { id: true, fullName: true, role: true },
  });
  if (users.length !== ids.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more mentioned staff are not in this store' });
  }
  return users;
}

async function resolveMentionUserIds(db: any, storeId: string, actorId: string, userIds?: string[], groupIds?: MentionGroup[]) {
  const directUsers = await validateStoreUsers(db, storeId, userIds);
  const directIds = directUsers.map((user: { id: string }) => user.id);
  const groupRoles = new Set<string>();
  if (groupIds?.includes('SUPERVISORS')) {
    groupRoles.add('SUPERVISOR');
    groupRoles.add('MANAGER');
    groupRoles.add('OWNER');
  }
  const groupUsers = groupRoles.size
    ? await db.user.findMany({
      where: { storeId, isActive: true, role: { in: [...groupRoles] } },
      select: { id: true },
    })
    : [];
  return uniqueRecipients(actorId, [...directIds, ...groupUsers.map((user: { id: string }) => user.id)]);
}

function attachmentData(attachment: z.infer<typeof attachmentInput>, actorId: string, messageId: string) {
  return {
    messageId,
    uploadedById: actorId,
    type: attachment.type,
    url: attachment.url,
    label: attachment.label?.trim() || undefined,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    storageKey: attachment.storageKey,
  };
}

async function assertSourceInStore(db: any, storeId: string, type: TaskLinkType, entityId: string) {
  switch (type) {
    case TaskLinkType.TASK:
      return db.task.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, title: true } });
    case TaskLinkType.THREAD:
      return db.thread.findFirstOrThrow({ where: { id: entityId, storeId }, select: { id: true, title: true } });
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

async function notifyUsers(db: any, userIds: string[], type: string, title: string, body?: string, link?: string) {
  if (userIds.length === 0) return;
  await Promise.all(userIds.map((userId) => createNotification(db, userId, type, title, body, link)));
}

async function logThreadEvent(
  db: any,
  input: {
    threadId: string;
    messageId?: string | null;
    actorId: string;
    action: ThreadModerationAction;
    note?: string;
    metadata?: Record<string, unknown>;
  }
) {
  return db.threadModerationEvent.create({
    data: {
      threadId: input.threadId,
      messageId: input.messageId,
      actorId: input.actorId,
      action: input.action,
      note: input.note,
      metadata: input.metadata,
    },
  });
}

async function notifyThreadCreate(ctx: any, thread: any, body: string, mentionedUserIds: string[]) {
  const link = `/hub/threads/${thread.id}`;
  const mentionRecipients = uniqueRecipients(ctx.user.id, mentionedUserIds);
  await notifyUsers(
    ctx.db,
    mentionRecipients,
    'THREAD_MENTION',
    `${ctx.user.name} mentioned you`,
    thread.title,
    link
  );
  if (thread.category !== ThreadCategory.URGENT) return;
  const staff = await ctx.db.user.findMany({
    where: { storeId: ctx.storeId, isActive: true },
    select: { id: true },
  });
  await notifyUsers(
    ctx.db,
    uniqueRecipients(ctx.user.id, staff.map((user: { id: string }) => user.id)).filter((id) => !mentionRecipients.includes(id)),
    'THREAD_URGENT',
    `Urgent thread: ${thread.title}`,
    body.slice(0, 120),
    link
  );
}

async function notifyThreadReply(ctx: any, thread: any, body: string, mentionedUserIds: string[]) {
  const link = `/hub/threads/${thread.id}`;
  const mentionRecipients = uniqueRecipients(ctx.user.id, mentionedUserIds);
  await notifyUsers(ctx.db, mentionRecipients, 'THREAD_MENTION', `${ctx.user.name} mentioned you`, thread.title, link);

  const participantRecipients = (thread.participants || [])
    .filter(shouldNotifyFollower)
    .map((participant: { userId: string }) => participant.userId);
  const authorParticipant = (thread.participants || [])
    .find((participant: { userId: string }) => participant.userId === thread.authorId);
  const authorRecipient = authorParticipant
    ? shouldNotifyFollower(authorParticipant) ? thread.authorId : null
    : thread.authorId;
  const replyRecipients = uniqueRecipients(ctx.user.id, [
    authorRecipient,
    ...participantRecipients,
  ]).filter((id) => !mentionRecipients.includes(id));
  await notifyUsers(ctx.db, replyRecipients, 'THREAD_REPLY', `New reply: ${thread.title}`, body.slice(0, 120), link);
}

function participantFromThread(thread: any) {
  return thread.participants?.[0] ?? null;
}

async function summarizeThread(ctx: any, thread: any) {
  const participant = participantFromThread(thread);
  const unreadMessages = await ctx.db.threadMessage.findMany({
    where: { threadId: thread.id },
    select: { authorId: true, createdAt: true, deletedAt: true },
  });
  const attachmentCount = await ctx.db.threadMessageAttachment.count({
    where: { message: { threadId: thread.id } },
  });
  const unreadCount = unreadCountForThread(unreadMessages, participant, ctx.user.id);
  const lastMessage = thread.messages?.[0] ?? null;
  const preview = lastMessage?.deletedAt
    ? 'Message deleted'
    : lastMessage?.body || 'No messages yet';

  return {
    ...thread,
    preview,
    lastSender: lastMessage?.author ?? thread.lastMessageBy ?? thread.author,
    unreadCount,
    isMentioned: thread.mentions?.some((mention: { userId: string }) => mention.userId === ctx.user.id) ?? false,
    isFollowing: participant?.isFollowing ?? false,
    isSaved: participant?.isSaved ?? false,
    isMuted: !!participant?.mutedAt,
    attachmentCount,
  };
}

function ackUserIds(messages: Array<{ reactions?: Array<{ type: ThreadReactionType | string; userId: string }> }>) {
  return new Set(messages.flatMap((message) => message.reactions || []).filter((reaction) => reaction.type === ThreadReactionType.ACK).map((reaction) => reaction.userId));
}

const threadSearchStatuses = ['ACTIVE', 'RESOLVED', 'ANY'] as const;
const threadHealthFilters = ['URGENT', 'NO_REPLY', 'NEEDS_TASK', 'UNACKED'] as const;

function applyThreadHealthWhere(where: any, health?: typeof threadHealthFilters[number]) {
  if (health === 'URGENT') where.category = ThreadCategory.URGENT;
  if (health === 'NEEDS_TASK') where.links = { none: { type: TaskLinkType.TASK } };
  if (health === 'UNACKED') where.category = ThreadCategory.URGENT;
}

function firstResponseMinutes(thread: any) {
  const messages = [...(thread.messages || [])].filter((message: any) => !message.deletedAt)
    .sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime());
  const first = messages[0];
  if (!first) return null;
  const response = messages.find((message: any) => message.authorId !== first.authorId);
  if (!response) return null;
  return Math.max(0, Math.round((response.createdAt.getTime() - first.createdAt.getTime()) / 60_000));
}

export const threadsRouter = router({
  mentionableUsers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { storeId: ctx.storeId, isActive: true, id: { not: ctx.user.id } },
      select: { id: true, fullName: true, role: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
  }),

  mentionTargets: protectedProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: { storeId: ctx.storeId, isActive: true, id: { not: ctx.user.id } },
      select: { id: true, fullName: true, role: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
    const supervisorCount = users.filter((user: { role: string }) => ['SUPERVISOR', 'MANAGER', 'OWNER'].includes(user.role)).length;
    return {
      users,
      groups: supervisorCount > 0 ? [{ id: 'SUPERVISORS' as const, label: 'Supervisors', count: supervisorCount, icon: 'supervisor_account' }] : [],
    };
  }),

  templates: protectedProcedure.query(() => threadTemplates),

  list: protectedProcedure
    .input(z.object({
      view: z.enum(threadViews).optional(),
      category: z.nativeEnum(ThreadCategory).optional(),
      search: z.string().max(100).optional(),
      authorId: z.string().optional(),
      mentionedUserId: z.string().optional(),
      hasAttachment: z.boolean().optional(),
      hasTask: z.boolean().optional(),
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
      status: z.enum(threadSearchStatuses).optional(),
      health: z.enum(threadHealthFilters).optional(),
      take: z.number().min(1).max(100).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const view = input?.view ?? 'ALL';
      const where: any = { storeId: ctx.storeId };
      const status = input?.status;
      if (status === 'RESOLVED' || view === 'RESOLVED') where.isResolved = true;
      else if (status === 'ANY') {
        // Leave both active and resolved threads searchable.
      } else where.isResolved = false;
      if (view === 'PINNED') where.isPinned = true;
      if (view === 'SAVED') where.participants = { some: { userId: ctx.user.id, isSaved: true } };
      if (view === 'MENTIONED') where.mentions = { some: { userId: ctx.user.id, message: { deletedAt: null } } };
      if (view === 'URGENT' || view === 'UNACKED') where.category = ThreadCategory.URGENT;
      if (view === 'NEEDS_TASK') where.links = { none: { type: TaskLinkType.TASK } };
      if (input?.category) where.category = input.category;
      if (input?.authorId) where.authorId = input.authorId;
      if (input?.mentionedUserId) where.mentions = { some: { userId: input.mentionedUserId, message: { deletedAt: null } } };
      if (input?.hasAttachment === true) where.messages = { some: { attachments: { some: {} }, deletedAt: null } };
      if (input?.hasAttachment === false) where.messages = { none: { attachments: { some: {} } } };
      if (input?.hasTask === true) where.links = { some: { type: TaskLinkType.TASK } };
      if (input?.hasTask === false) where.links = { none: { type: TaskLinkType.TASK } };
      if (input?.dateFrom || input?.dateTo) {
        where.createdAt = {
          ...(input.dateFrom ? { gte: input.dateFrom } : {}),
          ...(input.dateTo ? { lte: input.dateTo } : {}),
        };
      }
      applyThreadHealthWhere(where, input?.health);
      if (input?.search?.trim()) {
        const search = input.search.trim();
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { messages: { some: { body: { contains: search, mode: 'insensitive' }, deletedAt: null } } },
          { author: { fullName: { contains: search, mode: 'insensitive' } } },
          { messages: { some: { author: { fullName: { contains: search, mode: 'insensitive' } }, deletedAt: null } } },
          { messages: { some: { attachments: { some: { label: { contains: search, mode: 'insensitive' } } }, deletedAt: null } } },
          { links: { some: { label: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      const threads = await ctx.db.thread.findMany({
        where,
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          lastMessageBy: { select: { id: true, fullName: true, role: true } },
          participants: { where: { userId: ctx.user.id } },
          mentions: { where: { userId: ctx.user.id, message: { deletedAt: null } }, select: { id: true, userId: true } },
          messages: {
            include: {
              author: { select: { id: true, fullName: true, role: true } },
              reactions: { select: { type: true, userId: true } },
              _count: { select: { attachments: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: view === 'UNACKED' ? 100 : 1,
          },
          _count: { select: { messages: true, links: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        take: view === 'UNREAD' ? Math.max(input?.take ?? 50, 80) : input?.take ?? 50,
      });

      const summarized = await Promise.all(threads.map((thread: any) => summarizeThread(ctx, thread)));
      if (view === 'UNREAD') return summarized.filter((thread) => thread.unreadCount > 0).slice(0, input?.take ?? 50);
      if (view === 'NO_REPLY' || input?.health === 'NO_REPLY') return summarized.filter((thread: any) => thread._count.messages <= 1).slice(0, input?.take ?? 50);
      if (view === 'UNACKED' || input?.health === 'UNACKED') return summarized.filter((thread: any) => ackUserIds(thread.messages).size === 0).slice(0, input?.take ?? 50);
      return summarized;
    }),

  counts: protectedProcedure.query(async ({ ctx }) => {
    const threads = await ctx.db.thread.findMany({
      where: { storeId: ctx.storeId },
      include: {
        participants: { where: { userId: ctx.user.id } },
        mentions: { where: { userId: ctx.user.id, message: { deletedAt: null } }, select: { id: true } },
        links: { select: { type: true } },
        messages: { select: { authorId: true, createdAt: true, deletedAt: true, reactions: { select: { type: true, userId: true } } } },
      },
      take: 300,
    });
    return {
      all: threads.filter((thread: any) => !thread.isResolved).length,
      unread: threads.filter((thread: any) => !thread.isResolved && unreadCountForThread(thread.messages, participantFromThread(thread), ctx.user.id) > 0).length,
      mentioned: threads.filter((thread: any) => !thread.isResolved && thread.mentions.length > 0).length,
      pinned: threads.filter((thread: any) => !thread.isResolved && thread.isPinned).length,
      saved: threads.filter((thread: any) => !thread.isResolved && participantFromThread(thread)?.isSaved).length,
      resolved: threads.filter((thread: any) => thread.isResolved).length,
      urgent: threads.filter((thread: any) => !thread.isResolved && thread.category === ThreadCategory.URGENT).length,
      noReply: threads.filter((thread: any) => !thread.isResolved && thread.messages.length <= 1).length,
      needsTask: threads.filter((thread: any) => !thread.isResolved && !thread.links.some((link: { type: TaskLinkType }) => link.type === TaskLinkType.TASK)).length,
      unacked: threads.filter((thread: any) => !thread.isResolved && thread.category === ThreadCategory.URGENT && ackUserIds(thread.messages).size === 0).length,
    };
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const thread = await ctx.db.thread.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: {
          author: { select: { id: true, fullName: true, role: true } },
          resolvedBy: { select: { id: true, fullName: true, role: true } },
          lastMessageBy: { select: { id: true, fullName: true, role: true } },
          participants: { where: { userId: ctx.user.id } },
          links: true,
          moderationEvents: {
            include: { actor: { select: { id: true, fullName: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          messages: {
            include: messageInclude,
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      const unreadCount = unreadCountForThread(
        thread.messages.map((message: any) => ({ authorId: message.authorId, createdAt: message.createdAt, deletedAt: message.deletedAt })),
        participantFromThread(thread),
        ctx.user.id
      );
      return {
        ...thread,
        unreadCount,
        isFollowing: participantFromThread(thread)?.isFollowing ?? false,
        isSaved: participantFromThread(thread)?.isSaved ?? false,
        isMuted: !!participantFromThread(thread)?.mutedAt,
      };
    }),

  recap: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const thread = await ctx.db.thread.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: {
          author: { select: { id: true, fullName: true } },
          links: true,
          messages: {
            where: { deletedAt: null },
            include: {
              author: { select: { id: true, fullName: true } },
              reactions: { include: { user: { select: { id: true, fullName: true } } } },
              links: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      const visibleMessages = thread.messages;
      const latest = visibleMessages.slice(-3).map((message: any) => ({
        id: message.id,
        author: message.author.fullName,
        body: message.body.slice(0, 180),
        createdAt: message.createdAt,
      }));
      const pinned = visibleMessages.filter((message: any) => message.isPinned).map((message: any) => ({
        id: message.id,
        author: message.author.fullName,
        body: message.body.slice(0, 180),
      }));
      const openQuestions = visibleMessages.filter((message: any) => message.body.includes('?')).slice(-3).map((message: any) => ({
        id: message.id,
        author: message.author.fullName,
        body: message.body.slice(0, 180),
      }));
      const decisions = visibleMessages.filter((message: any) => /done|decided|approved|resolved|pulled|ordered/i.test(message.body)).slice(-3).map((message: any) => ({
        id: message.id,
        author: message.author.fullName,
        body: message.body.slice(0, 180),
      }));
      const acks = [...ackUserIds(visibleMessages as any)].length;
      const taskLinks = thread.links.filter((link: any) => link.type === TaskLinkType.TASK);
      return {
        title: thread.title,
        messageCount: visibleMessages.length,
        latest,
        pinned,
        openQuestions,
        decisions,
        ackCount: acks,
        taskLinks,
      };
    }),

  readReceipts: supervisorProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const thread = await ctx.db.thread.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        select: {
          id: true,
          category: true,
          lastMessageAt: true,
          updatedAt: true,
          participants: { include: { user: { select: { id: true, fullName: true, role: true, isActive: true } } } },
          messages: { select: { reactions: { select: { type: true, userId: true } } } },
        },
      });
      if (thread.category !== ThreadCategory.URGENT) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Read receipts are only shown for urgent threads' });
      }
      const staff = await ctx.db.user.findMany({
        where: { storeId: ctx.storeId, isActive: true },
        select: { id: true, fullName: true, role: true },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      });
      const participantByUser = new Map(thread.participants.map((participant: any) => [participant.userId, participant]));
      const ackedIds = ackUserIds(thread.messages as any);
      const readCutoff = thread.lastMessageAt ?? thread.updatedAt;
      return staff.map((user: any) => {
        const participant: any = participantByUser.get(user.id);
        return {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          lastReadAt: participant?.lastReadAt ?? null,
          hasSeen: !!participant?.lastReadAt && participant.lastReadAt >= readCutoff,
          hasAcknowledged: ackedIds.has(user.id),
          isMuted: !!participant?.mutedAt,
        };
      });
    }),

  detectOpsSuggestions: supervisorProcedure
    .input(z.object({ threadId: z.string(), messageId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const thread = await ctx.db.thread.findFirstOrThrow({
        where: { id: input.threadId, storeId: ctx.storeId },
        include: {
          messages: {
            where: input.messageId ? { id: input.messageId, deletedAt: null } : { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: input.messageId ? 1 : 5,
          },
        },
      });
      const body = thread.messages.map((message: any) => message.body).join('\n');
      const rawSuggestions = detectThreadOpsSuggestions({ title: thread.title, body, category: thread.category });
      const dismissedEvents = await ctx.db.threadLifecycleEvent.findMany({
        where: {
          threadId: thread.id,
          actorId: ctx.user.id,
          type: ThreadLifecycleEventType.OPS_SUGGESTION_DISMISSED,
        },
        select: { metadata: true },
      });
      const dismissed = new Set(dismissedEvents.map((event: any) => event.metadata?.suggestionId).filter(Boolean));
      const messageId = input.messageId || thread.messages[0]?.id || null;
      return rawSuggestions
        .filter((suggestion) => !dismissed.has(suggestion.id))
        .map((suggestion) => ({ ...suggestion, threadId: thread.id, messageId }));
    }),

  dismissOpsSuggestion: supervisorProcedure
    .input(z.object({ threadId: z.string(), suggestionId: z.string().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.thread.findFirstOrThrow({ where: { id: input.threadId, storeId: ctx.storeId }, select: { id: true } });
      await ctx.db.threadLifecycleEvent.create({
        data: {
          threadId: input.threadId,
          actorId: ctx.user.id,
          type: ThreadLifecycleEventType.OPS_SUGGESTION_DISMISSED,
          metadata: { suggestionId: input.suggestionId },
        },
      });
      return { success: true };
    }),

  supervisorInbox: supervisorProcedure
    .input(z.object({
      view: z.enum(['ALL', 'URGENT', 'NO_REPLY', 'NEEDS_TASK', 'STALE', 'INCIDENTS', 'OVERDUE_TASKS']).optional(),
      take: z.number().min(1).max(100).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60_000);
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60_000);
      const take = input?.take ?? 50;

      const [threads, incidents, tasks] = await Promise.all([
        ctx.db.thread.findMany({
          where: { storeId: ctx.storeId, isResolved: false },
          include: {
            author: { select: { fullName: true } },
            links: true,
            messages: {
              where: { deletedAt: null },
              include: { reactions: { select: { type: true, userId: true } } },
              orderBy: { createdAt: 'asc' },
            },
            lifecycleEvents: {
              where: { type: { in: [ThreadLifecycleEventType.NO_REPLY_FLAGGED, ThreadLifecycleEventType.STALE_RESOLVE_SUGGESTED] } },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
          orderBy: [{ isPinned: 'desc' }, { lastMessageAt: 'desc' }, { createdAt: 'desc' }],
          take: 150,
        }),
        ctx.db.incident.findMany({
          where: { storeId: ctx.storeId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }).catch(() => []),
        ctx.db.task.findMany({
          where: {
            storeId: ctx.storeId,
            dueDate: { lt: now },
            status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          },
          orderBy: { dueDate: 'asc' },
          take: 20,
        }).catch(() => []),
      ]);

      const items: any[] = [];
      for (const thread of threads) {
        const acked = ackUserIds(thread.messages).size > 0;
        const hasTask = thread.links.some((link: any) => link.type === TaskLinkType.TASK);
        const suggestions = detectThreadOpsSuggestions({
          title: thread.title,
          body: thread.messages.map((message: any) => message.body).join('\n'),
          category: thread.category,
        });
        const lastActivity = thread.lastMessageAt ?? thread.updatedAt;
        if (thread.category === ThreadCategory.URGENT && !acked) {
          items.push({
            id: `urgent-${thread.id}`,
            type: 'URGENT',
            icon: 'priority_high',
            title: thread.title,
            subtitle: 'Urgent thread needs acknowledgement',
            threadId: thread.id,
            href: `/hub/threads/${thread.id}`,
            severity: 'high',
            createdAt: lastActivity,
          });
        }
        if (thread.createdAt <= fourHoursAgo && thread.messages.length <= 1) {
          items.push({
            id: `no-reply-${thread.id}`,
            type: 'NO_REPLY',
            icon: 'mark_chat_unread',
            title: thread.title,
            subtitle: `No reply yet. Started by ${thread.author.fullName}`,
            threadId: thread.id,
            href: `/hub/threads/${thread.id}`,
            severity: 'medium',
            createdAt: thread.createdAt,
          });
        }
        if (!hasTask && suggestions.length > 0) {
          items.push({
            id: `needs-task-${thread.id}`,
            type: 'NEEDS_TASK',
            icon: suggestions[0].icon,
            title: thread.title,
            subtitle: suggestions[0].title,
            threadId: thread.id,
            href: `/hub/threads/${thread.id}`,
            severity: suggestions[0].priority === 'URGENT' ? 'high' : 'medium',
            createdAt: lastActivity,
          });
        }
        if (lastActivity <= fortyEightHoursAgo && thread.lifecycleEvents.some((event: any) => event.type === ThreadLifecycleEventType.STALE_RESOLVE_SUGGESTED)) {
          items.push({
            id: `stale-${thread.id}`,
            type: 'STALE',
            icon: 'task_alt',
            title: thread.title,
            subtitle: 'Linked task is done. Check if this can be closed.',
            threadId: thread.id,
            href: `/hub/threads/${thread.id}`,
            severity: 'low',
            createdAt: lastActivity,
          });
        }
      }

      for (const incident of incidents) {
        items.push({
          id: `incident-${incident.id}`,
          type: 'INCIDENTS',
          icon: 'report_problem',
          title: incident.title,
          subtitle: `${incident.severity} incident still open`,
          href: `/tools/incidents/${incident.id}`,
          severity: incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ? 'high' : 'medium',
          createdAt: incident.createdAt,
        });
      }

      for (const task of tasks) {
        items.push({
          id: `task-${task.id}`,
          type: 'OVERDUE_TASKS',
          icon: 'assignment_late',
          title: task.title,
          subtitle: 'Overdue task',
          href: `/hub/tasks/${task.id}`,
          severity: 'medium',
          createdAt: task.dueDate ?? task.createdAt,
        });
      }

      return items
        .filter((item) => !input?.view || input.view === 'ALL' || item.type === input.view)
        .sort((a, b) => {
          const weight: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (weight[a.severity] - weight[b.severity]) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, take);
    }),

  analyticsSummary: supervisorProcedure
    .input(z.object({ storeId: z.string().optional(), days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - (input?.days ?? 30));
      const scope = await resolveAdminScope(ctx as any, input?.storeId);
      const where = { ...adminStoreWhere(scope), createdAt: { gte: since } };
      const threads = await ctx.db.thread.findMany({
        where,
        include: {
          links: true,
          messages: {
            where: { deletedAt: null },
            select: { authorId: true, body: true, createdAt: true, reactions: { select: { type: true, userId: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      const responseTimes = threads.map(firstResponseMinutes).filter((value): value is number => value != null);
      const suggestions = threads.flatMap((thread: any) => detectThreadOpsSuggestions({
        title: thread.title,
        body: thread.messages.map((message: any) => message.body).join('\n'),
        category: thread.category,
      }).map((suggestion) => suggestion.id));
      const recurring = [...suggestions.reduce((map, id) => map.set(id, (map.get(id) || 0) + 1), new Map<string, number>())]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, count]) => ({ label: label.replaceAll('_', ' ').toLowerCase(), count }));
      const urgentThreads = threads.filter((thread: any) => thread.category === ThreadCategory.URGENT);
      const unackedUrgent = urgentThreads.filter((thread: any) => ackUserIds(thread.messages).size === 0).length;
      const noReply = threads.filter((thread: any) => thread.messages.length <= 1).length;
      return {
        totalThreads: threads.length,
        urgentThreads: urgentThreads.length,
        averageFirstResponseMinutes: responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length) : null,
        unacknowledgedUrgentCount: unackedUrgent,
        noReplyCount: noReply,
        taskConversionRate: threads.length ? Math.round((threads.filter((thread: any) => thread.links.some((link: any) => link.type === TaskLinkType.TASK)).length / threads.length) * 100) : 0,
        recurringIssueKeywords: recurring,
      };
    }),

  analyticsByCategory: supervisorProcedure
    .input(z.object({ storeId: z.string().optional(), days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - (input?.days ?? 30));
      const scope = await resolveAdminScope(ctx as any, input?.storeId);
      const where = { ...adminStoreWhere(scope), createdAt: { gte: since } };
      const groups = await ctx.db.thread.groupBy({
        by: ['category'],
        where,
        _count: true,
        orderBy: { _count: { category: 'desc' } },
      });
      return groups.map((group: any) => ({ category: group.category, count: group._count }));
    }),

  analyticsResponseTimes: supervisorProcedure
    .input(z.object({ storeId: z.string().optional(), days: z.number().min(1).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - (input?.days ?? 30));
      const scope = await resolveAdminScope(ctx as any, input?.storeId);
      const threads = await ctx.db.thread.findMany({
        where: { ...adminStoreWhere(scope), createdAt: { gte: since } },
        include: {
          messages: {
            where: { deletedAt: null },
            select: { authorId: true, createdAt: true, deletedAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      const values = threads.map(firstResponseMinutes).filter((value): value is number => value != null);
      return {
        averageMinutes: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
        underOneHour: values.filter((value) => value <= 60).length,
        overFourHours: values.filter((value) => value > 240).length,
        unanswered: threads.length - values.length,
      };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      category: z.nativeEnum(ThreadCategory).optional(),
      body: z.string().min(1).max(2000),
      mentionedUserIds: z.array(z.string()).max(30).optional(),
      mentionGroupIds: z.array(mentionGroupInput).max(3).optional(),
      attachments: z.array(attachmentInput).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const mentionedUserIds = await resolveMentionUserIds(ctx.db, ctx.storeId, ctx.user.id, input.mentionedUserIds, input.mentionGroupIds);
      const result = await ctx.db.$transaction(async (tx: any) => {
        const thread = await tx.thread.create({
          data: {
            storeId: ctx.storeId,
            authorId: ctx.user.id,
            title: input.title,
            category: input.category,
            lastMessageAt: new Date(),
            lastMessageById: ctx.user.id,
          },
        });
        const message = await tx.threadMessage.create({
          data: {
            threadId: thread.id,
            authorId: ctx.user.id,
            body: input.body,
          },
        });
        if (mentionedUserIds.length) {
          await tx.threadMention.createMany({
            data: mentionedUserIds.map((userId: string) => ({ threadId: thread.id, messageId: message.id, userId })),
            skipDuplicates: true,
          });
        }
        if (input.attachments?.length) {
          await tx.threadMessageAttachment.createMany({
            data: input.attachments.map((attachment) => attachmentData(attachment, ctx.user.id, message.id)),
          });
        }
        await tx.threadParticipant.create({
          data: {
            threadId: thread.id,
            userId: ctx.user.id,
            lastReadAt: new Date(),
            isFollowing: true,
          },
        });
        return { thread, message };
      });

      try {
        await notifyThreadCreate(ctx, result.thread, input.body, mentionedUserIds);
      } catch {}
      return result.thread;
    }),

  reply: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      body: z.string().min(1).max(2000),
      mentionedUserIds: z.array(z.string()).max(30).optional(),
      mentionGroupIds: z.array(mentionGroupInput).max(3).optional(),
      attachments: z.array(attachmentInput).max(5).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.db.thread.findFirstOrThrow({
        where: { id: input.threadId, storeId: ctx.storeId },
        include: { participants: true },
      });
      if (thread.isResolved) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This thread is already resolved' });
      }
      const mentionedUserIds = await resolveMentionUserIds(ctx.db, ctx.storeId, ctx.user.id, input.mentionedUserIds, input.mentionGroupIds);
      const message = await ctx.db.$transaction(async (tx: any) => {
        const created = await tx.threadMessage.create({
          data: {
            threadId: input.threadId,
            authorId: ctx.user.id,
            body: input.body,
          },
          include: messageInclude,
        });
        if (mentionedUserIds.length) {
          await tx.threadMention.createMany({
            data: mentionedUserIds.map((userId: string) => ({ threadId: input.threadId, messageId: created.id, userId })),
            skipDuplicates: true,
          });
        }
        if (input.attachments?.length) {
          await tx.threadMessageAttachment.createMany({
            data: input.attachments.map((attachment) => attachmentData(attachment, ctx.user.id, created.id)),
          });
        }
        await tx.thread.update({
          where: { id: input.threadId },
          data: { lastMessageAt: created.createdAt, lastMessageById: ctx.user.id },
        });
        await tx.threadParticipant.upsert({
          where: { threadId_userId: { threadId: input.threadId, userId: ctx.user.id } },
          create: { threadId: input.threadId, userId: ctx.user.id, lastReadAt: created.createdAt, isFollowing: true },
          update: { lastReadAt: created.createdAt, isFollowing: true },
        });
        return created;
      });

      try {
        await notifyThreadReply(ctx, thread, input.body, mentionedUserIds);
      } catch {}
      return message;
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.thread.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId }, select: { id: true } });
      return ctx.db.threadParticipant.upsert({
        where: { threadId_userId: { threadId: input.id, userId: ctx.user.id } },
        create: { threadId: input.id, userId: ctx.user.id, lastReadAt: new Date(), isFollowing: true },
        update: { lastReadAt: new Date() },
      });
    }),

  markAllRead: protectedProcedure
    .input(z.object({ includeResolved: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const threads = await ctx.db.thread.findMany({
        where: {
          storeId: ctx.storeId,
          ...(input?.includeResolved ? {} : { isResolved: false }),
        },
        select: { id: true, lastMessageAt: true, updatedAt: true },
        take: 500,
      });
      if (threads.length === 0) return { count: 0 };
      await ctx.db.$transaction(threads.map((thread: { id: string; lastMessageAt: Date | null; updatedAt: Date }) =>
        ctx.db.threadParticipant.upsert({
          where: { threadId_userId: { threadId: thread.id, userId: ctx.user.id } },
          create: {
            threadId: thread.id,
            userId: ctx.user.id,
            lastReadAt: thread.lastMessageAt ?? thread.updatedAt,
            isFollowing: true,
          },
          update: { lastReadAt: thread.lastMessageAt ?? thread.updatedAt },
        })
      ));
      return { count: threads.length };
    }),

  toggleFollow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.thread.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId }, select: { id: true } });
      const existing = await ctx.db.threadParticipant.findUnique({
        where: { threadId_userId: { threadId: input.id, userId: ctx.user.id } },
      });
      const isFollowing = !(existing?.isFollowing ?? false);
      return ctx.db.threadParticipant.upsert({
        where: { threadId_userId: { threadId: input.id, userId: ctx.user.id } },
        create: { threadId: input.id, userId: ctx.user.id, lastReadAt: new Date(), isFollowing },
        update: { isFollowing },
      });
    }),

  toggleMute: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.thread.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId }, select: { id: true } });
      const existing = await ctx.db.threadParticipant.findUnique({
        where: { threadId_userId: { threadId: input.id, userId: ctx.user.id } },
      });
      const mutedAt = existing?.mutedAt ? null : new Date();
      return ctx.db.threadParticipant.upsert({
        where: { threadId_userId: { threadId: input.id, userId: ctx.user.id } },
        create: { threadId: input.id, userId: ctx.user.id, lastReadAt: new Date(), isFollowing: true, mutedAt },
        update: { mutedAt },
      });
    }),

  toggleSave: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.thread.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId }, select: { id: true } });
      const existing = await ctx.db.threadParticipant.findUnique({
        where: { threadId_userId: { threadId: input.id, userId: ctx.user.id } },
      });
      const isSaved = !(existing?.isSaved ?? false);
      return ctx.db.threadParticipant.upsert({
        where: { threadId_userId: { threadId: input.id, userId: ctx.user.id } },
        create: { threadId: input.id, userId: ctx.user.id, lastReadAt: new Date(), isFollowing: true, isSaved },
        update: { isSaved },
      });
    }),

  react: protectedProcedure
    .input(z.object({ messageId: z.string(), type: z.nativeEnum(ThreadReactionType) }))
    .mutation(async ({ ctx, input }) => {
      if (!allowedThreadReactions.includes(input.type)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Reaction is not supported' });
      }
      const message = await ctx.db.threadMessage.findFirstOrThrow({
        where: { id: input.messageId, thread: { storeId: ctx.storeId }, deletedAt: null },
        select: { id: true },
      });
      const existing = await ctx.db.threadMessageReaction.findUnique({
        where: { messageId_userId_type: { messageId: message.id, userId: ctx.user.id, type: input.type } },
      });
      if (existing) {
        await ctx.db.threadMessageReaction.delete({ where: { id: existing.id } });
        return { active: false };
      }
      await ctx.db.threadMessageReaction.create({
        data: { messageId: message.id, userId: ctx.user.id, type: input.type },
      });
      return { active: true };
    }),

  editMessage: protectedProcedure
    .input(z.object({ messageId: z.string(), body: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.threadMessage.findFirstOrThrow({
        where: { id: input.messageId, thread: { storeId: ctx.storeId } },
        select: { id: true, threadId: true, authorId: true, deletedAt: true },
      });
      if (!canEditThreadMessage({ id: ctx.user.id, role: ctx.user.role as Role }, message)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit your own messages' });
      }
      const updated = await ctx.db.threadMessage.update({
        where: { id: message.id },
        data: { body: input.body, editedAt: new Date() },
        include: messageInclude,
      });
      await logThreadEvent(ctx.db, {
        threadId: message.threadId,
        messageId: message.id,
        actorId: ctx.user.id,
        action: ThreadModerationAction.MESSAGE_EDITED,
      });
      return updated;
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.threadMessage.findFirstOrThrow({
        where: { id: input.messageId, thread: { storeId: ctx.storeId } },
        select: { id: true, threadId: true, authorId: true, deletedAt: true },
      });
      if (!canDeleteThreadMessage({ id: ctx.user.id, role: ctx.user.role as Role }, message)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You cannot delete this message' });
      }
      const deleted = await ctx.db.threadMessage.update({
        where: { id: message.id },
        data: { deletedAt: new Date(), deletedById: ctx.user.id },
        include: messageInclude,
      });
      await logThreadEvent(ctx.db, {
        threadId: message.threadId,
        messageId: message.id,
        actorId: ctx.user.id,
        action: ThreadModerationAction.MESSAGE_DELETED,
      });
      return deleted;
    }),

  toggleMessagePin: supervisorProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.threadMessage.findFirstOrThrow({
        where: { id: input.messageId, thread: { storeId: ctx.storeId }, deletedAt: null },
        select: { id: true, threadId: true, isPinned: true },
      });
      const updated = await ctx.db.threadMessage.update({
        where: { id: message.id },
        data: { isPinned: !message.isPinned },
        include: messageInclude,
      });
      await logThreadEvent(ctx.db, {
        threadId: message.threadId,
        messageId: message.id,
        actorId: ctx.user.id,
        action: message.isPinned ? ThreadModerationAction.MESSAGE_UNPINNED : ThreadModerationAction.MESSAGE_PINNED,
      });
      return updated;
    }),

  addLink: supervisorProcedure
    .input(z.object({ threadId: z.string(), messageId: z.string().optional() }).merge(linkInput))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.thread.findFirstOrThrow({ where: { id: input.threadId, storeId: ctx.storeId }, select: { id: true } });
      if (input.messageId) {
        await ctx.db.threadMessage.findFirstOrThrow({
          where: { id: input.messageId, threadId: input.threadId, thread: { storeId: ctx.storeId } },
          select: { id: true },
        });
      }
      const source = await assertSourceInStore(ctx.db, ctx.storeId, input.type, input.entityId);
      return ctx.db.threadLink.create({
        data: {
          threadId: input.threadId,
          messageId: input.messageId,
          type: input.type,
          entityId: input.entityId,
          label: sourceLabel(input.type, source, input.label),
        },
      });
    }),

  taskEscalationPreview: supervisorProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const message = await ctx.db.threadMessage.findFirstOrThrow({
        where: { id: input.messageId, thread: { storeId: ctx.storeId }, deletedAt: null },
        include: {
          thread: true,
          author: { select: { id: true, fullName: true } },
          links: true,
        },
      });
      const existingLinks = await ctx.db.threadLink.findMany({
        where: { messageId: message.id, type: TaskLinkType.TASK },
        orderBy: { createdAt: 'desc' },
      });
      const tasks = existingLinks.length
        ? await ctx.db.task.findMany({
          where: { id: { in: existingLinks.map((link: { entityId: string }) => link.entityId) }, storeId: ctx.storeId },
          select: { id: true, title: true, status: true, assignedTo: { select: { id: true, fullName: true } } },
        })
        : [];
      return {
        messageId: message.id,
        suggestedTitle: `Follow up: ${message.thread.title}`,
        suggestedAssigneeId: message.authorId,
        suggestedPriority: message.thread.category === ThreadCategory.URGENT ? Priority.HIGH : Priority.NORMAL,
        suggestedCategory: message.thread.category === ThreadCategory.INVENTORY ? 'Inventory' : message.thread.category === ThreadCategory.MAINTENANCE ? 'Maintenance' : undefined,
        quote: message.body.slice(0, 500),
        existingTasks: tasks,
      };
    }),

  createTaskFromMessage: supervisorProcedure
    .input(z.object({
      messageId: z.string(),
      title: z.string().min(1).max(200).optional(),
      assignedToId: z.string().optional(),
      priority: z.nativeEnum(Priority).optional(),
      dueDate: z.coerce.date().optional(),
      category: z.string().max(80).optional(),
      quote: z.string().max(600).optional(),
      preventDuplicate: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.threadMessage.findFirstOrThrow({
        where: { id: input.messageId, thread: { storeId: ctx.storeId }, deletedAt: null },
        include: { thread: true, author: { select: { fullName: true } } },
      });
      if (input.assignedToId) {
        await ctx.db.user.findFirstOrThrow({ where: { id: input.assignedToId, storeId: ctx.storeId, isActive: true } });
      }
      if (input.preventDuplicate) {
        const existing = await ctx.db.threadLink.findFirst({
          where: { messageId: message.id, type: TaskLinkType.TASK },
          select: { label: true },
        });
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: `A task already exists: ${existing.label || 'linked task'}` });
        }
      }
      const title = input.title?.trim() || `Follow up: ${message.thread.title}`;
      const quote = input.quote?.trim() || message.body.slice(0, 500);
      const task = await ctx.db.$transaction(async (tx: any) => {
        const created = await tx.task.create({
          data: {
            storeId: ctx.storeId,
            createdById: ctx.user.id,
            assignedToId: input.assignedToId,
            title,
            description: `Source message from ${message.author.fullName}:\n"${quote}"`,
            category: input.category,
            priority: input.priority ?? Priority.NORMAL,
            status: TaskStatus.OPEN,
            dueDate: input.dueDate,
            links: {
              create: {
                type: TaskLinkType.THREAD,
                entityId: message.threadId,
                label: message.thread.title,
              },
            },
          },
        });
        await tx.taskUpdate.create({
          data: {
            taskId: created.id,
            authorId: ctx.user.id,
            type: TaskUpdateType.CREATED,
            body: `Created from thread: ${message.thread.title}`,
            toStatus: created.status,
          },
        });
        await tx.threadLink.create({
          data: {
            threadId: message.threadId,
            messageId: message.id,
            type: TaskLinkType.TASK,
            entityId: created.id,
            label: title,
          },
        });
        await logThreadEvent(tx, {
          threadId: message.threadId,
          messageId: message.id,
          actorId: ctx.user.id,
          action: ThreadModerationAction.TASK_CREATED,
          metadata: { taskId: created.id, title },
        });
        return created;
      });
      if (task.assignedToId) {
        try {
          await createNotification(ctx.db, task.assignedToId, 'TASK_ASSIGNED', `New task: ${task.title}`, `Created from a thread by ${ctx.user.name}`, `/hub/tasks/${task.id}`);
        } catch {}
      }
      return task;
    }),

  togglePin: supervisorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.db.thread.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });
      const updated = await ctx.db.thread.update({
        where: { id: input.id },
        data: { isPinned: !thread.isPinned },
      });
      await logThreadEvent(ctx.db, {
        threadId: input.id,
        actorId: ctx.user.id,
        action: thread.isPinned ? ThreadModerationAction.THREAD_UNPINNED : ThreadModerationAction.THREAD_PINNED,
      });
      return updated;
    }),

  resolve: supervisorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.thread.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: { isResolved: true, resolvedAt: new Date(), resolvedById: ctx.user.id },
      });
      await logThreadEvent(ctx.db, {
        threadId: input.id,
        actorId: ctx.user.id,
        action: ThreadModerationAction.THREAD_RESOLVED,
      });
      return updated;
    }),
});
