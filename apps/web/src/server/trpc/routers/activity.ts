import { router, managerProcedure } from '../init';

export const activityRouter = router({
  recent: managerProcedure
    .query(async ({ ctx }) => {
      const storeFilter = ctx.user.role === 'OWNER' ? {} : { storeId: ctx.storeId };

      const [tasks, threads, logs] = await Promise.all([
        ctx.db.task.findMany({
          where: storeFilter,
          include: { createdBy: true, assignedTo: true, store: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        ctx.db.thread.findMany({
          where: storeFilter,
          include: { author: true, store: true, _count: { select: { messages: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        }),
        ctx.db.logEntry.findMany({
          where: { ...storeFilter, isFlagged: true },
          include: { author: true, store: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      return { tasks, threads, flaggedLogs: logs };
    }),
});
