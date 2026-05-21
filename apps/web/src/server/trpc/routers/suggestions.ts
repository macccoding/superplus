import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';
import { SuggestionCategory, SuggestionStatus } from '@superplus/db';
import { createNotification, notifyByRole } from '../../notifications';
import { logAdminAction } from './admin-audit';
import { adminStoreWhere, resolveAdminScope } from './admin-scope';

export const suggestionsRouter = router({
  submit: protectedProcedure
    .input(z.object({ body: z.string().min(1).max(2000), category: z.nativeEnum(SuggestionCategory).default(SuggestionCategory.GENERAL), isAnonymous: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.suggestion.create({
        data: { storeId: ctx.storeId, body: input.body, category: input.category, isAnonymous: input.isAnonymous, authorId: input.isAnonymous ? null : ctx.user.id },
      });
      try {
        await notifyByRole(
          ctx.db,
          ctx.storeId,
          ['MANAGER', 'OWNER'],
          'GENERAL',
          input.body.trim().toUpperCase().startsWith('URGENT')
            ? 'Urgent staff report'
            : input.isAnonymous ? 'New anonymous staff report' : 'New staff report',
          `${input.category.toLowerCase()} report submitted`,
          '/admin/suggestions'
        );
      } catch {}
      return result;
    }),
  myList: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.suggestion.findMany({ where: { authorId: ctx.user.id }, orderBy: { createdAt: 'desc' }, take: 20 });
  }),
  listAll: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      status: z.nativeEnum(SuggestionStatus).optional(),
      category: z.nativeEnum(SuggestionCategory).optional(),
      search: z.string().max(120).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const where: any = { ...adminStoreWhere(scope) };
      if (input?.status) where.status = input.status;
      if (input?.category) where.category = input.category;
      if (input?.search?.trim()) where.body = { contains: input.search.trim(), mode: 'insensitive' };
      const suggestions = await ctx.db.suggestion.findMany({
        where,
        include: {
          store: { select: { id: true, name: true } },
          author: { select: { id: true, fullName: true } },
          respondedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' }, take: 50,
      });
      return suggestions.map((suggestion: any) => ({
        ...suggestion,
        author: suggestion.isAnonymous ? null : suggestion.author,
      }));
    }),
  respond: managerProcedure
    .input(z.object({ id: z.string(), response: z.string().min(1).max(1000), status: z.nativeEnum(SuggestionStatus), scope: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const suggestion = await ctx.db.suggestion.findFirstOrThrow({
        where: { ...adminStoreWhere(scope), id: input.id },
      });
      const result = await ctx.db.suggestion.update({
        where: { id: input.id },
        data: { response: input.response, status: input.status, respondedById: ctx.user.id, respondedAt: new Date() },
      });
      if (suggestion?.authorId) {
        try {
          await createNotification(ctx.db, suggestion.authorId, 'SUGGESTION_RESPONSE', 'Your suggestion got a response', input.response.substring(0, 100), '/hub/suggestions');
        } catch {}
      }
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'SUGGESTION_RESPONDED',
        storeId: result.storeId,
        sourceType: 'SUGGESTION',
        sourceId: result.id,
        note: input.response.substring(0, 140),
        metadata: { status: input.status },
      });
      return result;
    }),
});
