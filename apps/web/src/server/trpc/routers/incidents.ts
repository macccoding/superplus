import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, supervisorProcedure, managerProcedure } from '../init';
import { IncidentCategory, IncidentSeverity, IncidentStatus } from '@superplus/db';
import { notifyByRole } from '../../notifications';

export const incidentsRouter = router({
  list: supervisorProcedure
    .input(z.object({
      status: z.nativeEnum(IncidentStatus).optional(),
      category: z.nativeEnum(IncidentCategory).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { storeId: ctx.storeId };
      if (input?.status) where.status = input.status;
      if (input?.category) where.category = input.category;

      return ctx.db.incident.findMany({
        where,
        include: { reportedBy: true, resolvedBy: true },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      });
    }),

  create: supervisorProcedure
    .input(z.object({
      category: z.nativeEnum(IncidentCategory),
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      severity: z.nativeEnum(IncidentSeverity).default(IncidentSeverity.MEDIUM),
      photoUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.incident.create({
        data: {
          storeId: ctx.storeId,
          reportedById: ctx.user.id,
          ...input,
        },
      });
      if (input.severity === 'HIGH' || input.severity === 'CRITICAL') {
        try {
          await notifyByRole(ctx.db, ctx.storeId, ['MANAGER', 'OWNER'], 'INCIDENT', `Incident: ${input.title}`, input.description?.substring(0, 100), '/tools/incidents');
        } catch {}
      }
      return result;
    }),

  getById: supervisorProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.incident.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: { reportedBy: true, resolvedBy: true },
      });
    }),

  resolve: managerProcedure
    .input(z.object({
      id: z.string(),
      resolution: z.string().min(1).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.incident.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: {
          status: IncidentStatus.RESOLVED,
          resolution: input.resolution,
          resolvedById: ctx.user.id,
          resolvedAt: new Date(),
        },
      });
    }),

  close: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const incident = await ctx.db.incident.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });
      if (incident.status !== IncidentStatus.RESOLVED) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Incident must be resolved before closing' });
      }
      return ctx.db.incident.update({
        where: { id: input.id },
        data: { status: IncidentStatus.CLOSED },
      });
    }),
});
