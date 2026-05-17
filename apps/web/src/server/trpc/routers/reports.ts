import { router, managerProcedure } from '../init';
import { z } from 'zod';
import { TaskStatus, ChecklistItemStatus } from '@superplus/db';

export const reportsRouter = router({
  taskPerformance: managerProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const [created, completed] = await Promise.all([
        ctx.db.task.count({ where: { storeId: ctx.storeId, createdAt: { gte: since } } }),
        ctx.db.task.count({ where: { storeId: ctx.storeId, status: TaskStatus.DONE, completedAt: { gte: since } } }),
      ]);

      const rate = created > 0 ? Math.round((completed / created) * 100) : 0;

      return { created, completed, rate };
    }),

  checklistCompliance: managerProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const submissions = await ctx.db.checklistSubmission.findMany({
      where: { storeId: ctx.storeId, date: { gte: thirtyDaysAgo } },
      include: { items: { include: { templateItem: true } } },
    });

    const submissionRate = Math.round((submissions.length / 30) * 100);

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

    return { submissionRate, totalSubmissions: submissions.length, mostSkipped };
  }),

  stockAndExpiry: managerProcedure.query(async ({ ctx }) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [activeAlerts, stockOutsThisWeek, topStockOuts] = await Promise.all([
      ctx.db.expiryAlert.count({ where: { storeId: ctx.storeId, status: 'ACTIVE' } }),
      ctx.db.stockOutReport.count({ where: { storeId: ctx.storeId, createdAt: { gte: weekAgo } } }),
      ctx.db.stockOutReport.groupBy({
        by: ['productName'],
        where: { storeId: ctx.storeId, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        _count: true,
        orderBy: { _count: { productName: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      activeAlerts,
      stockOutsThisWeek,
      topStockOuts: topStockOuts.map(t => ({ productName: t.productName, count: t._count })),
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
        where: { storeId: ctx.storeId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        _count: true,
      }),
      ctx.db.incident.count({ where: { storeId: ctx.storeId, createdAt: { gte: thirtyDaysAgo } } }),
      ctx.db.incident.count({ where: { storeId: ctx.storeId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    ]);

    return {
      openByCategory: openByCategory.map(g => ({ category: g.category, count: g._count })),
      thisMonth,
      lastMonth,
    };
  }),
});
