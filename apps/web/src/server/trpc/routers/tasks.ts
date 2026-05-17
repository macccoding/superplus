import { z } from 'zod';
import { router, protectedProcedure, supervisorProcedure } from '../init';
import { TaskStatus, Priority } from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';
import { TRPCError } from '@trpc/server';

export const tasksRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.nativeEnum(TaskStatus).optional(),
      assignedToMe: z.boolean().optional(),
      unassigned: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { storeId: ctx.storeId };
      if (input?.status) where.status = input.status;
      if (input?.assignedToMe) where.assignedToId = ctx.user.id;
      if (input?.unassigned) where.assignedToId = null;

      return ctx.db.task.findMany({
        where,
        include: { createdBy: true, assignedTo: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.task.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: { createdBy: true, assignedTo: true },
      });
    }),

  create: supervisorProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      category: z.string().max(50).optional(),
      assignedToId: z.string().optional(),
      priority: z.nativeEnum(Priority).optional(),
      dueDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.assignedToId) {
        await ctx.db.user.findFirstOrThrow({
          where: { id: input.assignedToId, storeId: ctx.storeId },
        });
      }
      return ctx.db.task.create({
        data: {
          ...input,
          storeId: ctx.storeId,
          createdById: ctx.user.id,
        },
      });
    }),

  pickup: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.update({
        where: { id: input.id, storeId: ctx.storeId, assignedToId: null },
        data: { assignedToId: ctx.user.id, status: TaskStatus.IN_PROGRESS },
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string(),
      status: z.nativeEnum(TaskStatus),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });

      if (ctx.user.role === 'STAFF' && task.assignedToId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only update tasks assigned to you' });
      }

      if (input.status === 'CANCELLED' && !hasMinRole(ctx.user.role as Role, 'SUPERVISOR')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only supervisors can cancel tasks' });
      }

      const data: any = { status: input.status };
      if (input.status === TaskStatus.DONE) {
        data.completedAt = new Date();
      }
      return ctx.db.task.update({
        where: { id: input.id, storeId: ctx.storeId },
        data,
      });
    }),
});
