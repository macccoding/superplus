import { z } from 'zod';
import { router, managerProcedure, ownerProcedure } from '../init';
import { hash } from 'bcryptjs';
import { JobLane, Role } from '@superplus/db';
import { logAdminAction } from './admin-audit';

export const storesRouter = router({
  list: managerProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role === 'OWNER') {
        return ctx.db.store.findMany({ orderBy: { name: 'asc' } });
      }
      return ctx.db.store.findMany({
        where: { id: ctx.storeId },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.role === 'OWNER' ? input.id : ctx.storeId;
      return ctx.db.store.findUniqueOrThrow({
        where: { id: storeId },
        include: { _count: { select: { users: true, tasks: true } } },
      });
    }),

  create: ownerProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      parish: z.string().min(1).max(50),
      address: z.string().min(1).max(200),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.store.create({ data: input });
    }),

  updateConfig: managerProcedure
    .input(z.object({
      openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      openDays: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.store.update({
        where: { id: ctx.storeId },
        data: input,
      });
    }),

  prepareLaunch: managerProcedure
    .input(z.object({
      storeId: z.string().optional(),
      temporaryPin: z.string().length(4).regex(/^\d{4}$/),
      launchNotes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const storeId = ctx.user.role === 'OWNER' && input.storeId ? input.storeId : ctx.storeId;
      const store = await ctx.db.store.findFirstOrThrow({
        where: ctx.user.role === 'OWNER' ? { id: storeId, isActive: true } : { id: ctx.storeId, isActive: true },
        select: { id: true, name: true },
      });
      const pinHash = await hash(input.temporaryPin, 10);
      const result = await ctx.db.user.updateMany({
        where: { storeId: store.id, isActive: true },
        data: {
          pinHash,
          mustChangePin: true,
          pinChangedAt: null,
          onboardedAt: null,
          onboardingVersion: 0,
        },
      });
      await ctx.db.store.update({
        where: { id: store.id },
        data: {
          launchEnabled: true,
          launchedAt: new Date(),
          launchNotes: input.launchNotes?.trim() || null,
        },
      });
      await logAdminAction(ctx.db, ctx.user.id, store.id, {
        action: 'STORE_LAUNCH_PREPARED',
        storeId: store.id,
        sourceType: 'STORE',
        sourceId: store.id,
        note: store.name,
        metadata: { affectedUsers: result.count, launchNotes: input.launchNotes ?? null },
      });
      return { storeId: store.id, storeName: store.name, affectedUsers: result.count };
    }),

  prepareSantaCruzLaunch: ownerProcedure
    .mutation(async ({ ctx }) => {
      const store = await ctx.db.store.findFirstOrThrow({
        where: { name: 'SuperPlus Santa Cruz', isActive: true },
        select: { id: true, name: true },
      });
      const pinHash = await hash('1234', 10);
      const camille = await ctx.db.user.updateMany({
        where: {
          storeId: store.id,
          OR: [
            { fullName: 'SCHEDULE MANAGER' },
            { fullName: 'Camille Meyler' },
            { phone: '8763992676' },
          ],
        },
        data: {
          fullName: 'Camille Meyler',
          phone: '8763992676',
          role: Role.MANAGER,
          jobLane: JobLane.SUPERVISOR,
          isActive: true,
        },
      });
      const result = await ctx.db.user.updateMany({
        where: { storeId: store.id, isActive: true },
        data: {
          pinHash,
          mustChangePin: true,
          pinChangedAt: null,
          onboardedAt: null,
          onboardingVersion: 0,
        },
      });
      await ctx.db.store.update({
        where: { id: store.id },
        data: {
          launchEnabled: true,
          launchedAt: new Date(),
          launchNotes: 'Santa Cruz V1 launch prepared with shared temporary PIN.',
        },
      });
      await logAdminAction(ctx.db, ctx.user.id, store.id, {
        action: 'SANTA_CRUZ_LAUNCH_PREPARED',
        storeId: store.id,
        sourceType: 'STORE',
        sourceId: store.id,
        note: store.name,
        metadata: { affectedUsers: result.count, camilleUpdated: camille.count },
      });
      return { storeId: store.id, storeName: store.name, affectedUsers: result.count, camilleUpdated: camille.count };
    }),
});
