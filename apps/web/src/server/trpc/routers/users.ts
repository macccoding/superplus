import { z } from 'zod';
import { router, publicProcedure, protectedProcedure, managerProcedure } from '../init';
import { JobLane, Role } from '@superplus/db';
import { ROLE_HIERARCHY, hasMinRole } from '@superplus/config';
import type { Role as ConfigRole } from '@superplus/config';
import { TRPCError } from '@trpc/server';
import { compare, hash } from 'bcryptjs';
import { adminStoreIdWhere, adminStoreWhere, resolveAdminScope } from './admin-scope';
import { activeTaskStatuses } from './tasks-policy';
import { logAdminAction } from './admin-audit';

const staffProfileSelect = {
  preferredName: true,
  birthdayMonth: true,
  birthdayDay: true,
  favoriteColor: true,
  favoriteTreat: true,
  dreamGoal: true,
  proudMoment: true,
  learningInterest: true,
  celebrationPreference: true,
  showBirthday: true,
  profileUpdatedAt: true,
};

const myProfileInput = z.object({
  preferredName: z.string().trim().max(60).optional().nullable(),
  birthdayMonth: z.number().int().min(1).max(12).optional().nullable(),
  birthdayDay: z.number().int().min(1).max(31).optional().nullable(),
  favoriteColor: z.string().trim().max(40).optional().nullable(),
  favoriteTreat: z.string().trim().max(80).optional().nullable(),
  dreamGoal: z.string().trim().max(240).optional().nullable(),
  proudMoment: z.string().trim().max(240).optional().nullable(),
  learningInterest: z.string().trim().max(160).optional().nullable(),
  celebrationPreference: z.string().trim().max(120).optional().nullable(),
  showBirthday: z.boolean().optional(),
}).refine((input) => {
  if (!input.birthdayMonth && !input.birthdayDay) return true;
  if (!input.birthdayMonth || !input.birthdayDay) return false;
  return input.birthdayDay <= daysInMonth(input.birthdayMonth);
}, { message: 'Enter a valid birthday month and day' });

function cleanOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function daysInMonth(month: number) {
  return new Date(2024, month, 0).getDate();
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getProfileCompletion(user: any) {
  const fields = [
    user.preferredName,
    user.favoriteColor,
    user.favoriteTreat,
    user.dreamGoal,
    user.learningInterest,
    user.celebrationPreference,
  ];
  const completed = fields.filter(hasText).length + (user.birthdayMonth && user.birthdayDay ? 1 : 0);
  return {
    completed,
    total: 7,
    percent: Math.round((completed / 7) * 100),
    isComplete: completed >= 5,
  };
}

function nextBirthdayDistance(user: any, now = new Date()) {
  if (!user.showBirthday || !user.birthdayMonth || !user.birthdayDay) return null;
  const year = now.getFullYear();
  const birthdayThisYear = new Date(year, user.birthdayMonth - 1, user.birthdayDay);
  const birthday = birthdayThisYear < startOfDay(now)
    ? new Date(year + 1, user.birthdayMonth - 1, user.birthdayDay)
    : birthdayThisYear;
  const daysUntil = Math.ceil((birthday.getTime() - startOfDay(now).getTime()) / 86400000);
  return { date: birthday, daysUntil };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sanitizeManagerProfile(user: any) {
  if (user.showBirthday !== false) return user;
  return {
    ...user,
    birthdayMonth: null,
    birthdayDay: null,
    nextBirthdayDays: null,
  };
}

export const usersRouter = router({
  loginStores: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.store.findMany({
      where: { isActive: true, launchEnabled: true },
      select: { id: true, name: true, parish: true, address: true },
      orderBy: { name: 'asc' },
    });
  }),

  loginList: publicProcedure
    .input(z.object({ storeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const where: any = { isActive: true };
    if (input?.storeId) {
      where.storeId = input.storeId;
      where.store = { isActive: true, launchEnabled: true };
    } else {
      where.store = { isActive: true, launchEnabled: true };
    }
    const users = await ctx.db.user.findMany({
      where,
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
          mustChangePin: true, pinChangedAt: true,
          onboardedAt: true, onboardingVersion: true,
          ...staffProfileSelect,
          store: { select: { id: true, name: true, parish: true, address: true } },
        },
      });
    }),

  updateMyProfile: protectedProcedure
    .input(myProfileInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: {
          preferredName: cleanOptionalText(input.preferredName),
          birthdayMonth: input.birthdayMonth ?? null,
          birthdayDay: input.birthdayDay ?? null,
          favoriteColor: cleanOptionalText(input.favoriteColor),
          favoriteTreat: cleanOptionalText(input.favoriteTreat),
          dreamGoal: cleanOptionalText(input.dreamGoal),
          proudMoment: cleanOptionalText(input.proudMoment),
          learningInterest: cleanOptionalText(input.learningInterest),
          celebrationPreference: cleanOptionalText(input.celebrationPreference),
          showBirthday: input.showBirthday ?? true,
          profileUpdatedAt: new Date(),
        },
        select: {
          id: true,
          fullName: true,
          ...staffProfileSelect,
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
      const users = await ctx.db.user.findMany({
        where,
        select: {
          id: true, fullName: true, phone: true, role: true, jobLane: true,
          storeId: true, isActive: true, createdAt: true, mustChangePin: true, pinChangedAt: true,
          ...staffProfileSelect,
          store: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
      });
      return users.map(sanitizeManagerProfile);
    }),

  staffOperations: managerProcedure
    .input(z.object({ scope: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const storeIdWhere = adminStoreIdWhere(scope);
      const [users, activeTasks, recentActions] = await Promise.all([
        ctx.db.user.findMany({
          where: { storeId: storeIdWhere },
          select: { id: true, fullName: true, phone: true, role: true, jobLane: true, storeId: true, isActive: true, createdAt: true, mustChangePin: true, pinChangedAt: true, ...staffProfileSelect, store: { select: { id: true, name: true } } },
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
      const staff = users.map((user: any) => {
        const profileCompletion = getProfileCompletion(user);
        const birthday = nextBirthdayDistance(user);
        return {
          ...sanitizeManagerProfile(user),
          profileCompletion,
          nextBirthdayDays: birthday?.daysUntil ?? null,
          workload: taskCounts.get(user.id) ?? { active: 0, overdue: 0, help: 0, lastActivity: null },
        };
      });
      const upcomingBirthdays = staff
        .filter((user: any) => user.nextBirthdayDays !== null && user.nextBirthdayDays <= 30)
        .sort((a: any, b: any) => a.nextBirthdayDays - b.nextBirthdayDays)
        .slice(0, 8);
      return {
        summary: {
          active: users.filter((user: any) => user.isActive).length,
          inactive: users.filter((user: any) => !user.isActive).length,
          managers: users.filter((user: any) => user.role === Role.MANAGER || user.role === Role.OWNER).length,
          supervisors: users.filter((user: any) => user.role === Role.SUPERVISOR).length,
          unassigned,
          overloaded: staff.filter((user: any) => user.workload.active >= 6 || user.workload.overdue > 0 || user.workload.help > 0).length,
          profilesComplete: staff.filter((user: any) => user.profileCompletion.isComplete).length,
          profilesMissing: staff.filter((user: any) => !user.profileUpdatedAt).length,
          upcomingBirthdays: upcomingBirthdays.length,
        },
        staff,
        upcomingBirthdays,
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
          mustChangePin: true,
          onboardedAt: null,
          onboardingVersion: 0,
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

  updateStaffDetails: managerProcedure
    .input(z.object({
      id: z.string(),
      fullName: z.string().trim().min(1).max(100),
      phone: z.string().trim().min(10).max(15),
      role: z.nativeEnum(Role),
      jobLane: z.nativeEnum(JobLane),
      storeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.user.findFirstOrThrow({
        where: ctx.user.role === 'OWNER' ? { id: input.id } : { id: input.id, storeId: ctx.storeId },
      });
      const actorRole = ctx.user.role as ConfigRole;
      const targetRole = target.role as ConfigRole;
      const nextRole = input.role as ConfigRole;
      const actorRank = ROLE_HIERARCHY[actorRole];

      if (actorRole !== 'OWNER' && ROLE_HIERARCHY[targetRole] >= actorRank) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit staff with equal or higher role' });
      }
      if (actorRole !== 'OWNER' && ROLE_HIERARCHY[nextRole] >= actorRank) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot assign equal or higher role' });
      }

      const nextStoreId = actorRole === 'OWNER' && input.storeId ? input.storeId : target.storeId;
      if (actorRole !== 'OWNER' && nextStoreId !== target.storeId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Managers can only edit staff in their own store' });
      }
      if (target.id === ctx.user.id && (nextRole !== targetRole || nextStoreId !== target.storeId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot change your own role or store' });
      }
      if (actorRole === 'OWNER' && input.storeId) {
        await ctx.db.store.findFirstOrThrow({ where: { id: input.storeId, isActive: true } });
      }

      const phoneOwner = await ctx.db.user.findFirst({
        where: { phone: input.phone, NOT: { id: input.id } },
        select: { id: true },
      });
      if (phoneOwner) {
        throw new TRPCError({ code: 'CONFLICT', message: 'That phone number is already assigned to another staff member' });
      }

      const updated = await ctx.db.user.update({
        where: { id: input.id },
        data: {
          fullName: input.fullName,
          phone: input.phone,
          role: input.role,
          jobLane: input.jobLane,
          storeId: nextStoreId,
        },
        select: {
          id: true, fullName: true, phone: true, role: true, jobLane: true,
          storeId: true, isActive: true, createdAt: true,
          store: { select: { name: true } },
        },
      });
      await logAdminAction(ctx.db, ctx.user.id, nextStoreId, {
        action: 'USER_DETAILS_UPDATED',
        storeId: nextStoreId,
        sourceType: 'USER',
        sourceId: target.id,
        note: updated.fullName,
        metadata: {
          from: {
            fullName: target.fullName,
            phone: target.phone,
            role: target.role,
            jobLane: target.jobLane,
            storeId: target.storeId,
          },
          to: {
            fullName: updated.fullName,
            phone: updated.phone,
            role: updated.role,
            jobLane: updated.jobLane,
            storeId: updated.storeId,
          },
        },
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
        data: { pinHash, mustChangePin: true, pinChangedAt: null, onboardedAt: null, onboardingVersion: 0 },
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
      confirmPin: z.string().length(4).regex(/^\d{4}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.confirmPin && input.confirmPin !== input.newPin) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'PINs do not match' });
      }
      if (input.currentPin === input.newPin) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a new PIN, not the temporary PIN' });
      }
      const user = await ctx.db.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
      });
      const valid = await compare(input.currentPin, user.pinHash);
      if (!valid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Current PIN is incorrect' });

      const pinHash = await hash(input.newPin, 10);
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { pinHash, mustChangePin: false, pinChangedAt: new Date() },
        select: { id: true, fullName: true, mustChangePin: true, pinChangedAt: true },
      });
    }),

  completeOnboarding: protectedProcedure
    .input(z.object({ version: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { onboardedAt: new Date(), onboardingVersion: input.version },
        select: { id: true, onboardedAt: true, onboardingVersion: true },
      });
    }),

  resetOnboarding: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const storeIdWhere = ctx.user.role === 'OWNER' ? {} : { storeId: ctx.storeId };
      await ctx.db.user.findFirstOrThrow({
        where: { id: input.id, ...storeIdWhere },
      });
      return ctx.db.user.update({
        where: { id: input.id },
        data: { onboardedAt: null, onboardingVersion: 0 },
        select: { id: true, fullName: true },
      });
    }),
});

function defaultJobLaneForRole(role: Role): JobLane {
  return role === Role.STAFF ? JobLane.CASHIER : JobLane.SUPERVISOR;
}
