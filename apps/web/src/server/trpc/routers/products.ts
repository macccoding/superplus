import { z } from 'zod';
import { router, protectedProcedure, supervisorProcedure, managerProcedure } from '../init';
import { StockStatus } from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';

export const productsRouter = router({
  search: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      categoryId: z.string().optional(),
      stockStatus: z.nativeEnum(StockStatus).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { storeId: ctx.storeId, isActive: true };

      if (input.categoryId) where.categoryId = input.categoryId;
      if (input.stockStatus) where.stockStatus = input.stockStatus;

      if (input.query) {
        const q = input.query.trim();
        if (/^\d{8,13}$/.test(q)) {
          where.barcode = q;
        } else {
          where.name = { contains: q, mode: 'insensitive' };
        }
      }

      const items = await ctx.db.product.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy: { name: 'asc' },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next!.id;
      }

      return { items, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findFirstOrThrow({
        where: { id: input.id, storeId: ctx.storeId },
        include: { category: true },
      });

      const isSupervisor = hasMinRole(ctx.user.role as Role, 'SUPERVISOR');

      if (!isSupervisor) {
        return {
          ...product,
          costPrice: null,
          markupPercent: null,
          supplier: null,
        };
      }

      return product;
    }),

  create: supervisorProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      barcode: z.string().max(13).optional(),
      sku: z.string().max(50).optional(),
      categoryId: z.string().optional(),
      costPrice: z.number().min(0),
      retailPrice: z.number().min(0),
      markupPercent: z.number(),
      useCustomMarkup: z.boolean().default(false),
      location: z.string().max(100).optional(),
      supplier: z.string().max(100).optional(),
      stockStatus: z.nativeEnum(StockStatus).default(StockStatus.IN_STOCK),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.product.create({
        data: { ...input, storeId: ctx.storeId },
      });
    }),

  update: supervisorProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      barcode: z.string().max(13).nullable().optional(),
      sku: z.string().max(50).nullable().optional(),
      categoryId: z.string().nullable().optional(),
      costPrice: z.number().min(0).optional(),
      retailPrice: z.number().min(0).optional(),
      markupPercent: z.number().optional(),
      useCustomMarkup: z.boolean().optional(),
      location: z.string().max(100).nullable().optional(),
      supplier: z.string().max(100).nullable().optional(),
      stockStatus: z.nativeEnum(StockStatus).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.product.update({
        where: { id, storeId: ctx.storeId },
        data,
      });
    }),

  importBatch: managerProcedure
    .input(z.object({
      products: z.array(z.object({
        name: z.string().min(1),
        barcode: z.string().optional(),
        sku: z.string().optional(),
        categoryName: z.string().optional(),
        costPrice: z.number().min(0),
        retailPrice: z.number().min(0),
        markupPercent: z.number().optional(),
        location: z.string().optional(),
        supplier: z.string().optional(),
      })).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      let imported = 0;
      const errors: { row: number; reason: string }[] = [];

      await ctx.db.$transaction(async (tx) => {
        // Pre-fetch/create categories
        const categoryMap = new Map<string, string>();
        for (const p of input.products) {
          if (p.categoryName && !categoryMap.has(p.categoryName)) {
            let cat = await tx.category.findUnique({
              where: { storeId_name: { storeId: ctx.storeId, name: p.categoryName } },
            });
            if (!cat) {
              cat = await tx.category.create({
                data: { storeId: ctx.storeId, name: p.categoryName, defaultMarkupPercent: 0 },
              });
            }
            categoryMap.set(p.categoryName, cat.id);
          }
        }

        for (let i = 0; i < input.products.length; i++) {
          const p = input.products[i];
          try {
            const markupPercent = p.markupPercent ?? (p.costPrice > 0 ? ((p.retailPrice - p.costPrice) / p.costPrice) * 100 : 0);
            await tx.product.create({
              data: {
                storeId: ctx.storeId,
                name: p.name,
                barcode: p.barcode || null,
                sku: p.sku || null,
                categoryId: p.categoryName ? categoryMap.get(p.categoryName) : null,
                costPrice: p.costPrice,
                retailPrice: p.retailPrice,
                markupPercent,
                location: p.location || null,
                supplier: p.supplier || null,
              },
            });
            imported++;
          } catch (err: any) {
            errors.push({ row: i + 1, reason: err.message?.includes('Unique') ? 'Duplicate barcode' : err.message || 'Unknown error' });
          }
        }
      });

      return { imported, errors };
    }),
});
