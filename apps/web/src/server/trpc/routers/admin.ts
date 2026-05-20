import { z } from 'zod';
import {
  ExpiryStatus,
  IncidentStatus,
  ChecklistItemStatus,
  POStatus,
  Priority,
  StockOutStatus,
  SuggestionStatus,
  TaskLinkType,
  TaskStatus,
  TaskUpdateType,
} from '@superplus/db';
import { TRPCError } from '@trpc/server';
import { router, managerProcedure } from '../init';
import { createNotification } from '../../notifications';
import { activeTaskStatuses } from './tasks-policy';
import { adminStoreIdWhere, adminStoreWhere, resolveAdminScope, type AdminScope } from './admin-scope';
import { logAdminAction } from './admin-audit';

const scopeInput = z.object({
  scope: z.string().optional(),
  days: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
}).optional();

const attentionInput = z.object({
  scope: z.string().optional(),
  type: z.string().optional(),
  severity: z.enum(['danger', 'warning', 'info']).optional(),
  take: z.number().min(1).max(50).default(20),
}).optional();

function getJamaicaDate(d?: Date): Date {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica' }).format(d ?? new Date());
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function getJamaicaMinutes(d?: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Jamaica',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d ?? new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function parseStoreTime(value?: string | null, fallback = '20:00') {
  const [hour, minute] = (value || fallback).split(':').map(Number);
  return hour * 60 + minute;
}

function isChecklistPastDue(store: { closeTime?: string | null }) {
  return getJamaicaMinutes() >= parseStoreTime(store.closeTime);
}

function daysAgo(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

function storeFilter(scope: AdminScope) {
  return adminStoreWhere(scope);
}

async function getActionLogs(ctx: any, scope: AdminScope, input?: { sourceType?: string; sourceId?: string; take?: number }) {
  const model = ctx.db.adminActionLog;
  if (!model?.findMany) return [];
  const where: any = {
    ...(scope.isAllStores ? { OR: [{ storeId: { in: scope.storeIds } }, { storeId: null }] } : { storeId: scope.storeIds[0] }),
  };
  if (input?.sourceType) where.sourceType = input.sourceType;
  if (input?.sourceId) where.sourceId = input.sourceId;
  return model.findMany({
    where,
    include: { actor: { select: { id: true, fullName: true, role: true } }, store: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: input?.take ?? 12,
  });
}

function severityRank(severity: string) {
  if (severity === 'danger') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function sortAttention<T extends { severity: string; createdAt: Date }>(items: T[]) {
  return items.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.createdAt.getTime() - a.createdAt.getTime());
}

async function buildAttentionItems(ctx: any, scope: AdminScope, input?: { type?: string; severity?: 'danger' | 'warning' | 'info'; take?: number }) {
  const where = storeFilter(scope);
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const today = getJamaicaDate();

  const [
    overdueTasks,
    helpTasks,
    reviewTasks,
    flaggedLogs,
    incidents,
    stockOuts,
    expiryAlerts,
    suggestions,
    orders,
    templates,
    submissions,
  ] = await Promise.all([
    ctx.db.task.findMany({
      where: { ...where, dueDate: { lt: now }, status: { in: activeTaskStatuses } },
      include: { store: true, assignedTo: { select: { fullName: true } } },
      orderBy: { dueDate: 'asc' },
      take: 12,
    }),
    ctx.db.task.findMany({
      where: { ...where, status: TaskStatus.NEEDS_HELP },
      include: { store: true, assignedTo: { select: { fullName: true } } },
      orderBy: { helpRequestedAt: 'desc' },
      take: 12,
    }),
    ctx.db.task.findMany({
      where: { ...where, status: TaskStatus.IN_REVIEW },
      include: { store: true, assignedTo: { select: { fullName: true } } },
      orderBy: { submittedForReviewAt: 'desc' },
      take: 12,
    }),
    ctx.db.logEntry.findMany({
      where: { ...where, isFlagged: true, resolvedAt: null },
      include: { store: true, author: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    ctx.db.incident.findMany({
      where: { ...where, status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] } },
      include: { store: true, reportedBy: { select: { fullName: true } } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    }),
    ctx.db.stockOutReport.findMany({
      where: { ...where, status: { not: StockOutStatus.RESTOCKED } },
      include: { store: true, reportedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    ctx.db.expiryAlert.findMany({
      where: { ...where, status: ExpiryStatus.ACTIVE, expiryDate: { lte: soon } },
      include: { store: true, reportedBy: { select: { fullName: true } } },
      orderBy: { expiryDate: 'asc' },
      take: 12,
    }),
    ctx.db.suggestion.findMany({
      where: { ...where, status: SuggestionStatus.NEW },
      include: { store: true, author: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    ctx.db.purchaseOrder.findMany({
      where: { ...where, status: { in: [POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED] } },
      include: { store: true, supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    ctx.db.checklistTemplate.findMany({
      where: { ...where, isActive: true },
      include: { store: true },
      orderBy: { name: 'asc' },
      take: 100,
    }),
    ctx.db.checklistSubmission.findMany({
      where: { ...where, date: today },
      select: { storeId: true, templateId: true },
      take: 200,
    }),
  ]);

  const submittedKeys = new Set(submissions.map((item: any) => `${item.storeId}:${item.templateId}`));
  const missedChecklists = templates
    .filter((template: any) => isChecklistPastDue(template.store) && !submittedKeys.has(`${template.storeId}:${template.id}`))
    .slice(0, 12);

  const items = [
    ...overdueTasks.map((task: any) => ({
      id: `task-overdue-${task.id}`,
      sourceId: task.id,
      type: 'OVERDUE_TASK',
      severity: 'danger',
      icon: 'event_busy',
      title: task.title,
      subtitle: `${task.assignedTo?.fullName || 'Unassigned'}${task.dueDate ? ` · due ${task.dueDate.toLocaleDateString()}` : ''}`,
      storeId: task.storeId,
      storeName: task.store.name,
      href: `/hub/tasks/${task.id}?from=admin`,
      createdAt: task.dueDate || task.createdAt,
      action: 'REMIND',
    })),
    ...helpTasks.map((task: any) => ({
      id: `task-help-${task.id}`,
      sourceId: task.id,
      type: 'HELP_TASK',
      severity: 'danger',
      icon: 'support_agent',
      title: task.title,
      subtitle: `${task.assignedTo?.fullName || 'Unassigned'} needs help`,
      storeId: task.storeId,
      storeName: task.store.name,
      href: `/hub/tasks/${task.id}?from=admin`,
      createdAt: task.helpRequestedAt || task.updatedAt,
      action: 'OPEN',
    })),
    ...reviewTasks.map((task: any) => ({
      id: `task-review-${task.id}`,
      sourceId: task.id,
      type: 'REVIEW_TASK',
      severity: 'warning',
      icon: 'rate_review',
      title: task.title,
      subtitle: `${task.assignedTo?.fullName || 'Staff'} is waiting for review`,
      storeId: task.storeId,
      storeName: task.store.name,
      href: `/hub/tasks/${task.id}?from=admin`,
      createdAt: task.submittedForReviewAt || task.updatedAt,
      action: 'OPEN',
    })),
    ...flaggedLogs.map((log: any) => ({
      id: `log-${log.id}`,
      sourceId: log.id,
      type: 'FLAGGED_LOG',
      severity: 'warning',
      icon: 'flag',
      title: log.body.slice(0, 90),
      subtitle: `${log.author.fullName} flagged this log entry`,
      storeId: log.storeId,
      storeName: log.store.name,
      href: '/hub/logbook',
      createdAt: log.createdAt,
      action: 'CREATE_TASK',
    })),
    ...incidents.map((incident: any) => ({
      id: `incident-${incident.id}`,
      sourceId: incident.id,
      type: 'INCIDENT',
      severity: incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'danger' : 'warning',
      icon: 'report_problem',
      title: incident.title,
      subtitle: `${incident.category.replaceAll('_', ' ')} · ${incident.reportedBy.fullName}`,
      storeId: incident.storeId,
      storeName: incident.store.name,
      href: `/tools/incidents/${incident.id}`,
      createdAt: incident.createdAt,
      action: 'CREATE_TASK',
    })),
    ...stockOuts.map((stockOut: any) => ({
      id: `stock-${stockOut.id}`,
      sourceId: stockOut.id,
      type: 'STOCK_OUT',
      severity: stockOut.status === StockOutStatus.REPORTED ? 'danger' : 'warning',
      icon: 'inventory',
      title: stockOut.productName,
      subtitle: `${stockOut.location || 'No location'} · reported by ${stockOut.reportedBy.fullName}`,
      storeId: stockOut.storeId,
      storeName: stockOut.store.name,
      href: '/tools/stock-out',
      createdAt: stockOut.createdAt,
      action: stockOut.status === StockOutStatus.REPORTED ? 'ACKNOWLEDGE' : 'CREATE_TASK',
    })),
    ...expiryAlerts.map((alert: any) => ({
      id: `expiry-${alert.id}`,
      sourceId: alert.id,
      type: 'EXPIRY_ALERT',
      severity: alert.expiryDate < today ? 'danger' : 'warning',
      icon: 'event_available',
      title: alert.productName,
      subtitle: `${alert.quantity} item(s) · expires ${alert.expiryDate.toLocaleDateString()}`,
      storeId: alert.storeId,
      storeName: alert.store.name,
      href: '/tools/expiry-tracker',
      createdAt: alert.createdAt,
      action: 'MARK_PULLED',
    })),
    ...missedChecklists.map((template: any) => ({
      id: `checklist-${template.id}`,
      sourceId: template.id,
      type: 'MISSED_CHECKLIST',
      severity: 'warning',
      icon: 'checklist',
      title: template.name,
      subtitle: 'Not submitted by closing time',
      storeId: template.storeId,
      storeName: template.store.name,
      href: '/admin/checklists/submissions',
      createdAt: now,
      action: 'CREATE_TASK',
    })),
    ...orders.map((order: any) => ({
      id: `order-${order.id}`,
      sourceId: order.id,
      type: 'PURCHASE_ORDER',
      severity: order.status === POStatus.PARTIALLY_RECEIVED ? 'warning' : 'info',
      icon: 'receipt_long',
      title: order.orderNumber,
      subtitle: `${order.supplier.name} · ${order.status.replaceAll('_', ' ')}`,
      storeId: order.storeId,
      storeName: order.store.name,
      href: `/admin/orders/${order.id}`,
      createdAt: order.createdAt,
      action: 'OPEN',
    })),
    ...suggestions.map((suggestion: any) => ({
      id: `suggestion-${suggestion.id}`,
      sourceId: suggestion.id,
      type: 'SUGGESTION',
      severity: 'info',
      icon: 'lightbulb',
      title: suggestion.body.slice(0, 90),
      subtitle: `${suggestion.category} · ${suggestion.isAnonymous ? 'Anonymous' : suggestion.author?.fullName || 'Staff'}`,
      storeId: suggestion.storeId,
      storeName: suggestion.store.name,
      href: '/admin/suggestions',
      createdAt: suggestion.createdAt,
      action: 'OPEN',
    })),
  ];

  return sortAttention(items)
    .filter((item) => !input?.type || item.type === input.type)
    .filter((item) => !input?.severity || item.severity === input.severity)
    .slice(0, input?.take ?? 20);
}

async function buildStoreHealth(ctx: any, scope: AdminScope) {
  const stores = await ctx.db.store.findMany({
    where: scope.isAllStores ? { id: { in: scope.storeIds } } : { id: scope.storeIds[0] },
    orderBy: { name: 'asc' },
  });
  const now = new Date();
  const today = getJamaicaDate();

  const rows = await Promise.all(stores.map(async (store: any) => {
    const [
      openTasks,
      overdueTasks,
      helpTasks,
      reviewTasks,
      flaggedLogs,
      openIncidents,
      stockOuts,
      expiryAlerts,
      templates,
      submissions,
    ] = await Promise.all([
      ctx.db.task.count({ where: { storeId: store.id, status: { in: activeTaskStatuses } } }),
      ctx.db.task.count({ where: { storeId: store.id, dueDate: { lt: now }, status: { in: activeTaskStatuses } } }),
      ctx.db.task.count({ where: { storeId: store.id, status: TaskStatus.NEEDS_HELP } }),
      ctx.db.task.count({ where: { storeId: store.id, status: TaskStatus.IN_REVIEW } }),
      ctx.db.logEntry.count({ where: { storeId: store.id, isFlagged: true, resolvedAt: null } }),
      ctx.db.incident.count({ where: { storeId: store.id, status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] } } }),
      ctx.db.stockOutReport.count({ where: { storeId: store.id, status: { not: StockOutStatus.RESTOCKED } } }),
      ctx.db.expiryAlert.count({ where: { storeId: store.id, status: ExpiryStatus.ACTIVE } }),
      ctx.db.checklistTemplate.count({ where: { storeId: store.id, isActive: true } }),
      ctx.db.checklistSubmission.count({ where: { storeId: store.id, date: today } }),
    ]);
    const missedChecklists = isChecklistPastDue(store) ? Math.max(templates - submissions, 0) : 0;
    const riskScore = overdueTasks * 4 + helpTasks * 4 + openIncidents * 3 + stockOuts * 2 + expiryAlerts * 2 + missedChecklists * 2 + reviewTasks + flaggedLogs;
    const status = riskScore >= 8 ? 'danger' : riskScore >= 3 ? 'warning' : 'good';
    return {
      storeId: store.id,
      storeName: store.name,
      parish: store.parish,
      isActive: store.isActive,
      status,
      riskScore,
      openTasks,
      overdueTasks,
      helpTasks,
      reviewTasks,
      flaggedLogs,
      openIncidents,
      stockOuts,
      expiryAlerts,
      missedChecklists,
    };
  }));

  return rows.sort((a, b) => b.riskScore - a.riskScore || a.storeName.localeCompare(b.storeName));
}

async function buildWorkload(ctx: any, scope: AdminScope) {
  const where = storeFilter(scope);
  const users = await ctx.db.user.findMany({
    where: { storeId: scope.isAllStores ? { in: scope.storeIds } : scope.storeIds[0], isActive: true },
    select: { id: true, fullName: true, role: true, store: { select: { id: true, name: true } } },
    orderBy: { fullName: 'asc' },
  });
  const activeTasks = await ctx.db.task.findMany({
    where: { ...where, status: { in: activeTaskStatuses } },
    select: { assignedToId: true, priority: true, dueDate: true, status: true },
    take: 1000,
  });
  const unassigned = activeTasks.filter((task: any) => !task.assignedToId).length;
  const now = new Date();
  const counts = new Map<string, { active: number; urgent: number; overdue: number }>();
  for (const task of activeTasks as any[]) {
    if (!task.assignedToId) continue;
    const count = counts.get(task.assignedToId) || { active: 0, urgent: 0, overdue: 0 };
    count.active++;
    if (task.priority === 'URGENT' || task.status === TaskStatus.NEEDS_HELP) count.urgent++;
    if (task.dueDate && task.dueDate < now) count.overdue++;
    counts.set(task.assignedToId, count);
  }

  const staff: Array<{ id: string; fullName: string; role: string; storeId: string; storeName: string; active: number; urgent: number; overdue: number }> = users.map((user: any) => ({
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    storeId: user.store.id,
    storeName: user.store.name,
    active: counts.get(user.id)?.active ?? 0,
    urgent: counts.get(user.id)?.urgent ?? 0,
    overdue: counts.get(user.id)?.overdue ?? 0,
  }));

  return {
    unassigned,
    overloaded: staff.filter((user) => user.active >= 6 || user.urgent > 0 || user.overdue > 0).sort((a, b) => b.overdue - a.overdue || b.urgent - a.urgent || b.active - a.active).slice(0, 8),
    quiet: staff.filter((user) => user.active === 0).slice(0, 8),
  };
}

async function buildTodayOperations(ctx: any, scope: AdminScope) {
  const where = storeFilter(scope);
  const today = getJamaicaDate();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const now = new Date();
  const stores = await ctx.db.store.findMany({
    where: { id: adminStoreIdWhere(scope), isActive: true },
    orderBy: { name: 'asc' },
  });

  const [
    dueToday,
    overdue,
    unresolvedIncidents,
    unassigned,
    activeTasks,
    submissions,
    templates,
  ] = await Promise.all([
    ctx.db.task.count({ where: { ...where, status: { in: activeTaskStatuses }, dueDate: { gte: today, lt: tomorrow } } }),
    ctx.db.task.count({ where: { ...where, status: { in: activeTaskStatuses }, dueDate: { lt: now } } }),
    ctx.db.incident.count({ where: { ...where, status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] } } }),
    ctx.db.task.count({ where: { ...where, status: { in: activeTaskStatuses }, assignedToId: null } }),
    ctx.db.task.findMany({ where: { ...where, status: { in: activeTaskStatuses }, assignedToId: { not: null } }, select: { assignedToId: true, storeId: true }, take: 1000 }),
    ctx.db.checklistSubmission.findMany({ where: { ...where, date: today }, select: { storeId: true, template: { select: { name: true } } }, take: 200 }),
    ctx.db.checklistTemplate.findMany({ where: { ...where, isActive: true }, select: { id: true, storeId: true, name: true }, take: 200 }),
  ]);

  const submittedByStore = new Map<string, string[]>();
  for (const submission of submissions as any[]) {
    const names = submittedByStore.get(submission.storeId) ?? [];
    names.push(submission.template?.name ?? 'Checklist');
    submittedByStore.set(submission.storeId, names);
  }
  const templateCounts = new Map<string, number>();
  for (const template of templates as any[]) {
    templateCounts.set(template.storeId, (templateCounts.get(template.storeId) ?? 0) + 1);
  }
  const taskCounts = new Map<string, number>();
  for (const task of activeTasks as any[]) {
    taskCounts.set(task.assignedToId, (taskCounts.get(task.assignedToId) ?? 0) + 1);
  }
  const overloadedStaff = Array.from(taskCounts.values()).filter((count) => count >= 6).length;

  const checklistStatus = stores.map((store: any) => {
    const submitted = submittedByStore.get(store.id)?.length ?? 0;
    const expected = templateCounts.get(store.id) ?? 0;
    const isOpenWindow = getJamaicaMinutes() >= parseStoreTime(store.openTime, '08:00');
    const isCloseWindow = isChecklistPastDue(store);
    return {
      storeId: store.id,
      storeName: store.name,
      opening: expected === 0 ? 'none' : submitted > 0 ? 'done' : isOpenWindow ? 'missing' : 'pending',
      closing: expected === 0 ? 'none' : submitted >= expected ? 'done' : isCloseWindow ? 'missing' : 'pending',
      submitted,
      expected,
    };
  });

  return {
    dueToday,
    overdue,
    unresolvedIncidents,
    unassigned,
    overloadedStaff,
    checklistStatus,
    links: {
      dueToday: '/admin/tasks?due=TODAY',
      overdue: '/admin/tasks?due=OVERDUE',
      incidents: '/tools/incidents',
      unassigned: '/admin/tasks?chip=unassigned',
    },
  };
}

async function buildSummary(ctx: any, scope: AdminScope, days: 1 | 7 | 30) {
  const where = storeFilter(scope);
  const since = daysAgo(days);
  const now = new Date();

  const [
    activeStores,
    staff,
    openTasks,
    completedTasks,
    overdueTasks,
    helpTasks,
    reviewTasks,
    flaggedLogs,
    openIncidents,
    stockOuts,
    expiryAlerts,
    newSuggestions,
    partialOrders,
    recentTasks,
    recentThreads,
  ] = await Promise.all([
    ctx.db.store.count({ where: scope.isAllStores ? { id: { in: scope.storeIds }, isActive: true } : { id: scope.storeIds[0], isActive: true } }),
    ctx.db.user.count({ where: { storeId: scope.isAllStores ? { in: scope.storeIds } : scope.storeIds[0], isActive: true } }),
    ctx.db.task.count({ where: { ...where, status: { in: activeTaskStatuses } } }),
    ctx.db.task.count({ where: { ...where, status: TaskStatus.DONE, completedAt: { gte: since } } }),
    ctx.db.task.count({ where: { ...where, dueDate: { lt: now }, status: { in: activeTaskStatuses } } }),
    ctx.db.task.count({ where: { ...where, status: TaskStatus.NEEDS_HELP } }),
    ctx.db.task.count({ where: { ...where, status: TaskStatus.IN_REVIEW } }),
    ctx.db.logEntry.count({ where: { ...where, isFlagged: true, resolvedAt: null } }),
    ctx.db.incident.count({ where: { ...where, status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] } } }),
    ctx.db.stockOutReport.count({ where: { ...where, status: { not: StockOutStatus.RESTOCKED } } }),
    ctx.db.expiryAlert.count({ where: { ...where, status: ExpiryStatus.ACTIVE } }),
    ctx.db.suggestion.count({ where: { ...where, status: SuggestionStatus.NEW } }),
    ctx.db.purchaseOrder.count({ where: { ...where, status: { in: [POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED] } } }),
    ctx.db.task.findMany({ where, include: { store: true, createdBy: { select: { fullName: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 }),
    ctx.db.thread.findMany({ where, include: { store: true, _count: { select: { messages: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 }),
  ]);

  const attention = await buildAttentionItems(ctx, scope, { take: 16 });
  const storeHealth = await buildStoreHealth(ctx, scope);
  const workload = await buildWorkload(ctx, scope);
  const todayOperations = await buildTodayOperations(ctx, scope);
  const actionLog = await getActionLogs(ctx, scope, { take: 6 });
  const missedChecklists = storeHealth.reduce((sum, store) => sum + store.missedChecklists, 0);
  const riskCount = overdueTasks + helpTasks + flaggedLogs + openIncidents + stockOuts + expiryAlerts + missedChecklists;
  const completedPlusOpen = completedTasks + openTasks;

  return {
    scope: {
      requested: scope.requested,
      isAllStores: scope.isAllStores,
      storeIds: scope.storeIds,
      label: scope.label,
    },
    generatedAt: new Date(),
    days,
    kpis: {
      activeStores,
      staff,
      openTasks,
      completedTasks,
      completionRate: completedPlusOpen ? Math.round((completedTasks / completedPlusOpen) * 100) : 0,
      overdueTasks,
      helpTasks,
      reviewTasks,
      flaggedLogs,
      openIncidents,
      stockOuts,
      expiryAlerts,
      missedChecklists,
      newSuggestions,
      partialOrders,
      riskCount,
    },
    attention,
    storeHealth,
    workload,
    todayOperations,
    actionLog,
    recentActivity: {
      tasks: recentTasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        storeName: task.store.name,
        actor: task.createdBy.fullName,
        href: `/hub/tasks/${task.id}?from=admin`,
        updatedAt: task.updatedAt,
      })),
      threads: recentThreads.map((thread: any) => ({
        id: thread.id,
        title: thread.title,
        storeName: thread.store.name,
        messages: thread._count.messages,
        href: `/hub/threads/${thread.id}`,
        updatedAt: thread.updatedAt,
      })),
    },
    quickLinks: [
      { href: '/admin/tasks', label: 'Tasks', icon: 'assignment', badge: openTasks },
      { href: '/admin/people', label: 'People', icon: 'group', badge: staff },
      { href: '/admin/checklists', label: 'Checklists', icon: 'checklist', badge: missedChecklists },
      { href: '/admin/reports', label: 'Reports', icon: 'analytics', badge: riskCount },
      { href: '/admin/orders', label: 'Orders', icon: 'receipt_long', badge: partialOrders },
      { href: '/admin/announcements', label: 'Announce', icon: 'campaign', badge: 0 },
      { href: '/admin/suggestions', label: 'Suggestions', icon: 'lightbulb', badge: newSuggestions },
    ],
  };
}

async function assertSource(ctx: any, scope: AdminScope, type: string, sourceId: string) {
  const where = storeFilter(scope);
  if (['OVERDUE_TASK', 'HELP_TASK', 'REVIEW_TASK'].includes(type)) return { source: await ctx.db.task.findFirstOrThrow({ where: { ...where, id: sourceId } }), linkType: TaskLinkType.TASK };
  if (type === 'INCIDENT') return { source: await ctx.db.incident.findFirstOrThrow({ where: { ...where, id: sourceId } }), linkType: TaskLinkType.INCIDENT };
  if (type === 'STOCK_OUT') return { source: await ctx.db.stockOutReport.findFirstOrThrow({ where: { ...where, id: sourceId } }), linkType: TaskLinkType.STOCK_OUT };
  if (type === 'EXPIRY_ALERT') return { source: await ctx.db.expiryAlert.findFirstOrThrow({ where: { ...where, id: sourceId } }), linkType: TaskLinkType.EXPIRY_ALERT };
  if (type === 'FLAGGED_LOG') return { source: await ctx.db.logEntry.findFirstOrThrow({ where: { ...where, id: sourceId } }), linkType: TaskLinkType.LOGBOOK };
  if (type === 'MISSED_CHECKLIST') return { source: await ctx.db.checklistTemplate.findFirstOrThrow({ where: { ...where, id: sourceId } }), linkType: TaskLinkType.CHECKLIST };
  if (type === 'PURCHASE_ORDER') return { source: await ctx.db.purchaseOrder.findFirstOrThrow({ where: { ...where, id: sourceId } }), linkType: TaskLinkType.PURCHASE_ORDER };
  if (type === 'SUGGESTION') return { source: await ctx.db.suggestion.findFirstOrThrow({ where: { ...where, id: sourceId } }), linkType: TaskLinkType.OTHER };
  throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unsupported attention source' });
}

async function buildAttentionDetail(ctx: any, scope: AdminScope, type: string, sourceId: string) {
  const { source, linkType } = await assertSource(ctx, scope, type, sourceId);
  const linkedTaskCount = await ctx.db.taskLink.count({ where: { type: linkType, entityId: sourceId, task: storeFilter(scope) } });
  const recentActions = await getActionLogs(ctx, scope, { sourceType: type, sourceId, take: 8 });
  const linkedTasks = await ctx.db.task.findMany({
    where: { ...storeFilter(scope), links: { some: { type: linkType, entityId: sourceId } } },
    include: { assignedTo: { select: { id: true, fullName: true } }, store: { select: { id: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  return {
    type,
    sourceId,
    storeId: source.storeId,
    source,
    linkedTaskCount,
    linkedTasks,
    recentActions,
    validActions: {
      canRemind: ['OVERDUE_TASK', 'HELP_TASK', 'REVIEW_TASK'].includes(type),
      canCreateTask: !['OVERDUE_TASK', 'HELP_TASK', 'REVIEW_TASK', 'PURCHASE_ORDER'].includes(type),
      canAcknowledgeStockOut: type === 'STOCK_OUT' && source.status === StockOutStatus.REPORTED,
      canMarkExpiryPulled: type === 'EXPIRY_ALERT' && source.status === ExpiryStatus.ACTIVE,
      canRespondSuggestion: type === 'SUGGESTION' && source.status === SuggestionStatus.NEW,
    },
  };
}

async function buildStoreOperations(ctx: any, scope: AdminScope, storeId: string, days: 1 | 7 | 30) {
  if (!scope.storeIds.includes(storeId)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Store is outside your admin scope' });
  }
  const store = await ctx.db.store.findFirstOrThrow({ where: { id: storeId, isActive: true } });
  const since = daysAgo(days);
  const now = new Date();
  const today = getJamaicaDate();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [health] = await buildStoreHealth(ctx, { requested: storeId, storeIds: [storeId], isAllStores: false, label: store.name });
  const [
    lateTasks,
    helpRequests,
    reviewQueue,
    unassigned,
    stockOuts,
    expiryAlerts,
    incidents,
    completed,
    staffTasks,
    templates,
    submissions,
    actionLog,
  ] = await Promise.all([
    ctx.db.task.findMany({ where: { storeId, dueDate: { lt: now }, status: { in: activeTaskStatuses } }, include: { assignedTo: { select: { id: true, fullName: true } } }, orderBy: { dueDate: 'asc' }, take: 20 }),
    ctx.db.task.findMany({ where: { storeId, status: TaskStatus.NEEDS_HELP }, include: { assignedTo: { select: { id: true, fullName: true } } }, orderBy: { helpRequestedAt: 'desc' }, take: 20 }),
    ctx.db.task.findMany({ where: { storeId, status: TaskStatus.IN_REVIEW }, include: { assignedTo: { select: { id: true, fullName: true } } }, orderBy: { submittedForReviewAt: 'desc' }, take: 20 }),
    ctx.db.task.findMany({ where: { storeId, assignedToId: null, status: { in: activeTaskStatuses } }, orderBy: { updatedAt: 'desc' }, take: 20 }),
    ctx.db.stockOutReport.findMany({ where: { storeId, status: { not: StockOutStatus.RESTOCKED } }, include: { reportedBy: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ctx.db.expiryAlert.findMany({ where: { storeId, status: ExpiryStatus.ACTIVE }, include: { reportedBy: { select: { fullName: true } } }, orderBy: { expiryDate: 'asc' }, take: 20 }),
    ctx.db.incident.findMany({ where: { storeId, status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] } }, include: { reportedBy: { select: { fullName: true } } }, orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }], take: 20 }),
    ctx.db.task.findMany({ where: { storeId, status: TaskStatus.DONE, completedAt: { gte: since } }, include: { assignedTo: { select: { id: true, fullName: true } } }, orderBy: { completedAt: 'desc' }, take: 10 }),
    ctx.db.task.groupBy({ by: ['assignedToId'], where: { storeId, status: { in: activeTaskStatuses }, assignedToId: { not: null } }, _count: true, orderBy: { _count: { assignedToId: 'desc' } }, take: 8 }),
    ctx.db.checklistTemplate.findMany({ where: { storeId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ctx.db.checklistSubmission.findMany({ where: { storeId, date: { gte: today, lt: tomorrow } }, select: { templateId: true }, take: 100 }),
    getActionLogs(ctx, { requested: storeId, storeIds: [storeId], isAllStores: false, label: store.name }, { take: 12 }),
  ]);
  const staffIds = staffTasks.map((row: any) => row.assignedToId).filter(Boolean);
  const staff = await ctx.db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, fullName: true, role: true } });
  const submitted = new Set(submissions.map((item: any) => item.templateId));
  const missedChecklists = templates.filter((template: any) => isChecklistPastDue(store) && !submitted.has(template.id));
  const overloadedStaff = staffTasks.map((row: any) => ({
    id: row.assignedToId,
    fullName: staff.find((user: any) => user.id === row.assignedToId)?.fullName ?? 'Unknown',
    active: row._count,
  })).filter((row: any) => row.active >= 6);
  const riskReasons = [
    health.overdueTasks > 0 && `${health.overdueTasks} overdue task${health.overdueTasks === 1 ? '' : 's'}`,
    health.helpTasks > 0 && `${health.helpTasks} help request${health.helpTasks === 1 ? '' : 's'}`,
    health.openIncidents > 0 && `${health.openIncidents} open incident${health.openIncidents === 1 ? '' : 's'}`,
    health.stockOuts > 0 && `${health.stockOuts} stock-out${health.stockOuts === 1 ? '' : 's'}`,
    health.expiryAlerts > 0 && `${health.expiryAlerts} expiry alert${health.expiryAlerts === 1 ? '' : 's'}`,
    missedChecklists.length > 0 && `${missedChecklists.length} missed checklist${missedChecklists.length === 1 ? '' : 's'}`,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    store,
    days,
    health,
    riskReasons,
    lateTasks,
    helpRequests,
    reviewQueue,
    unassigned,
    stockOuts,
    expiryAlerts,
    incidents,
    missedChecklists,
    overloadedStaff,
    completed,
    actionLog,
  };
}

async function buildSupplyOverview(ctx: any, scope: AdminScope, days: 7 | 30) {
  const where = storeFilter(scope);
  const since = daysAgo(days);
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);

  const [stockOuts, expiryAlerts, orders, suppliers] = await Promise.all([
    ctx.db.stockOutReport.findMany({
      where: { ...where, status: { not: StockOutStatus.RESTOCKED } },
      include: { store: { select: { id: true, name: true } }, product: { select: { id: true, name: true, supplier: true } }, reportedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    ctx.db.expiryAlert.findMany({
      where: { ...where, status: ExpiryStatus.ACTIVE },
      include: { store: { select: { id: true, name: true } }, product: { select: { id: true, name: true } }, reportedBy: { select: { id: true, fullName: true } } },
      orderBy: { expiryDate: 'asc' },
      take: 80,
    }),
    ctx.db.purchaseOrder.findMany({
      where: { ...where, status: { in: [POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED] } },
      include: { store: { select: { id: true, name: true } }, supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    ctx.db.supplier.findMany({
      where: { ...where, isActive: true },
      include: { store: { select: { id: true, name: true } }, orders: { where: { createdAt: { gte: since } }, select: { id: true, status: true, createdAt: true, receivedAt: true } } },
      orderBy: { name: 'asc' },
      take: 120,
    }),
  ]);

  const recentStockOuts = await ctx.db.stockOutReport.findMany({
    where: { ...where, createdAt: { gte: since } },
    select: { productId: true, productName: true, storeId: true },
    take: 500,
  });
  const repeatCounts = new Map<string, { productId: string | null; productName: string; count: number; storeId: string }>();
  for (const row of recentStockOuts as any[]) {
    const key = row.productId || `${row.storeId}:${row.productName.toLowerCase()}`;
    const current = repeatCounts.get(key) ?? { productId: row.productId, productName: row.productName, count: 0, storeId: row.storeId };
    current.count++;
    repeatCounts.set(key, current);
  }

  return {
    scope: { requested: scope.requested, isAllStores: scope.isAllStores, storeIds: scope.storeIds, label: scope.label },
    days,
    counts: {
      activeStockOuts: stockOuts.length,
      repeatStockOuts: Array.from(repeatCounts.values()).filter((item) => item.count >= 2).length,
      activeExpiryAlerts: expiryAlerts.length,
      soonExpiryAlerts: expiryAlerts.filter((item: any) => item.expiryDate <= soon && item.expiryDate >= now).length,
      overdueExpiryAlerts: expiryAlerts.filter((item: any) => item.expiryDate < now).length,
      partialOrders: orders.filter((order: any) => order.status === POStatus.PARTIALLY_RECEIVED).length,
      lateOrders: orders.filter((order: any) => order.expectedAt && order.expectedAt < now).length,
      suppliers: suppliers.length,
    },
    stockOuts: stockOuts.map((item: any) => ({
      ...item,
      repeatCount: repeatCounts.get(item.productId || `${item.storeId}:${item.productName.toLowerCase()}`)?.count ?? 1,
    })),
    repeatStockOuts: Array.from(repeatCounts.values()).filter((item) => item.count >= 2).sort((a, b) => b.count - a.count),
    expiryAlerts: expiryAlerts.map((item: any) => ({
      ...item,
      timing: item.expiryDate < now ? 'overdue' : item.expiryDate <= soon ? 'soon' : 'active',
    })),
    orders: orders.map((order: any) => ({
      ...order,
      isLate: Boolean(order.expectedAt && order.expectedAt < now),
      remainingItems: order.items.filter((item: any) => (item.receivedQty ?? 0) < item.quantity).length,
    })),
    suppliers: suppliers.map((supplier: any) => {
      const receivedOrders = supplier.orders.filter((order: any) => order.receivedAt);
      const avgReceiveHours = receivedOrders.length
        ? Math.round(receivedOrders.reduce((sum: number, order: any) => sum + (order.receivedAt.getTime() - order.createdAt.getTime()) / 36e5, 0) / receivedOrders.length)
        : null;
      return {
        id: supplier.id,
        name: supplier.name,
        storeId: supplier.storeId,
        store: supplier.store,
        orderCount: supplier.orders.length,
        partialOrders: supplier.orders.filter((order: any) => order.status === POStatus.PARTIALLY_RECEIVED).length,
        openOrders: supplier.orders.filter((order: any) => [POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED].includes(order.status)).length,
        avgReceiveHours,
      };
    }),
  };
}

async function buildChecklistHealth(ctx: any, scope: AdminScope, days: 7 | 30) {
  const where = storeFilter(scope);
  const since = daysAgo(days);
  const today = getJamaicaDate();
  const stores = await ctx.db.store.findMany({ where: { id: adminStoreIdWhere(scope), isActive: true }, orderBy: { name: 'asc' } });
  const [templates, submissions] = await Promise.all([
    ctx.db.checklistTemplate.findMany({
      where,
      include: { store: { select: { id: true, name: true, closeTime: true } }, items: true, _count: { select: { submissions: true } } },
      orderBy: { name: 'asc' },
      take: 250,
    }),
    ctx.db.checklistSubmission.findMany({
      where: { ...where, date: { gte: since } },
      include: { store: { select: { id: true, name: true, closeTime: true } }, template: { select: { id: true, name: true } }, items: true },
      orderBy: { completedAt: 'desc' },
      take: 600,
    }),
  ]);

  const todaySubmissions = new Set(submissions.filter((submission: any) => submission.date.getTime() === today.getTime()).map((submission: any) => `${submission.storeId}:${submission.templateId}`));
  const submissionsByTemplate = new Map<string, number>();
  const skippedByLabel = new Map<string, { label: string; count: number; templateId: string; storeId: string; storeName: string }>();
  for (const submission of submissions as any[]) {
    submissionsByTemplate.set(submission.templateId, (submissionsByTemplate.get(submission.templateId) ?? 0) + 1);
    for (const item of submission.items) {
      if (item.status === ChecklistItemStatus.DONE) continue;
      const label = item.label || 'Checklist item';
      const key = `${submission.templateId}:${label}`;
      const current = skippedByLabel.get(key) ?? { label, count: 0, templateId: submission.templateId, storeId: submission.storeId, storeName: submission.store.name };
      current.count++;
      skippedByLabel.set(key, current);
    }
  }
  const missedToday = templates
    .filter((template: any) => template.isActive && isChecklistPastDue(template.store) && !todaySubmissions.has(`${template.storeId}:${template.id}`))
    .map((template: any) => ({ templateId: template.id, templateName: template.name, storeId: template.storeId, storeName: template.store.name }));
  const byStore = stores.map((store: any) => {
    const storeTemplates = templates.filter((template: any) => template.storeId === store.id && template.isActive);
    const expected = storeTemplates.length * days;
    const completed = submissions.filter((submission: any) => submission.storeId === store.id).length;
    return {
      storeId: store.id,
      storeName: store.name,
      missedToday: missedToday.filter((item: any) => item.storeId === store.id).length,
      completionRate: expected ? Math.min(100, Math.round((completed / expected) * 100)) : 100,
    };
  });

  return {
    days,
    counts: {
      templates: templates.length,
      missedToday: missedToday.length,
      unusedTemplates: templates.filter((template: any) => (submissionsByTemplate.get(template.id) ?? 0) === 0).length,
      skippedOften: Array.from(skippedByLabel.values()).filter((item) => item.count >= 2).length,
      submissions: submissions.length,
    },
    templates: templates.map((template: any) => ({
      id: template.id,
      name: template.name,
      storeId: template.storeId,
      storeName: template.store.name,
      isActive: template.isActive,
      itemCount: template.items.length,
      submissionCount: submissionsByTemplate.get(template.id) ?? 0,
      unused: (submissionsByTemplate.get(template.id) ?? 0) === 0,
      missedToday: missedToday.some((item: any) => item.templateId === template.id),
      skippedOften: Array.from(skippedByLabel.values()).some((item: any) => item.templateId === template.id && item.count >= 2),
    })),
    missedToday,
    skippedItems: Array.from(skippedByLabel.values()).sort((a, b) => b.count - a.count).slice(0, 20),
    byStore,
  };
}

async function buildActivityFeed(ctx: any, scope: AdminScope, input?: { type?: string; actorId?: string; sourceType?: string; severity?: string; take?: number; cursor?: string }) {
  const where = storeFilter(scope);
  const take = input?.take ?? 30;
  const before = input?.cursor ? new Date(input.cursor) : undefined;
  const timeFilter = before ? { lt: before } : undefined;
  const actionLog = await getActionLogs(ctx, scope, { sourceType: input?.sourceType, take });
  const [tasks, incidents, stockOuts, expiryAlerts, suggestions, flaggedLogs] = await Promise.all([
    ctx.db.task.findMany({ where: { ...where, ...(timeFilter ? { updatedAt: timeFilter } : {}) }, include: { store: { select: { id: true, name: true } }, assignedTo: { select: { id: true, fullName: true } }, createdBy: { select: { id: true, fullName: true } } }, orderBy: { updatedAt: 'desc' }, take: 20 }),
    ctx.db.incident.findMany({ where: { ...where, ...(timeFilter ? { createdAt: timeFilter } : {}) }, include: { store: { select: { id: true, name: true } }, reportedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ctx.db.stockOutReport.findMany({ where: { ...where, ...(timeFilter ? { createdAt: timeFilter } : {}) }, include: { store: { select: { id: true, name: true } }, reportedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ctx.db.expiryAlert.findMany({ where: { ...where, ...(timeFilter ? { createdAt: timeFilter } : {}) }, include: { store: { select: { id: true, name: true } }, reportedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ctx.db.suggestion.findMany({ where: { ...where, ...(timeFilter ? { createdAt: timeFilter } : {}) }, include: { store: { select: { id: true, name: true } }, author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ctx.db.logEntry.findMany({ where: { ...where, isFlagged: true, resolvedAt: null, ...(timeFilter ? { createdAt: timeFilter } : {}) }, include: { store: { select: { id: true, name: true } }, author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 15 }),
  ]);
  const items = [
    ...actionLog.map((log: any) => ({
      id: `admin-${log.id}`,
      type: 'ADMIN_ACTION',
      sourceType: log.sourceType,
      sourceId: log.sourceId,
      title: log.action.replaceAll('_', ' ').toLowerCase(),
      subtitle: log.note || 'Admin action',
      store: log.store,
      actor: log.actor,
      severity: 'info',
      timestamp: log.createdAt,
      href: log.sourceType === 'PURCHASE_ORDER' && log.sourceId ? `/admin/orders/${log.sourceId}` : log.sourceType === 'USER' ? '/admin/people' : undefined,
    })),
    ...tasks.map((task: any) => ({
      id: `task-${task.id}`,
      type: 'TASK',
      sourceType: 'TASK',
      sourceId: task.id,
      title: task.title,
      subtitle: `${task.status.replaceAll('_', ' ')}${task.assignedTo ? ` · ${task.assignedTo.fullName}` : ' · unassigned'}`,
      store: task.store,
      actor: task.createdBy,
      severity: task.status === TaskStatus.NEEDS_HELP || (task.dueDate && task.dueDate < new Date()) ? 'danger' : task.status === TaskStatus.IN_REVIEW ? 'warning' : 'info',
      timestamp: task.updatedAt,
      href: `/hub/tasks/${task.id}?from=admin`,
    })),
    ...incidents.map((incident: any) => ({
      id: `incident-${incident.id}`,
      type: 'INCIDENT',
      sourceType: 'INCIDENT',
      sourceId: incident.id,
      title: incident.title,
      subtitle: `${incident.category.replaceAll('_', ' ')} · ${incident.status.replaceAll('_', ' ')}`,
      store: incident.store,
      actor: incident.reportedBy,
      severity: incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'danger' : 'warning',
      timestamp: incident.createdAt,
      href: `/tools/incidents/${incident.id}`,
    })),
    ...stockOuts.map((item: any) => ({
      id: `stock-${item.id}`,
      type: 'STOCK_OUT',
      sourceType: 'STOCK_OUT',
      sourceId: item.id,
      title: item.productName,
      subtitle: `${item.status.replaceAll('_', ' ')}${item.location ? ` · ${item.location}` : ''}`,
      store: item.store,
      actor: item.reportedBy,
      severity: item.status === StockOutStatus.REPORTED ? 'danger' : 'warning',
      timestamp: item.createdAt,
      href: `/admin?attentionType=STOCK_OUT&sourceId=${item.id}`,
    })),
    ...expiryAlerts.map((item: any) => ({
      id: `expiry-${item.id}`,
      type: 'EXPIRY_ALERT',
      sourceType: 'EXPIRY_ALERT',
      sourceId: item.id,
      title: item.productName,
      subtitle: `expires ${item.expiryDate.toLocaleDateString()} · ${item.quantity} item(s)`,
      store: item.store,
      actor: item.reportedBy,
      severity: item.expiryDate < new Date() ? 'danger' : 'warning',
      timestamp: item.createdAt,
      href: `/admin?attentionType=EXPIRY_ALERT&sourceId=${item.id}`,
    })),
    ...suggestions.map((item: any) => ({
      id: `suggestion-${item.id}`,
      type: 'SUGGESTION',
      sourceType: 'SUGGESTION',
      sourceId: item.id,
      title: item.body.slice(0, 90),
      subtitle: `${item.status.replaceAll('_', ' ')} · ${item.category}`,
      store: item.store,
      actor: item.isAnonymous ? null : item.author,
      severity: item.status === SuggestionStatus.NEW ? 'warning' : 'info',
      timestamp: item.createdAt,
      href: '/admin/suggestions',
    })),
    ...flaggedLogs.map((item: any) => ({
      id: `log-${item.id}`,
      type: 'FLAGGED_LOG',
      sourceType: 'FLAGGED_LOG',
      sourceId: item.id,
      title: item.body.slice(0, 90),
      subtitle: 'Flagged log entry',
      store: item.store,
      actor: item.author,
      severity: 'warning',
      timestamp: item.createdAt,
      href: '/hub/logbook',
    })),
  ];
  const filtered = items
    .filter((item) => !input?.type || item.type === input.type)
    .filter((item) => !input?.sourceType || item.sourceType === input.sourceType)
    .filter((item) => !input?.actorId || item.actor?.id === input.actorId)
    .filter((item) => !input?.severity || item.severity === input.severity)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, take);
  return {
    items: filtered,
    nextCursor: filtered.length === take ? filtered[filtered.length - 1].timestamp.toISOString() : null,
  };
}

export const adminRouter = router({
  summary: managerProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    const scope = await resolveAdminScope(ctx as any, input?.scope);
    return buildSummary(ctx, scope, input?.days ?? 7);
  }),

  attention: managerProcedure.input(attentionInput).query(async ({ ctx, input }) => {
    const scope = await resolveAdminScope(ctx as any, input?.scope);
    return buildAttentionItems(ctx, scope, input || undefined);
  }),

  attentionDetail: managerProcedure
    .input(z.object({ scope: z.string().optional(), type: z.string(), sourceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      return buildAttentionDetail(ctx, scope, input.type, input.sourceId);
    }),

  storeHealth: managerProcedure.input(z.object({ scope: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
    const scope = await resolveAdminScope(ctx as any, input?.scope);
    return buildStoreHealth(ctx, scope);
  }),

  storeOperations: managerProcedure
    .input(z.object({ storeId: z.string(), days: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7) }))
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.storeId);
      return buildStoreOperations(ctx, scope, input.storeId, input.days);
    }),

  actionLog: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      sourceType: z.string().optional(),
      sourceId: z.string().optional(),
      take: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      return getActionLogs(ctx, scope, input || undefined);
    }),

  supplyOverview: managerProcedure
    .input(z.object({ scope: z.string().optional(), days: z.union([z.literal(7), z.literal(30)]).default(7) }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      return buildSupplyOverview(ctx, scope, input?.days ?? 7);
    }),

  checklistHealth: managerProcedure
    .input(z.object({ scope: z.string().optional(), days: z.union([z.literal(7), z.literal(30)]).default(7) }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      return buildChecklistHealth(ctx, scope, input?.days ?? 7);
    }),

  activityFeed: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      type: z.string().optional(),
      actorId: z.string().optional(),
      sourceType: z.string().optional(),
      severity: z.enum(['danger', 'warning', 'info']).optional(),
      take: z.number().min(1).max(60).default(30),
      cursor: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      return buildActivityFeed(ctx, scope, input || undefined);
    }),

  sendDueReminders: managerProcedure
    .input(z.object({ scope: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const where = storeFilter(scope);
      const now = new Date();
      const reminderCutoff = new Date(now);
      reminderCutoff.setHours(reminderCutoff.getHours() - 12);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const due = await ctx.db.task.findMany({
        where: {
          ...where,
          status: { in: activeTaskStatuses },
          assignedToId: { not: null },
          dueDate: { lte: tomorrow },
          OR: [{ dueReminderAt: null }, { dueReminderAt: { lte: reminderCutoff } }],
        },
        select: { id: true, title: true, assignedToId: true, dueDate: true },
        take: 150,
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
        await ctx.db.task.updateMany({ where: { id: { in: due.map((task: any) => task.id) }, ...where }, data: { dueReminderAt: now } });
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

  createTaskFromAttention: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      type: z.string(),
      sourceId: z.string(),
      title: z.string().min(1).max(200),
      assignedToId: z.string().optional(),
      dueDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const { source, linkType } = await assertSource(ctx, scope, input.type, input.sourceId);
      if (linkType === TaskLinkType.LOGBOOK) {
        const existing = await ctx.db.task.findFirst({
          where: {
            storeId: source.storeId,
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
        await ctx.db.user.findFirstOrThrow({ where: { id: input.assignedToId, storeId: source.storeId, isActive: true } });
      }
      const task = await ctx.db.task.create({
        data: {
          storeId: source.storeId,
          createdById: ctx.user.id,
          assignedToId: input.assignedToId,
          title: input.title,
          priority: Priority.HIGH,
          dueDate: input.dueDate,
          category: input.type.replaceAll('_', ' ').toLowerCase(),
          links: { create: [{ type: linkType, entityId: input.sourceId, label: input.type.replaceAll('_', ' ').toLowerCase() }] },
        },
      });
      if (linkType === TaskLinkType.LOGBOOK) {
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
      }
      await ctx.db.taskUpdate.create({
        data: {
          taskId: task.id,
          authorId: ctx.user.id,
          type: TaskUpdateType.CREATED,
          body: `Created from admin attention: ${input.type.replaceAll('_', ' ').toLowerCase()}`,
          toStatus: TaskStatus.OPEN,
        },
      });
      if (task.assignedToId) {
        await ctx.db.taskUpdate.create({
          data: {
            taskId: task.id,
            authorId: ctx.user.id,
            type: TaskUpdateType.REASSIGNED,
            body: 'Assigned from admin attention',
          },
        });
        try {
          await createNotification(
            ctx.db,
            task.assignedToId,
            'TASK_ASSIGNED',
            `New task: ${task.title}`,
            `Assigned by ${ctx.user.name}`,
            `/hub/tasks/${task.id}`
          );
        } catch {}
      }
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'TASK_CREATED_FROM_ATTENTION',
        storeId: task.storeId,
        sourceType: input.type,
        sourceId: input.sourceId,
        note: task.title,
        metadata: { taskId: task.id, assignedToId: task.assignedToId },
      });
      return task;
    }),

  acknowledgeStockOut: managerProcedure
    .input(z.object({ id: z.string(), scope: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const stockOut = await ctx.db.stockOutReport.findFirstOrThrow({ where: { ...storeFilter(scope), id: input.id } });
      if (stockOut.status === StockOutStatus.RESTOCKED) return stockOut;
      const result = await ctx.db.stockOutReport.update({
        where: { id: input.id },
        data: { status: StockOutStatus.ACKNOWLEDGED },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'STOCK_OUT_ACKNOWLEDGED',
        storeId: result.storeId,
        sourceType: 'STOCK_OUT',
        sourceId: result.id,
        note: result.productName,
      });
      return result;
    }),

  markExpiryPulled: managerProcedure
    .input(z.object({ id: z.string(), scope: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      await ctx.db.expiryAlert.findFirstOrThrow({ where: { ...storeFilter(scope), id: input.id } });
      const result = await ctx.db.expiryAlert.update({
        where: { id: input.id },
        data: { status: ExpiryStatus.PULLED },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'EXPIRY_MARKED_PULLED',
        storeId: result.storeId,
        sourceType: 'EXPIRY_ALERT',
        sourceId: result.id,
        note: result.productName,
      });
      return result;
    }),

  respondToSuggestion: managerProcedure
    .input(z.object({
      id: z.string(),
      response: z.string().min(1).max(1000),
      status: z.nativeEnum(SuggestionStatus).default(SuggestionStatus.REVIEWED),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const suggestion = await ctx.db.suggestion.findFirstOrThrow({ where: { ...storeFilter(scope), id: input.id } });
      const result = await ctx.db.suggestion.update({
        where: { id: input.id },
        data: { response: input.response, status: input.status, respondedById: ctx.user.id, respondedAt: new Date() },
      });
      if (suggestion.authorId) {
        try {
          await createNotification(ctx.db, suggestion.authorId, 'SUGGESTION_RESPONSE', 'Your suggestion got a response', input.response.substring(0, 100), '/hub/suggestions');
        } catch {}
      }
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'SUGGESTION_RESPONDED',
        storeId: result.storeId,
        sourceType: 'SUGGESTION',
        sourceId: result.id,
        note: input.response.substring(0, 140),
        metadata: { status: input.status },
      });
      return result;
    }),
});
