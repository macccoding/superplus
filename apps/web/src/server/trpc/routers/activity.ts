import { router, managerProcedure } from '../init';

export const activityRouter = router({
  recent: managerProcedure
    .query(async ({ ctx }) => {
      const storeFilter = ctx.user.role === 'OWNER' ? {} : { storeId: ctx.storeId };

      const [tasks, threads, logs] = await Promise.all([
        ctx.db.task.findMany({
          where: storeFilter,
          include: { createdBy: { select: { id: true, fullName: true, role: true } }, assignedTo: { select: { id: true, fullName: true, role: true } }, store: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        ctx.db.thread.findMany({
          where: storeFilter,
          include: { author: { select: { id: true, fullName: true, role: true } }, store: true, _count: { select: { messages: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        }),
        ctx.db.logEntry.findMany({
          where: { ...storeFilter, isFlagged: true, resolvedAt: null },
          include: { author: { select: { id: true, fullName: true, role: true } }, store: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      return { tasks, threads, flaggedLogs: logs };
    }),
});
