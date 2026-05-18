import { router, managerProcedure } from '../init';
import { z } from 'zod';
import { TaskStatus, ChecklistItemStatus, ExpiryStatus, IncidentStatus } from '@superplus/db';

export const reportsRouter = router({
  taskPerformance: managerProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const now = new Date();
      const [created, completed, needsHelp, overdue] = await Promise.all([
        ctx.db.task.count({ where: { storeId: ctx.storeId, createdAt: { gte: since } } }),
        ctx.db.task.count({ where: { storeId: ctx.storeId, status: TaskStatus.DONE, completedAt: { gte: since } } }),
        ctx.db.task.count({ where: { storeId: ctx.storeId, status: TaskStatus.NEEDS_HELP } }),
        ctx.db.task.count({
          where: {
            storeId: ctx.storeId,
            dueDate: { lt: now },
            status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          },
        }),
      ]);

      const rate = created > 0 ? Math.round((completed / created) * 100) : 0;

      const topStaffRaw = await ctx.db.task.groupBy({
        by: ['assignedToId'],
        where: { storeId: ctx.storeId, status: TaskStatus.DONE, completedAt: { gte: since }, assignedToId: { not: null } },
        _count: true,
        orderBy: { _count: { assignedToId: 'desc' } },
        take: 5,
      });
      const topStaffIds = topStaffRaw.map(s => s.assignedToId!);
      const topStaffUsers = await ctx.db.user.findMany({ where: { id: { in: topStaffIds } }, select: { id: true, fullName: true } });
      const topStaff = topStaffRaw.map(s => ({
        name: topStaffUsers.find(u => u.id === s.assignedToId)?.fullName || 'Unknown',
        count: s._count,
      }));

      const completedTasks = await ctx.db.task.findMany({
        where: { storeId: ctx.storeId, status: TaskStatus.DONE, completedAt: { gte: since } },
        select: { createdAt: true, completedAt: true },
        take: 200,
      });
      const avgCompletionHours = completedTasks.length > 0
        ? Math.round(completedTasks.reduce((sum, task) => sum + ((task.completedAt!.getTime() - task.createdAt.getTime()) / 3600000), 0) / completedTasks.length)
        : null;

      const bottlenecksRaw = await ctx.db.task.groupBy({
        by: ['workArea'],
        where: {
          storeId: ctx.storeId,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.NEEDS_HELP, TaskStatus.IN_REVIEW] },
          workArea: { not: null },
        },
        _count: true,
        orderBy: { _count: { workArea: 'desc' } },
        take: 5,
      });
      const bottlenecks = bottlenecksRaw.map(item => ({ workArea: item.workArea || 'Unknown', count: item._count }));

      return { created, completed, rate, topStaff, needsHelp, overdue, avgCompletionHours, bottlenecks };
    }),

  checklistCompliance: managerProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissions = await ctx.db.checklistSubmission.findMany({
      where: { storeId: ctx.storeId, date: { gte: thirtyDaysAgo } },
      include: { items: { include: { templateItem: true } } },
      take: 100,
    });

    const uniqueDays = new Set(submissions.map(s => new Date(s.date).toISOString().slice(0, 10))).size;
    const submissionRate = Math.min(100, Math.round((uniqueDays / 30) * 100));

    const skippedCounts = new Map<string, { label: string; count: number }>();
    for (const sub of submissions) {
      for (const item of sub.items) {
        if (item.status !== ChecklistItemStatus.DONE) {
          const label = item.label || item.templateItem?.label || 'Unknown';
          const existing = skippedCounts.get(label) || { label, count: 0 };
          existing.count++;
          skippedCounts.set(label, existing);
        }
      }
    }
    const mostSkipped = Array.from(skippedCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const avgHour = submissions.length > 0
      ? Math.round(submissions.reduce((sum, s) => sum + new Date(s.completedAt).getHours(), 0) / submissions.length)
      : null;
    const avgTime = avgHour !== null ? `${avgHour > 12 ? avgHour - 12 : avgHour}:00 ${avgHour >= 12 ? 'PM' : 'AM'}` : null;

    return { submissionRate, totalSubmissions: submissions.length, mostSkipped, avgTime };
  }),

  stockAndExpiry: managerProcedure.query(async ({ ctx }) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [activeAlerts, stockOutsThisWeek, topStockOuts] = await Promise.all([
      ctx.db.expiryAlert.count({ where: { storeId: ctx.storeId, status: ExpiryStatus.ACTIVE } }),
      ctx.db.stockOutReport.count({ where: { storeId: ctx.storeId, createdAt: { gte: weekAgo } } }),
      ctx.db.stockOutReport.groupBy({
        by: ['productName'],
        where: { storeId: ctx.storeId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        _count: true,
        orderBy: { _count: { productName: 'desc' } },
        take: 5,
      }),
    ]);

    const restocked = await ctx.db.stockOutReport.findMany({
      where: { storeId: ctx.storeId, status: 'RESTOCKED', resolvedAt: { not: null }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { createdAt: true, resolvedAt: true },
    });
    const avgRestockHours = restocked.length > 0
      ? Math.round(restocked.reduce((sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3600000, 0) / restocked.length)
      : null;

    return {
      activeAlerts,
      stockOutsThisWeek,
      topStockOuts: topStockOuts.map(t => ({ productName: t.productName, count: t._count })),
      avgRestockHours,
    };
  }),

  incidents: managerProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [openByCategory, thisMonth, lastMonth] = await Promise.all([
      ctx.db.incident.groupBy({
        by: ['category'],
        where: { storeId: ctx.storeId, status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] } },
        _count: true,
      }),
      ctx.db.incident.count({ where: { storeId: ctx.storeId, createdAt: { gte: thirtyDaysAgo } } }),
      ctx.db.incident.count({ where: { storeId: ctx.storeId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    ]);

    const resolved = await ctx.db.incident.findMany({
      where: { storeId: ctx.storeId, status: { in: ['RESOLVED', 'CLOSED'] }, resolvedAt: { not: null }, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, resolvedAt: true },
    });
    const avgResolutionHours = resolved.length > 0
      ? Math.round(resolved.reduce((sum, i) => sum + (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 3600000, 0) / resolved.length)
      : null;

    return {
      openByCategory: openByCategory.map(g => ({ category: g.category, count: g._count })),
      thisMonth,
      lastMonth,
      avgResolutionHours,
    };
  }),
});
