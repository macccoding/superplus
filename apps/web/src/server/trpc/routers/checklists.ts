import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, supervisorProcedure, managerProcedure } from '../init';
import { ChecklistItemStatus } from '@superplus/db';

function getJamaicaDate(): Date {
  const now = new Date();
  // Jamaica is always UTC-5
  const jamaicaOffset = -5 * 60; // minutes
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const jamaicaMs = utcMs + jamaicaOffset * 60000;
  const jamaicaDate = new Date(jamaicaMs);
  jamaicaDate.setHours(0, 0, 0, 0);
  return jamaicaDate;
}

export const checklistsRouter = router({
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.checklistTemplate.findMany({
      where: { storeId: ctx.storeId, isActive: true },
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });
  }),

  getTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.checklistTemplate.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
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
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.checklistTemplate.create({
        data: {
          storeId: ctx.storeId,
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
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...data } = input;

      // Verify ownership first
      await ctx.db.checklistTemplate.findFirstOrThrow({
        where: { id, storeId: ctx.storeId },
      });

      if (items) {
        await ctx.db.checklistTemplateItem.deleteMany({
          where: { templateId: id, template: { storeId: ctx.storeId } },
        });
        await ctx.db.checklistTemplateItem.createMany({
          data: items.map((item, i) => ({
            templateId: id,
            label: item.label,
            sortOrder: i,
            isRequired: item.isRequired,
          })),
        });
      }

      return ctx.db.checklistTemplate.update({
        where: { id, storeId: ctx.storeId },
        data,
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    }),

  todayStatus: supervisorProcedure
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
      templateId: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { storeId: ctx.storeId };
      if (input?.templateId) where.templateId = input.templateId;
      if (input?.dateFrom || input?.dateTo) {
        where.date = {};
        if (input?.dateFrom) where.date.gte = input.dateFrom;
        if (input?.dateTo) where.date.lte = input.dateTo;
      }

      return ctx.db.checklistSubmission.findMany({
        where,
        include: {
          template: true,
          submittedBy: true,
          items: { include: { templateItem: true } },
        },
        orderBy: { date: 'desc' },
        take: 50,
      });
    }),

  getSubmission: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.checklistSubmission.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: {
          template: true,
          submittedBy: true,
          items: { include: { templateItem: true }, orderBy: { templateItem: { sortOrder: 'asc' } } },
        },
      });
    }),
});
