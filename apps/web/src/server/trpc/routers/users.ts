import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, managerProcedure } from '../init';
import { JobLane, Role } from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role as ConfigRole } from '@superplus/config';
import { TRPCError } from '@trpc/server';
import { hash } from 'bcryptjs';
import { adminStoreIdWhere, adminStoreWhere, resolveAdminScope } from './admin-scope';
import { activeTaskStatuses } from './tasks-policy';
import { logAdminAction } from './admin-audit';

export const usersRouter = router({
  loginList: publicProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        role: true,
        store: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    return users.map(u => ({
      loginId: u.id,
      fullName: u.fullName,
      firstName: u.fullName.split(' ')[0],
      initials: u.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
      role: u.role,
      storeName: u.store.name,
    }));
  }),

  me: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        select: {
          id: true, fullName: true, phone: true, role: true, jobLane: true,
          storeId: true, isActive: true, createdAt: true,
          store: { select: { id: true, name: true, parish: true, address: true } },
        },
      });
    }),

  list: managerProcedure
    .input(z.object({
      storeId: z.string().optional(),
      scope: z.string().optional(),
      role: z.nativeEnum(Role).optional(),
      jobLane: z.nativeEnum(JobLane).optional(),
      isActive: z.boolean().optional(),
      search: z.string().max(100).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope ?? input?.storeId);
      const where: any = adminStoreWhere(scope);
      if (input?.role) where.role = input.role;
      if (input?.jobLane) where.jobLane = input.jobLane;
      if (typeof input?.isActive === 'boolean') where.isActive = input.isActive;
      if (input?.search?.trim()) {
        const search = input.search.trim();
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
      return ctx.db.user.findMany({
        where,
        select: {
          id: true, fullName: true, phone: true, role: true, jobLane: true,
          storeId: true, isActive: true, createdAt: true,
          store: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
      });
    }),

  staffOperations: managerProcedure
    .input(z.object({ scope: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const storeIdWhere = adminStoreIdWhere(scope);
      const [users, activeTasks, recentActions] = await Promise.all([
        ctx.db.user.findMany({
          where: { storeId: storeIdWhere },
          select: { id: true, fullName: true, phone: true, role: true, jobLane: true, storeId: true, isActive: true, createdAt: true, store: { select: { id: true, name: true } } },
          orderBy: { fullName: 'asc' },
        }),
        ctx.db.task.findMany({
          where: { storeId: storeIdWhere, status: { in: activeTaskStatuses } },
          select: { id: true, title: true, assignedToId: true, status: true, dueDate: true, updatedAt: true },
          take: 1000,
        }),
        ctx.db.adminActionLog?.findMany ? ctx.db.adminActionLog.findMany({
          where: scope.isAllStores ? { OR: [{ storeId: { in: scope.storeIds } }, { storeId: null }] } : { storeId: scope.storeIds[0] },
          include: { actor: { select: { id: true, fullName: true } }, store: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }) : [],
      ]);
      const now = new Date();
      const taskCounts = new Map<string, { active: number; overdue: number; help: number; lastActivity?: Date }>();
      let unassigned = 0;
      for (const task of activeTasks as any[]) {
        if (!task.assignedToId) {
          unassigned++;
          continue;
        }
        const current = taskCounts.get(task.assignedToId) ?? { active: 0, overdue: 0, help: 0 };
        current.active++;
        if (task.dueDate && task.dueDate < now) current.overdue++;
        if (task.status === 'NEEDS_HELP') current.help++;
        if (!current.lastActivity || task.updatedAt > current.lastActivity) current.lastActivity = task.updatedAt;
        taskCounts.set(task.assignedToId, current);
      }
      const staff = users.map((user: any) => ({
        ...user,
        workload: taskCounts.get(user.id) ?? { active: 0, overdue: 0, help: 0, lastActivity: null },
      }));
      return {
        summary: {
          active: users.filter((user: any) => user.isActive).length,
          inactive: users.filter((user: any) => !user.isActive).length,
          managers: users.filter((user: any) => user.role === Role.MANAGER || user.role === Role.OWNER).length,
          supervisors: users.filter((user: any) => user.role === Role.SUPERVISOR).length,
          unassigned,
          overloaded: staff.filter((user: any) => user.workload.active >= 6 || user.workload.overdue > 0 || user.workload.help > 0).length,
        },
        staff,
        recentActions,
      };
    }),

  create: managerProcedure
    .input(z.object({
      fullName: z.string().min(1).max(100),
      phone: z.string().min(10).max(15),
      pin: z.string().length(4).regex(/^\d{4}$/),
      role: z.nativeEnum(Role),
      jobLane: z.nativeEnum(JobLane).optional(),
      storeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!hasMinRole(ctx.user.role as ConfigRole, input.role as ConfigRole)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot create user with higher role' });
      }
      const storeId = ctx.user.role === 'OWNER' && input.storeId ? input.storeId : ctx.storeId;
      if (ctx.user.role === 'OWNER' && input.storeId) {
        await ctx.db.store.findFirstOrThrow({ where: { id: input.storeId, isActive: true } });
      }
      const pinHash = await hash(input.pin, 10);
      const created = await ctx.db.user.create({
        data: {
          storeId,
          fullName: input.fullName,
          phone: input.phone,
          pinHash,
          role: input.role,
          jobLane: input.jobLane ?? defaultJobLaneForRole(input.role),
        },
        select: {
          id: true, fullName: true, phone: true, role: true, jobLane: true,
          storeId: true, isActive: true, createdAt: true,
        },
      });
      await logAdminAction(ctx.db, ctx.user.id, storeId, {
        action: 'USER_CREATED',
        storeId,
        sourceType: 'USER',
        sourceId: created.id,
        note: created.fullName,
        metadata: { role: created.role, jobLane: created.jobLane },
      });
      return created;
    }),

  updateJobLane: managerProcedure
    .input(z.object({
      id: z.string(),
      jobLane: z.nativeEnum(JobLane),
    }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.user.findFirstOrThrow({
        where: ctx.user.role === 'OWNER' ? { id: input.id } : { id: input.id, storeId: ctx.storeId },
      });
      if (!hasMinRole(ctx.user.role as ConfigRole, target.role as ConfigRole)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot update staff with equal or higher role' });
      }
      const updated = await ctx.db.user.update({
        where: { id: input.id },
        data: { jobLane: input.jobLane },
        select: { id: true, fullName: true, jobLane: true },
      });
      await logAdminAction(ctx.db, ctx.user.id, target.storeId, {
        action: 'USER_JOB_LANE_UPDATED',
        storeId: target.storeId,
        sourceType: 'USER',
        sourceId: target.id,
        note: target.fullName,
        metadata: { from: target.jobLane, to: input.jobLane },
      });
      return updated;
    }),

  toggleActive: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirstOrThrow({
        where: ctx.user.role === 'OWNER' ? { id: input.id } : { id: input.id, storeId: ctx.storeId },
      });
      if (user.id === ctx.user.id && user.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot deactivate your own account' });
      }
      const activeTasks = await ctx.db.task.count({ where: { assignedToId: user.id, status: { in: activeTaskStatuses } } });
      const updated = await ctx.db.user.update({
        where: { id: input.id },
        data: { isActive: !user.isActive },
        select: {
          id: true, fullName: true, phone: true, role: true,
          storeId: true, isActive: true, createdAt: true,
        },
      });
      await logAdminAction(ctx.db, ctx.user.id, user.storeId, {
        action: updated.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        storeId: user.storeId,
        sourceType: 'USER',
        sourceId: user.id,
        note: user.fullName,
        metadata: { activeTasks },
      });
      return updated;
    }),

  resetPin: managerProcedure
    .input(z.object({
      id: z.string(),
      newPin: z.string().length(4).regex(/^\d{4}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.user.findFirstOrThrow({
        where: ctx.user.role === 'OWNER' ? { id: input.id } : { id: input.id, storeId: ctx.storeId },
      });
      if (!hasMinRole(ctx.user.role as ConfigRole, target.role as ConfigRole)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot reset PIN for user with equal or higher role' });
      }
      const pinHash = await hash(input.newPin, 10);
      const updated = await ctx.db.user.update({
        where: { id: input.id },
        data: { pinHash },
        select: { id: true, fullName: true },
      });
      await logAdminAction(ctx.db, ctx.user.id, target.storeId, {
        action: 'USER_PIN_RESET',
        storeId: target.storeId,
        sourceType: 'USER',
        sourceId: target.id,
        note: target.fullName,
      });
      return updated;
    }),

  changeMyPin: protectedProcedure
    .input(z.object({
      currentPin: z.string().length(4),
      newPin: z.string().length(4).regex(/^\d{4}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
      });
      const { compare } = await import('bcryptjs');
      const valid = await compare(input.currentPin, user.pinHash);
      if (!valid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Current PIN is incorrect' });

      const pinHash = await hash(input.newPin, 10);
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { pinHash },
        select: { id: true, fullName: true },
      });
    }),
});

function defaultJobLaneForRole(role: Role): JobLane {
  return role === Role.STAFF ? JobLane.CASHIER : JobLane.SUPERVISOR;
}
