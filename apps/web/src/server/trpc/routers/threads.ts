import { z } from 'zod';
import { router, protectedProcedure } from '../init';
import { ThreadCategory } from '@superplus/db';

export const threadsRouter = router({
  list: protectedProcedure
    .input(z.object({
      category: z.nativeEnum(ThreadCategory).optional(),
      pinnedOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { storeId: ctx.storeId };
      if (input?.category) where.category = input.category;
      if (input?.pinnedOnly) where.isPinned = true;

      return ctx.db.thread.findMany({
        where,
        include: {
          author: true,
          _count: { select: { messages: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.thread.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: {
          author: true,
          messages: {
            include: { author: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      category: z.nativeEnum(ThreadCategory).optional(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.thread.create({
        data: {
          storeId: ctx.storeId,
          authorId: ctx.user.id,
          title: input.title,
          category: input.category,
          messages: {
            create: {
              authorId: ctx.user.id,
              body: input.body,
            },
          },
        },
      });
    }),

  reply: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.thread.findFirstOrThrow({
        where: { id: input.threadId, storeId: ctx.storeId },
      });

      const message = await ctx.db.threadMessage.create({
        data: {
          threadId: input.threadId,
          authorId: ctx.user.id,
          body: input.body,
        },
      });

      await ctx.db.thread.update({
        where: { id: input.threadId },
        data: { updatedAt: new Date() },
      });

      return message;
    }),

  togglePin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.db.thread.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
      });
      return ctx.db.thread.update({
        where: { id: input.id },
        data: { isPinned: !thread.isPinned },
      });
    }),

  resolve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.thread.update({
        where: { id: input.id, storeId: ctx.storeId },
        data: { isResolved: true },
      });
    }),
});
