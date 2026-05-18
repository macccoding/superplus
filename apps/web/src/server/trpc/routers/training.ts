import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';

export const trainingRouter = router({
  listGuides: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.sOPGuide.findMany({
        where: { OR: [{ storeId: ctx.storeId }, { storeId: null }], isPublished: true, ...(input?.category ? { category: input.category } : {}) },
        include: { _count: { select: { steps: true } } },
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
      });
    }),
  getGuide: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.sOPGuide.findFirstOrThrow({
        where: { id: input.id, OR: [{ storeId: ctx.storeId }, { storeId: null }] },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      });
    }),
  createGuide: managerProcedure
    .input(z.object({
      title: z.string().min(1).max(200), category: z.string().min(1).max(50), description: z.string().max(500).optional(),
      steps: z.array(z.object({ title: z.string().min(1), content: z.string().min(1), imageUrl: z.string().url().optional() })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { steps, ...data } = input;
      return ctx.db.sOPGuide.create({
        data: { storeId: ctx.storeId, createdById: ctx.user.id, ...data, steps: { create: steps.map((s, i) => ({ ...s, stepNumber: i + 1 })) } },
        include: { steps: true },
      });
    }),
  updateGuide: managerProcedure
    .input(z.object({ id: z.string(), title: z.string().optional(), description: z.string().optional(), category: z.string().optional(),
      steps: z.array(z.object({ title: z.string().min(1), content: z.string().min(1), imageUrl: z.string().url().optional() })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, steps, ...data } = input;
      await ctx.db.sOPGuide.findFirstOrThrow({ where: { id, storeId: ctx.storeId } });

      return ctx.db.$transaction(async (tx) => {
        if (steps) {
          await tx.sOPStep.deleteMany({ where: { guideId: id } });
          await tx.sOPStep.createMany({ data: steps.map((s, i) => ({ guideId: id, ...s, stepNumber: i + 1 })) });
        }
        return tx.sOPGuide.update({ where: { id }, data, include: { steps: { orderBy: { stepNumber: 'asc' } } } });
      });
    }),
  togglePublish: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guide = await ctx.db.sOPGuide.findFirstOrThrow({ where: { id: input.id, storeId: ctx.storeId } });
      return ctx.db.sOPGuide.update({ where: { id: input.id, storeId: ctx.storeId }, data: { isPublished: !guide.isPublished } });
    }),
});
