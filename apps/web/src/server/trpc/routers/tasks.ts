import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  Priority,
  TaskAttachmentType,
  TaskLinkType,
  TaskStatus,
  TaskUpdateType,
} from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';
import { router, protectedProcedure, supervisorProcedure, managerProcedure } from '../init';
import { createNotification, notifyByRole } from '../../notifications';
import {
  activeTaskStatuses,
  canUserAccessTask,
  isClosedTaskStatus,
} from './tasks-policy';
import { adminStoreIdWhere, adminStoreWhere, requireSingleAdminStore, resolveAdminScope } from './admin-scope';
import { logAdminAction } from './admin-audit';

const taskInclude = {
  store: { select: { id: true, name: true, parish: true } },
  createdBy: { select: { id: true, fullName: true, role: true } },
  assignedTo: { select: { id: true, fullName: true, role: true } },
  reviewedBy: { select: { id: true, fullName: true, role: true } },
  checklistItems: { orderBy: { sortOrder: 'asc' as const } },
  attachments: {
    include: { uploadedBy: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  links: true,
  updates: {
    include: { author: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
    take: 40,
  },
};

const taskListInclude = {
  store: { select: { id: true, name: true, parish: true } },
  createdBy: { select: { id: true, fullName: true, role: true } },
  assignedTo: { select: { id: true, fullName: true, role: true } },
  _count: { select: { updates: true, checklistItems: true, attachments: true } },
};

const checklistInput = z.object({
  label: z.string().min(1).max(160),
  isRequired: z.boolean().optional(),
});

const linkInput = z.object({
  type: z.nativeEnum(TaskLinkType),
  entityId: z.string().min(1).max(120),
  label: z.string().max(120).optional(),
});

function requireTaskAccess(ctx: any, task: { assignedToId: string | null; createdById: string }) {
  if (canUserAccessTask({ id: ctx.user.id, role: ctx.user.role as Role }, task)) return;
  throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only update your own tasks' });
}

function statusLabel(status: TaskStatus) {
  return status.replaceAll('_', ' ').toLowerCase();
}

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
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

async function addTaskUpdate(
  db: any,
  taskId: string,
  authorId: string,
  type: TaskUpdateType,
  body?: string | null,
  fromStatus?: TaskStatus | null,
  toStatus?: TaskStatus | null
) {
  return db.taskUpdate.create({
    data: {
      taskId,
      authorId,
      type,
      body: body?.trim() || null,
      fromStatus: fromStatus ?? null,
      toStatus: toStatus ?? null,
    },
  });
}

export const tasksRouter = router({
  assignableUsers: supervisorProcedure
    .input(z.object({ scope: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      return ctx.db.user.findMany({
        where: { storeId: adminStoreIdWhere(scope), isActive: true },
        select: { id: true, fullName: true, role: true, storeId: true, store: { select: { id: true, name: true } } },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      });
    }),

  list: protectedProcedure
    .input(z.object({
      view: z.enum(['MINE', 'AVAILABLE', 'HELP', 'DONE', 'ALL']).optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      statuses: z.array(z.nativeEnum(TaskStatus)).optional(),
      assignedToMe: z.boolean().optional(),
      unassigned: z.boolean().optional(),
      assignedToId: z.string().optional(),
      priority: z.nativeEnum(Priority).optional(),
      category: z.string().optional(),
      workArea: z.string().optional(),
      due: z.enum(['OVERDUE', 'TODAY', 'UPCOMING']).optional(),
      search: z.string().max(100).optional(),
      includeClosed: z.boolean().optional(),
      take: z.number().min(1).max(200).optional(),
      scope: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const where: any = adminStoreWhere(scope);
      const isManager = hasMinRole(ctx.user.role as Role, 'MANAGER');

      if (input?.view === 'MINE') {
        where.assignedToId = ctx.user.id;
        where.status = { in: activeTaskStatuses };
      } else if (input?.view === 'AVAILABLE') {
        where.assignedToId = null;
        where.status = TaskStatus.OPEN;
      } else if (input?.view === 'HELP') {
        where.status = TaskStatus.NEEDS_HELP;
      } else if (input?.view === 'DONE') {
        where.status = TaskStatus.DONE;
        if (ctx.user.role === 'STAFF') where.assignedToId = ctx.user.id;
      } else if (input?.view === 'ALL') {
        if (!isManager) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only managers can view all active tasks' });
        }
        where.status = { in: activeTaskStatuses };
      } else if (!input?.includeClosed && !input?.status && !input?.statuses) {
        where.status = { in: activeTaskStatuses };
      }

      if (input?.status) where.status = input.status;
      if (input?.statuses?.length) where.status = { in: input.statuses };
      if (input?.assignedToMe) where.assignedToId = ctx.user.id;
      if (input?.unassigned) where.assignedToId = null;
      if (input?.assignedToId) where.assignedToId = input.assignedToId;
      if (input?.priority) where.priority = input.priority;
      if (input?.category) where.category = input.category;
      if (input?.workArea) where.workArea = input.workArea;

      if (input?.search?.trim()) {
        const search = input.search.trim();
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { workArea: { contains: search, mode: 'insensitive' } },
          { assetLabel: { contains: search, mode: 'insensitive' } },
          { assignedTo: { fullName: { contains: search, mode: 'insensitive' } } },
          { createdBy: { fullName: { contains: search, mode: 'insensitive' } } },
        ];
      }

      if (input?.due) {
        const now = new Date();
        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);
        const endToday = new Date(startToday);
        endToday.setDate(endToday.getDate() + 1);
        if (input.due === 'OVERDUE') where.dueDate = { lt: now };
        if (input.due === 'TODAY') where.dueDate = { gte: startToday, lt: endToday };
        if (input.due === 'UPCOMING') where.dueDate = { gte: endToday };
        where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
      }

      return ctx.db.task.findMany({
        where,
        include: taskListInclude,
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        take: input?.take ?? 80,
      });
    }),

  counts: protectedProcedure.query(async ({ ctx }) => {
    const doneWhere: any = { storeId: ctx.storeId, status: TaskStatus.DONE };
    if (ctx.user.role === 'STAFF') doneWhere.assignedToId = ctx.user.id;

    const [mine, allActive, available, help, done] = await ctx.db.$transaction([
      ctx.db.task.count({ where: { storeId: ctx.storeId, assignedToId: ctx.user.id, status: { in: activeTaskStatuses } } }),
      ctx.db.task.count({ where: { storeId: ctx.storeId, status: { in: activeTaskStatuses } } }),
      ctx.db.task.count({ where: { storeId: ctx.storeId, assignedToId: null, status: TaskStatus.OPEN } }),
      ctx.db.task.count({ where: { storeId: ctx.storeId, status: TaskStatus.NEEDS_HELP } }),
      ctx.db.task.count({ where: doneWhere }),
    ]);

    return { mine, allActive, available, help, done };
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: taskInclude,
      });
    }),

  create: supervisorProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      category: z.string().max(50).optional(),
      workArea: z.string().max(80).optional(),
      assetLabel: z.string().max(80).optional(),
      assignedToId: z.string().optional(),
      priority: z.nativeEnum(Priority).optional(),
      startDate: z.date().optional(),
      dueDate: z.date().optional(),
      dueReminderAt: z.date().optional(),
      reviewRequired: z.boolean().optional(),
      requireCompletionNote: z.boolean().optional(),
      requireCompletionPhoto: z.boolean().optional(),
      checklistItems: z.array(checklistInput).max(30).optional(),
      links: z.array(linkInput).max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.assignedToId) {
        await ctx.db.user.findFirstOrThrow({ where: { id: input.assignedToId, storeId: ctx.storeId } });
      }

      const { checklistItems, links, ...data } = input;
      if (links?.length) {
        await Promise.all(links.map((link) => assertSourceInStore(ctx.db, ctx.storeId, link.type, link.entityId)));
      }
      const result = await ctx.db.$transaction(async (tx: any) => {
        const task = await tx.task.create({
          data: {
            ...data,
            storeId: ctx.storeId,
            createdById: ctx.user.id,
            checklistItems: checklistItems?.length
              ? { create: checklistItems.map((item, index) => ({ ...item, sortOrder: index })) }
              : undefined,
            links: links?.length ? { create: links } : undefined,
          },
          include: taskInclude,
        });
        await addTaskUpdate(tx, task.id, ctx.user.id, TaskUpdateType.CREATED, 'Task created', null, task.status);
        if (task.assignedToId) {
          await addTaskUpdate(tx, task.id, ctx.user.id, TaskUpdateType.REASSIGNED, `Assigned to ${task.assignedTo?.fullName ?? 'staff'}`);
        }
        return task;
      });

      if (result.assignedToId) {
        try {
          await createNotification(ctx.db, result.assignedToId, 'TASK_ASSIGNED', `New task: ${result.title}`, `Assigned by ${ctx.user.name}`, `/hub/tasks/${result.id}`);
        } catch {}
      }

      return result;
    }),

  updateDetails: supervisorProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
      category: z.string().max(50).nullable().optional(),
      workArea: z.string().max(80).nullable().optional(),
      assetLabel: z.string().max(80).nullable().optional(),
      priority: z.nativeEnum(Priority).optional(),
      startDate: z.date().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      dueReminderAt: z.date().nullable().optional(),
      reviewRequired: z.boolean().optional(),
      requireCompletionNote: z.boolean().optional(),
      requireCompletionPhoto: z.boolean().optional(),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, scope: requestedScope, ...data } = input;
      const scope = await resolveAdminScope(ctx as any, requestedScope);
      const existing = await ctx.db.task.findFirstOrThrow({ where: { id, ...adminStoreWhere(scope) } });
      const task = await ctx.db.task.update({ where: { id }, data, include: taskInclude });
      await addTaskUpdate(ctx.db, id, ctx.user.id, TaskUpdateType.NOTE, 'Task details updated');
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'TASK_DETAILS_UPDATED',
        storeId: existing.storeId,
        sourceType: 'TASK',
        sourceId: id,
        note: task.title,
      });
      return task;
    }),

  pickup: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.task.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId, assignedToId: null, status: TaskStatus.OPEN },
      });
      const task = await ctx.db.task.update({
        where: { id: input.id },
        data: { assignedToId: ctx.user.id, status: TaskStatus.IN_PROGRESS },
        include: taskInclude,
      });
      await addTaskUpdate(ctx.db, task.id, ctx.user.id, TaskUpdateType.REASSIGNED, `${ctx.user.name} picked up this task`, existing.status, TaskStatus.IN_PROGRESS);
      return task;
    }),

  reassign: supervisorProcedure
    .input(z.object({ id: z.string(), assignedToId: z.string().nullable(), scope: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const existing = await ctx.db.task.findFirstOrThrow({
        where: { id: input.id, ...adminStoreWhere(scope) },
        include: { assignedTo: { select: { fullName: true } } },
      });
      if (existing.assignedToId === input.assignedToId) {
        return ctx.db.task.findFirstOrThrow({ where: { id: input.id, ...adminStoreWhere(scope) }, include: taskInclude });
      }
      let assignedName = 'Unassigned';
      if (input.assignedToId) {
        const user = await ctx.db.user.findFirstOrThrow({ where: { id: input.assignedToId, storeId: existing.storeId, isActive: true } });
        assignedName = user.fullName;
      }
      const task = await ctx.db.task.update({
        where: { id: input.id },
        data: { assignedToId: input.assignedToId, status: input.assignedToId ? existing.status : TaskStatus.OPEN },
        include: taskInclude,
      });
      await addTaskUpdate(ctx.db, task.id, ctx.user.id, TaskUpdateType.REASSIGNED, `Reassigned from ${existing.assignedTo?.fullName ?? 'Unassigned'} to ${assignedName}`);
      if (input.assignedToId) {
        try {
          await createNotification(ctx.db, input.assignedToId, 'TASK_ASSIGNED', `Task assigned: ${task.title}`, `Assigned by ${ctx.user.name}`, `/hub/tasks/${task.id}`);
        } catch {}
      }
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'TASK_REASSIGNED',
        storeId: existing.storeId,
        sourceType: 'TASK',
        sourceId: input.id,
        note: `Reassigned to ${assignedName}`,
        metadata: { assignedToId: input.assignedToId },
      });
      return task;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string(), status: z.nativeEnum(TaskStatus), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      requireTaskAccess(ctx, task);

      if (input.status === TaskStatus.CANCELLED && !hasMinRole(ctx.user.role as Role, 'SUPERVISOR')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only supervisors can cancel tasks' });
      }
      if (isClosedTaskStatus(task.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This task is already closed' });
      }
      if (input.status === TaskStatus.DONE || input.status === TaskStatus.IN_REVIEW) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use the finish button so checklist and review rules are checked' });
      }
      if (input.status === TaskStatus.NEEDS_HELP) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use the Need Help button so supervisors get notified' });
      }
      if (input.status === TaskStatus.OPEN) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use reassignment to reopen or unassign this task' });
      }
      if (input.status === TaskStatus.IN_PROGRESS) {
        if (task.status !== TaskStatus.OPEN) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only open tasks can be started here' });
        }
        if (!task.assignedToId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pick up or assign this task before starting it' });
        }
      }

      const data: any = { status: input.status };
      if (input.status === TaskStatus.CANCELLED) data.cancelledAt = new Date();
      if (input.status === TaskStatus.IN_PROGRESS) data.helpResolvedAt = task.helpResolvedAt;

      const updated = await ctx.db.task.update({ where: { id: input.id }, data, include: taskInclude });
      await addTaskUpdate(ctx.db, input.id, ctx.user.id, input.status === TaskStatus.CANCELLED ? TaskUpdateType.CANCELLED : TaskUpdateType.STATUS_CHANGED, input.note, task.status, input.status);
      return updated;
    }),

  addUpdate: protectedProcedure
    .input(z.object({ id: z.string(), body: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      requireTaskAccess(ctx, task);
      return addTaskUpdate(ctx.db, input.id, ctx.user.id, TaskUpdateType.NOTE, input.body);
    }),

  requestHelp: protectedProcedure
    .input(z.object({ id: z.string(), body: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      requireTaskAccess(ctx, task);
      if (isClosedTaskStatus(task.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Completed tasks cannot request help' });
      }
      const updated = await ctx.db.task.update({
        where: { id: input.id },
        data: { status: TaskStatus.NEEDS_HELP, helpRequestedAt: new Date(), helpResolvedAt: null },
        include: taskInclude,
      });
      await addTaskUpdate(ctx.db, input.id, ctx.user.id, TaskUpdateType.HELP_REQUESTED, input.body, task.status, TaskStatus.NEEDS_HELP);
      try {
        await notifyByRole(ctx.db, ctx.storeId, ['SUPERVISOR', 'MANAGER', 'OWNER'], 'TASK_UPDATED', `Help needed: ${task.title}`, input.body.slice(0, 100), `/hub/tasks/${task.id}`);
      } catch {}
      return updated;
    }),

  resolveHelp: supervisorProcedure
    .input(z.object({ id: z.string(), body: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      if (task.status !== TaskStatus.NEEDS_HELP) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only tasks asking for help can be marked helped' });
      }
      const updated = await ctx.db.task.update({
        where: { id: input.id },
        data: { status: TaskStatus.IN_PROGRESS, helpResolvedAt: new Date() },
        include: taskInclude,
      });
      await addTaskUpdate(ctx.db, input.id, ctx.user.id, TaskUpdateType.HELP_RESOLVED, input.body, task.status, TaskStatus.IN_PROGRESS);
      if (task.assignedToId) {
        try {
          await createNotification(ctx.db, task.assignedToId, 'TASK_UPDATED', `Help answered: ${task.title}`, input.body || 'A supervisor responded', `/hub/tasks/${task.id}`);
        } catch {}
      }
      return updated;
    }),

  complete: protectedProcedure
    .input(z.object({
      id: z.string(),
      note: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: { checklistItems: true, attachments: true },
      });
      requireTaskAccess(ctx, task);
      if (isClosedTaskStatus(task.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This task is already closed' });
      }
      if (task.status !== TaskStatus.IN_PROGRESS && task.status !== TaskStatus.NEEDS_HELP) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Start this task before finishing it' });
      }
      if (task.requireCompletionNote && !input.note?.trim()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Add a note before finishing this task' });
      }
      const hasPhoto = task.attachments.some((a: any) => a.type === TaskAttachmentType.IMAGE);
      if (task.requireCompletionPhoto && !hasPhoto) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A supervisor needs to add photo proof before this can be finished' });
      }
      const missingRequired = task.checklistItems.some((item: any) => item.isRequired && !item.isDone);
      if (missingRequired) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Finish the checklist before marking done' });
      }

      const nextStatus = task.reviewRequired ? TaskStatus.IN_REVIEW : TaskStatus.DONE;
      const updated = await ctx.db.$transaction(async (tx: any) => {
        const result = await tx.task.update({
          where: { id: input.id },
          data: {
            status: nextStatus,
            completionNote: input.note?.trim() || null,
            submittedForReviewAt: task.reviewRequired ? new Date() : null,
            completedAt: task.reviewRequired ? null : new Date(),
          },
          include: taskInclude,
        });
        await addTaskUpdate(
          tx,
          input.id,
          ctx.user.id,
          task.reviewRequired ? TaskUpdateType.SUBMITTED_REVIEW : TaskUpdateType.COMPLETION,
          input.note,
          task.status,
          nextStatus
        );
        return result;
      });

      try {
        if (task.reviewRequired) {
          await notifyByRole(ctx.db, ctx.storeId, ['SUPERVISOR', 'MANAGER', 'OWNER'], 'TASK_UPDATED', `Review needed: ${task.title}`, input.note?.slice(0, 100), `/hub/tasks/${task.id}`);
        }
      } catch {}
      return updated;
    }),

  approve: supervisorProcedure
    .input(z.object({ id: z.string(), body: z.string().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      if (task.status !== TaskStatus.IN_REVIEW) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only tasks waiting for review can be approved' });
      }
      const updated = await ctx.db.task.update({
        where: { id: input.id },
        data: { status: TaskStatus.DONE, reviewedAt: new Date(), reviewedById: ctx.user.id, completedAt: new Date() },
        include: taskInclude,
      });
      await addTaskUpdate(ctx.db, input.id, ctx.user.id, TaskUpdateType.APPROVED, input.body, task.status, TaskStatus.DONE);
      if (task.assignedToId) {
        try {
          await createNotification(ctx.db, task.assignedToId, 'TASK_UPDATED', `Task approved: ${task.title}`, input.body || 'Good work', `/hub/tasks/${task.id}`);
        } catch {}
      }
      return updated;
    }),

  sendBack: supervisorProcedure
    .input(z.object({ id: z.string(), body: z.string().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      if (task.status !== TaskStatus.IN_REVIEW) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only tasks waiting for review can be sent back' });
      }
      const updated = await ctx.db.task.update({
        where: { id: input.id },
        data: { status: TaskStatus.IN_PROGRESS, submittedForReviewAt: null },
        include: taskInclude,
      });
      await addTaskUpdate(ctx.db, input.id, ctx.user.id, TaskUpdateType.SENT_BACK, input.body, task.status, TaskStatus.IN_PROGRESS);
      if (task.assignedToId) {
        try {
          await createNotification(ctx.db, task.assignedToId, 'TASK_UPDATED', `Task sent back: ${task.title}`, input.body.slice(0, 100), `/hub/tasks/${task.id}`);
        } catch {}
      }
      return updated;
    }),

  toggleChecklistItem: protectedProcedure
    .input(z.object({ id: z.string(), isDone: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.taskChecklistItem.findFirstOrThrow({
        where: { id: input.id, task: { storeId: ctx.storeId } },
        include: { task: true },
      });
      requireTaskAccess(ctx, item.task);
      const updated = await ctx.db.taskChecklistItem.update({
        where: { id: input.id },
        data: {
          isDone: input.isDone,
          completedAt: input.isDone ? new Date() : null,
          completedById: input.isDone ? ctx.user.id : null,
        },
      });
      await addTaskUpdate(ctx.db, item.taskId, ctx.user.id, TaskUpdateType.CHECKLIST_UPDATED, `${input.isDone ? 'Checked' : 'Unchecked'}: ${item.label}`);
      return updated;
    }),

  addAttachment: supervisorProcedure
    .input(z.object({
      id: z.string(),
      type: z.nativeEnum(TaskAttachmentType),
      url: z.string().url(),
      label: z.string().max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      if (isClosedTaskStatus(task.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Closed tasks cannot receive new photo proof' });
      }
      const attachment = await ctx.db.taskAttachment.create({
        data: {
          taskId: input.id,
          uploadedById: ctx.user.id,
          type: input.type,
          url: input.url,
          label: input.label,
        },
      });
      await addTaskUpdate(ctx.db, input.id, ctx.user.id, TaskUpdateType.ATTACHMENT_ADDED, input.label || input.url);
      return attachment;
    }),

  addLink: supervisorProcedure
    .input(z.object({ id: z.string() }).merge(linkInput))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.task.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      await assertSourceInStore(ctx.db, ctx.storeId, input.type, input.entityId);
      return ctx.db.taskLink.create({
        data: { taskId: input.id, type: input.type, entityId: input.entityId, label: input.label },
      });
    }),

  createFromSource: supervisorProcedure
    .input(z.object({
      sourceType: z.nativeEnum(TaskLinkType),
      sourceId: z.string(),
      sourceLabel: z.string().max(120).optional(),
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      category: z.string().max(50).optional(),
      workArea: z.string().max(80).optional(),
      assetLabel: z.string().max(80).optional(),
      assignedToId: z.string().optional(),
      priority: z.nativeEnum(Priority).optional(),
      dueDate: z.date().optional(),
      reviewRequired: z.boolean().optional(),
      checklistItems: z.array(checklistInput).max(30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const source = await assertSourceInStore(ctx.db, ctx.storeId, input.sourceType, input.sourceId);
      if (input.sourceType === TaskLinkType.LOGBOOK) {
        const existing = await ctx.db.task.findFirst({
          where: {
            storeId: ctx.storeId,
            status: { in: activeTaskStatuses },
            links: { some: { type: TaskLinkType.LOGBOOK, entityId: input.sourceId } },
          },
          select: { id: true, title: true },
        });
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: `A follow-up task already exists: ${existing.title}` });
        }
      }
      if (input.assignedToId) {
        await ctx.db.user.findFirstOrThrow({ where: { id: input.assignedToId, storeId: ctx.storeId } });
      }
      const task = await ctx.db.task.create({
        data: {
          storeId: ctx.storeId,
          createdById: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          workArea: input.workArea,
          assetLabel: input.assetLabel,
          assignedToId: input.assignedToId,
          priority: input.priority,
          dueDate: input.dueDate,
          reviewRequired: input.reviewRequired,
          checklistItems: input.checklistItems?.length
            ? { create: input.checklistItems.map((item, index) => ({ ...item, sortOrder: index })) }
            : undefined,
          links: {
            create: [{
              type: input.sourceType,
              entityId: input.sourceId,
              label: sourceLabel(input.sourceType, source, input.sourceLabel),
            }],
          },
        },
        include: taskInclude,
      });
      if (input.sourceType === TaskLinkType.LOGBOOK) {
        try {
          await ctx.db.logEntryLink.upsert({
            where: { logEntryId_type_entityId: { logEntryId: input.sourceId, type: TaskLinkType.TASK, entityId: task.id } },
            create: {
              logEntryId: input.sourceId,
              type: TaskLinkType.TASK,
              entityId: task.id,
              label: task.title,
            },
            update: { label: task.title },
          });
        } catch {}
      }
      await addTaskUpdate(ctx.db, task.id, ctx.user.id, TaskUpdateType.CREATED, `Created from ${sourceLabel(input.sourceType, source, input.sourceLabel)}`, null, task.status);
      if (task.assignedToId) {
        try {
          await createNotification(ctx.db, task.assignedToId, 'TASK_ASSIGNED', `New task: ${task.title}`, `Assigned by ${ctx.user.name}`, `/hub/tasks/${task.id}`);
        } catch {}
      }
      return task;
    }),

  removeLink: supervisorProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.taskLink.findFirstOrThrow({
        where: { id: input.id, task: { storeId: ctx.storeId } },
        select: { id: true },
      });
      return ctx.db.taskLink.delete({ where: { id: link.id } });
    }),

  bulkCreate: managerProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      category: z.string().max(50).optional(),
      workArea: z.string().max(80).optional(),
      assetLabel: z.string().max(80).optional(),
      assignedToIds: z.array(z.string()).min(1).max(50),
      priority: z.nativeEnum(Priority).optional(),
      dueDate: z.date().optional(),
      reviewRequired: z.boolean().optional(),
      checklistItems: z.array(checklistInput).max(30).optional(),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const storeId = requireSingleAdminStore(scope);
      const users = await ctx.db.user.findMany({
        where: { id: { in: input.assignedToIds }, storeId, isActive: true },
        select: { id: true },
      });
      if (users.length !== input.assignedToIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more assignees are not valid for this store' });
      }
      const tasks = await ctx.db.$transaction(input.assignedToIds.map((assignedToId) =>
        ctx.db.task.create({
          data: {
            title: input.title,
            description: input.description,
            category: input.category,
            workArea: input.workArea,
            assetLabel: input.assetLabel,
            assignedToId,
            priority: input.priority,
            dueDate: input.dueDate,
            reviewRequired: input.reviewRequired,
            storeId,
            createdById: ctx.user.id,
            checklistItems: input.checklistItems?.length
              ? { create: input.checklistItems.map((item, index) => ({ ...item, sortOrder: index })) }
              : undefined,
          },
        })
      ));
      await Promise.all(tasks.map((task: any) =>
        addTaskUpdate(ctx.db, task.id, ctx.user.id, TaskUpdateType.CREATED, 'Bulk task created', null, task.status)
      ));
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'TASKS_BULK_CREATED',
        storeId,
        sourceType: 'TASK',
        note: `Created ${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
        metadata: { count: tasks.length, taskIds: tasks.map((task: any) => task.id) },
      });
      return { count: tasks.length };
    }),

  bulkReassign: managerProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(100), assignedToId: z.string().nullable(), scope: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      let assigneeStoreId: string | null = null;
      if (input.assignedToId) {
        const user = await ctx.db.user.findFirstOrThrow({ where: { id: input.assignedToId, storeId: adminStoreIdWhere(scope), isActive: true } });
        assigneeStoreId = user.storeId;
      }
      const tasks = await ctx.db.task.findMany({
        where: { id: { in: input.ids }, ...adminStoreWhere(scope) },
        select: { id: true, storeId: true },
      });
      if (tasks.length !== input.ids.length) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'One or more tasks are outside your admin scope' });
      }
      if (assigneeStoreId && tasks.some((task: { storeId: string }) => task.storeId !== assigneeStoreId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selected tasks must belong to the assignee store' });
      }
      const taskIds = tasks.map((task: { id: string }) => task.id);
      const result = await ctx.db.task.updateMany({
        where: { id: { in: taskIds }, ...adminStoreWhere(scope) },
        data: { assignedToId: input.assignedToId },
      });
      await Promise.all(taskIds.map((id: string) => addTaskUpdate(ctx.db, id, ctx.user.id, TaskUpdateType.REASSIGNED, 'Bulk reassigned')));
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'TASKS_BULK_REASSIGNED',
        storeId: assigneeStoreId ?? (scope.isAllStores ? null : scope.storeIds[0]),
        sourceType: 'TASK',
        note: `Reassigned ${taskIds.length} task${taskIds.length === 1 ? '' : 's'}`,
        metadata: { count: taskIds.length, taskIds, assignedToId: input.assignedToId },
      });
      return result;
    }),

  bulkUpdate: managerProcedure
    .input(z.object({
      ids: z.array(z.string()).min(1).max(100),
      assignedToId: z.string().nullable().optional(),
      dueDate: z.date().nullable().optional(),
      priority: z.nativeEnum(Priority).optional(),
      status: z.nativeEnum(TaskStatus).optional(),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      let assigneeStoreId: string | null = null;
      if (input.assignedToId) {
        const user = await ctx.db.user.findFirstOrThrow({ where: { id: input.assignedToId, storeId: adminStoreIdWhere(scope), isActive: true } });
        assigneeStoreId = user.storeId;
      }
      const tasks = await ctx.db.task.findMany({
        where: { id: { in: input.ids }, ...adminStoreWhere(scope) },
        select: { id: true, status: true, storeId: true },
      });
      if (tasks.length !== input.ids.length) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'One or more tasks are outside your admin scope' });
      }
      if (assigneeStoreId && tasks.some((task: { storeId: string }) => task.storeId !== assigneeStoreId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selected tasks must belong to the assignee store' });
      }
      const taskIds = tasks.map((task: { id: string }) => task.id);
      const data: any = {};
      if ('assignedToId' in input) data.assignedToId = input.assignedToId;
      if ('dueDate' in input) data.dueDate = input.dueDate;
      if (input.priority) data.priority = input.priority;
      if (input.status) {
        if (input.status === TaskStatus.DONE || input.status === TaskStatus.IN_REVIEW) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use the task finish and review flows to close work' });
        }
        data.status = input.status;
        if (input.status === TaskStatus.CANCELLED) data.cancelledAt = new Date();
      }
      const result = await ctx.db.task.updateMany({
        where: { id: { in: taskIds }, ...adminStoreWhere(scope) },
        data,
      });
      await Promise.all(tasks.map((task: { id: string; status: TaskStatus }) =>
        addTaskUpdate(
          ctx.db,
          task.id,
          ctx.user.id,
          input.status === TaskStatus.CANCELLED ? TaskUpdateType.CANCELLED : TaskUpdateType.STATUS_CHANGED,
          'Bulk updated',
          task.status,
          input.status ?? task.status
        )
      ));
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'TASKS_BULK_UPDATED',
        storeId: assigneeStoreId ?? (scope.isAllStores ? null : scope.storeIds[0]),
        sourceType: 'TASK',
        note: `Updated ${taskIds.length} task${taskIds.length === 1 ? '' : 's'}`,
        metadata: { count: taskIds.length, taskIds, fields: Object.keys(data) },
      });
      return result;
    }),

  exportCsv: managerProcedure
    .input(z.object({
      status: z.nativeEnum(TaskStatus).optional(),
      due: z.enum(['OVERDUE', 'TODAY', 'UPCOMING']).optional(),
      search: z.string().max(100).optional(),
      scope: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const where: any = {
        ...adminStoreWhere(scope),
        ...(input?.status ? { status: input.status } : {}),
        ...(input?.search ? {
          OR: [
            { title: { contains: input.search, mode: 'insensitive' } },
            { category: { contains: input.search, mode: 'insensitive' } },
            { workArea: { contains: input.search, mode: 'insensitive' } },
            { assignedTo: { fullName: { contains: input.search, mode: 'insensitive' } } },
            { createdBy: { fullName: { contains: input.search, mode: 'insensitive' } } },
          ],
        } : {}),
      };
      if (input?.due) {
        const now = new Date();
        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);
        const endToday = new Date(startToday);
        endToday.setDate(endToday.getDate() + 1);
        if (input.due === 'OVERDUE') where.dueDate = { lt: now };
        if (input.due === 'TODAY') where.dueDate = { gte: startToday, lt: endToday };
        if (input.due === 'UPCOMING') where.dueDate = { gte: endToday };
      }
      const tasks = await ctx.db.task.findMany({
        where,
        include: { assignedTo: true, createdBy: true, store: { select: { name: true } } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 1000,
      });
      const header = ['Store', 'Title', 'Status', 'Priority', 'Category', 'Work Area', 'Asset', 'Assigned To', 'Created By', 'Due Date', 'Completed At'];
      const rows = tasks.map((task: any) => [
        task.store.name,
        task.title,
        statusLabel(task.status),
        task.priority,
        task.category,
        task.workArea,
        task.assetLabel,
        task.assignedTo?.fullName,
        task.createdBy.fullName,
        task.dueDate?.toISOString(),
        task.completedAt?.toISOString(),
      ]);
      return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    }),

  sendDueReminders: managerProcedure
    .input(z.object({ scope: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
    const now = new Date();
    const reminderCutoff = new Date(now);
    reminderCutoff.setHours(reminderCutoff.getHours() - 12);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scope = await resolveAdminScope(ctx as any, input?.scope);
    const due = await ctx.db.task.findMany({
      where: {
        ...adminStoreWhere(scope),
        status: { in: activeTaskStatuses },
        assignedToId: { not: null },
        dueDate: { lte: tomorrow },
        OR: [{ dueReminderAt: null }, { dueReminderAt: { lte: reminderCutoff } }],
      },
      select: { id: true, title: true, assignedToId: true, dueDate: true, storeId: true },
      take: 100,
    });
    await Promise.all(due.map((task: any) =>
      createNotification(
        ctx.db,
        task.assignedToId,
        'TASK_UPDATED',
        task.dueDate && task.dueDate < new Date() ? `Overdue task: ${task.title}` : `Task due soon: ${task.title}`,
        'Open Tasks to update it',
        `/hub/tasks/${task.id}`
      )
    ));
    if (due.length) {
      await ctx.db.task.updateMany({
        where: { id: { in: due.map((task: any) => task.id) }, ...adminStoreWhere(scope) },
        data: { dueReminderAt: now },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'DUE_REMINDERS_SENT',
        storeId: scope.isAllStores ? null : scope.storeIds[0],
        sourceType: 'TASK',
        note: `Sent ${due.length} due reminder${due.length === 1 ? '' : 's'}`,
        metadata: { count: due.length, taskIds: due.map((task: any) => task.id) },
      });
    }
    return { count: due.length };
  }),

  listTemplates: supervisorProcedure
    .input(z.object({ scope: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      return ctx.db.taskTemplate.findMany({
        where: { storeId: adminStoreIdWhere(scope), isActive: true },
        include: { store: { select: { id: true, name: true } }, items: { orderBy: { sortOrder: 'asc' } }, createdBy: { select: { id: true, fullName: true } } },
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
      });
    }),

  createTemplate: managerProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      category: z.string().max(50).optional(),
      defaultWorkArea: z.string().max(80).optional(),
      defaultAssetLabel: z.string().max(80).optional(),
      priority: z.nativeEnum(Priority).optional(),
      reviewRequired: z.boolean().optional(),
      requireCompletionNote: z.boolean().optional(),
      requireCompletionPhoto: z.boolean().optional(),
      recurrenceRule: z.string().max(120).optional(),
      checklistItems: z.array(checklistInput).max(30).optional(),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { checklistItems, scope: requestedScope, ...data } = input;
      const scope = await resolveAdminScope(ctx as any, requestedScope);
      const storeId = requireSingleAdminStore(scope);
      const template = await ctx.db.taskTemplate.create({
        data: {
          ...data,
          storeId,
          createdById: ctx.user.id,
          items: checklistItems?.length
            ? { create: checklistItems.map((item, index) => ({ ...item, sortOrder: index })) }
            : undefined,
        },
        include: { items: true },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'TASK_TEMPLATE_CREATED',
        storeId,
        sourceType: 'TASK_TEMPLATE',
        sourceId: template.id,
        note: template.title,
      });
      return template;
    }),

  updateTemplate: managerProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
      category: z.string().max(50).nullable().optional(),
      defaultWorkArea: z.string().max(80).nullable().optional(),
      defaultAssetLabel: z.string().max(80).nullable().optional(),
      priority: z.nativeEnum(Priority).optional(),
      reviewRequired: z.boolean().optional(),
      requireCompletionNote: z.boolean().optional(),
      requireCompletionPhoto: z.boolean().optional(),
      recurrenceRule: z.string().max(120).nullable().optional(),
      isActive: z.boolean().optional(),
      checklistItems: z.array(checklistInput).max(30).optional(),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, checklistItems, scope: requestedScope, ...data } = input;
      const scope = await resolveAdminScope(ctx as any, requestedScope);
      const existing = await ctx.db.taskTemplate.findFirstOrThrow({ where: { id, storeId: adminStoreIdWhere(scope) } });
      const template = await ctx.db.$transaction(async (tx: any) => {
        if (checklistItems) {
          await tx.taskTemplateItem.deleteMany({ where: { templateId: id, template: { storeId: existing.storeId } } });
        }
        return tx.taskTemplate.update({
          where: { id },
          data: {
            ...data,
            items: checklistItems
              ? { create: checklistItems.map((item, index) => ({ ...item, sortOrder: index })) }
              : undefined,
          },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: data.isActive === false ? 'TASK_TEMPLATE_ARCHIVED' : 'TASK_TEMPLATE_UPDATED',
        storeId: existing.storeId,
        sourceType: 'TASK_TEMPLATE',
        sourceId: id,
        note: template.title,
      });
      return template;
    }),

  createFromTemplate: supervisorProcedure
    .input(z.object({
      templateId: z.string(),
      assignedToId: z.string().optional(),
      dueDate: z.date().optional(),
      title: z.string().max(200).optional(),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const storeId = requireSingleAdminStore(scope);
      const template = await ctx.db.taskTemplate.findFirstOrThrow({
        where: { id: input.templateId, storeId, isActive: true },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
      if (input.assignedToId) {
        await ctx.db.user.findFirstOrThrow({ where: { id: input.assignedToId, storeId, isActive: true } });
      }
      const task = await ctx.db.task.create({
        data: {
          storeId,
          createdById: ctx.user.id,
          assignedToId: input.assignedToId,
          title: input.title || template.title,
          description: template.description,
          category: template.category,
          workArea: template.defaultWorkArea,
          assetLabel: template.defaultAssetLabel,
          priority: template.priority,
          dueDate: input.dueDate,
          reviewRequired: template.reviewRequired,
          requireCompletionNote: template.requireCompletionNote,
          requireCompletionPhoto: template.requireCompletionPhoto,
          checklistItems: template.items.length
            ? { create: template.items.map((item: any) => ({ label: item.label, sortOrder: item.sortOrder, isRequired: item.isRequired })) }
            : undefined,
        },
        include: taskInclude,
      });
      await addTaskUpdate(ctx.db, task.id, ctx.user.id, TaskUpdateType.CREATED, `Created from template: ${template.title}`, null, task.status);
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'TASK_CREATED_FROM_TEMPLATE',
        storeId,
        sourceType: 'TASK_TEMPLATE',
        sourceId: template.id,
        note: task.title,
        metadata: { taskId: task.id },
      });
      return task;
    }),
});
