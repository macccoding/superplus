import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { SuggestionCategory, SuggestionStatus } from '@superplus/db';

export const suggestionsRouter = router({
  submit: protectedProcedure
    .input(z.object({ body: z.string().min(1).max(2000), category: z.nativeEnum(SuggestionCategory).default(SuggestionCategory.GENERAL), isAnonymous: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.suggestion.create({
        data: { storeId: ctx.storeId, body: input.body, category: input.category, isAnonymous: input.isAnonymous, authorId: input.isAnonymous ? null : ctx.user.id },
      });
    }),
  myList: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.suggestion.findMany({ where: { authorId: ctx.user.id }, orderBy: { createdAt: 'desc' }, take: 20 });
  }),
  listAll: managerProcedure
    .input(z.object({ status: z.nativeEnum(SuggestionStatus).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.suggestion.findMany({
        where: { storeId: ctx.storeId, ...(input?.status ? { status: input.status } : {}) },
        include: { author: { select: { fullName: true } }, respondedBy: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' }, take: 50,
      });
    }),
  respond: managerProcedure
    .input(z.object({ id: z.string(), response: z.string().min(1).max(1000), status: z.nativeEnum(SuggestionStatus) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.suggestion.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: { response: input.response, status: input.status, respondedById: ctx.user.id, respondedAt: new Date() },
      });
    }),
});
