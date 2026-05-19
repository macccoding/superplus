import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, supervisorProcedure, managerProcedure } from '../init';
import { ChecklistItemStatus } from '@superplus/db';
import { adminStoreWhere, resolveAdminScope, requireSingleAdminStore } from './admin-scope';
import { logAdminAction } from './admin-audit';

function getJamaicaDate(d?: Date): Date {
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Jamaica' }).format(d ?? new Date());
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export const checklistsRouter = router({
  listTemplates: protectedProcedure
  .input(z.object({ scope: z.string().optional(), includeInactive: z.boolean().optional() }).optional())
  .query(async ({ ctx, input }) => {
    const scope = await resolveAdminScope(ctx as any, input?.scope);
    return ctx.db.checklistTemplate.findMany({
      where: { ...adminStoreWhere(scope), ...(input?.includeInactive ? {} : { isActive: true }) },
      include: { store: { select: { id: true, name: true } }, _count: { select: { items: true, submissions: true } } },
      orderBy: { name: 'asc' },
    });
  }),

  getTemplate: protectedProcedure
    .input(z.object({ id: z.string(), scope: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      return ctx.db.checklistTemplate.findFirstOrThrow({
        where: { ...adminStoreWhere(scope), id: input.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    }),

  createTemplate: managerProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      items: z.array(z.object({
        label: z.string().min(1).max(200),
        isRequired: z.boolean().default(true),
      })),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const storeId = requireSingleAdminStore(scope);
      const template = await ctx.db.checklistTemplate.create({
        data: {
          storeId,
          name: input.name,
          items: {
            create: input.items.map((item, i) => ({
              label: item.label,
              sortOrder: i,
              isRequired: item.isRequired,
            })),
          },
        },
        include: { items: true },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'CHECKLIST_TEMPLATE_CREATED',
        storeId,
        sourceType: 'CHECKLIST',
        sourceId: template.id,
        note: template.name,
        metadata: { itemCount: input.items.length },
      });
      return template;
    }),

  updateTemplate: managerProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      items: z.array(z.object({
        id: z.string().optional(),
        label: z.string().min(1).max(200),
        isRequired: z.boolean().default(true),
      })).optional(),
      isActive: z.boolean().optional(),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const { id, items, scope: _scope, ...data } = input;

      // Verify ownership first
      const current = await ctx.db.checklistTemplate.findFirstOrThrow({
        where: { ...adminStoreWhere(scope), id },
      });

      if (items) {
        await ctx.db.$transaction([
          ctx.db.checklistTemplateItem.deleteMany({ where: { templateId: id, template: { storeId: current.storeId } } }),
          ctx.db.checklistTemplateItem.createMany({
            data: items.map((item, i) => ({ templateId: id, label: item.label, sortOrder: i, isRequired: item.isRequired })),
          }),
        ]);
      }

      const template = await ctx.db.checklistTemplate.update({
        where: { id },
        data,
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: data.isActive === false ? 'CHECKLIST_TEMPLATE_ARCHIVED' : 'CHECKLIST_TEMPLATE_UPDATED',
        storeId: current.storeId,
        sourceType: 'CHECKLIST',
        sourceId: template.id,
        note: template.name,
        metadata: { itemCount: items?.length },
      });
      return template;
    }),

  todayStatus: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const today = getJamaicaDate();
      const submission = await ctx.db.checklistSubmission.findUnique({
        where: {
          storeId_templateId_date: {
            storeId: ctx.storeId,
            templateId: input.templateId,
            date: today,
          },
        },
        include: { submittedBy: true },
      });
      return submission;
    }),

  submit: supervisorProcedure
    .input(z.object({
      templateId: z.string(),
      items: z.array(z.object({
        templateItemId: z.string(),
        status: z.nativeEnum(ChecklistItemStatus),
        reason: z.string().optional(),
      })),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate: non-DONE items must have a reason
      for (const item of input.items) {
        if (item.status !== ChecklistItemStatus.DONE && !item.reason?.trim()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Skipped or N/A items must have a reason',
          });
        }
      }

      // Verify template belongs to store and get items for label snapshot
      const template = await ctx.db.checklistTemplate.findFirstOrThrow({
        where: { id: input.templateId, storeId: ctx.storeId },
        include: { items: true },
      });

      // Validate all items are covered
      if (input.items.length !== template.items.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'All checklist items must be addressed',
        });
      }

      const submittedIds = new Set(input.items.map(i => i.templateItemId));
      const templateIds = new Set(template.items.map(i => i.id));
      if (submittedIds.size !== templateIds.size || [...submittedIds].some(id => !templateIds.has(id))) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Submitted items do not match template items' });
      }

      const today = getJamaicaDate();

      // Build label map for snapshot
      const labelMap = new Map(template.items.map(i => [i.id, i.label]));

      try {
        return await ctx.db.checklistSubmission.create({
          data: {
            storeId: ctx.storeId,
            templateId: input.templateId,
            submittedById: ctx.user.id,
            date: today,
            notes: input.notes,
            items: {
              create: input.items.map((item) => ({
                templateItemId: item.templateItemId,
                status: item.status,
                reason: item.reason || null,
                label: labelMap.get(item.templateItemId) || 'Unknown item',
              })),
            },
          },
          include: { items: true },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Checklist already submitted for today',
          });
        }
        throw err;
      }
    }),

  listSubmissions: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      templateId: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      status: z.enum(['COMPLETE', 'ISSUES']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const where: any = adminStoreWhere(scope);
      if (input?.templateId) where.templateId = input.templateId;
      if (input?.dateFrom || input?.dateTo) {
        where.date = {};
        if (input?.dateFrom) where.date.gte = input.dateFrom;
        if (input?.dateTo) where.date.lte = input.dateTo;
      }

      return ctx.db.checklistSubmission.findMany({
        where,
        include: {
          store: { select: { id: true, name: true } },
          template: true,
          submittedBy: { select: { id: true, fullName: true, role: true } },
          items: { include: { templateItem: true } },
        },
        orderBy: { date: 'desc' },
        take: 50,
      }).then((submissions: any[]) => submissions.filter((submission) => {
        if (!input?.status) return true;
        const hasIssues = submission.items.some((item: any) => item.status !== ChecklistItemStatus.DONE);
        return input.status === 'ISSUES' ? hasIssues : !hasIssues;
      }));
    }),

  getSubmission: managerProcedure
    .input(z.object({ id: z.string(), scope: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      return ctx.db.checklistSubmission.findFirstOrThrow({
        where: { ...adminStoreWhere(scope), id: input.id },
        include: {
          store: { select: { id: true, name: true } },
          template: true,
          submittedBy: true,
          items: { include: { templateItem: true }, orderBy: { templateItem: { sortOrder: 'asc' } } },
        },
      });
    }),
});
