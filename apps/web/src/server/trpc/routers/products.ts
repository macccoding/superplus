import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, supervisorProcedure, managerProcedure } from '../init';
import { StockStatus } from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';
import { adminStoreWhere, resolveAdminScope, requireSingleAdminStore } from './admin-scope';
import { logAdminAction } from './admin-audit';

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function withVisibility(product: any, canSeeSensitive: boolean, query?: string) {
  const q = query?.trim().toLowerCase();
  const matchReason = q ? getMatchReason(product, q) : undefined;
  const visible = canSeeSensitive ? product : {
    ...product,
    costPrice: null,
    markupPercent: null,
    supplier: null,
    useCustomMarkup: null,
  };
  return matchReason ? { ...visible, matchReason } : visible;
}

function getMatchReason(product: any, q: string) {
  if (!q) return undefined;
  if (product.barcode?.toLowerCase() === q) return 'Barcode match';
  if (product.sku?.toLowerCase() === q) return 'SKU match';
  if (product.sku?.toLowerCase().includes(q)) return 'SKU contains';
  if (product.brand?.toLowerCase().includes(q)) return 'Brand match';
  if (product.category?.name?.toLowerCase().includes(q)) return 'Category match';
  if (product.name?.toLowerCase().includes(q)) return 'Name match';
  return undefined;
}

export const productsRouter = router({
  search: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      categoryId: z.string().optional(),
      stockStatus: z.nativeEnum(StockStatus).optional(),
      scope: z.string().optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const where: any = { ...adminStoreWhere(scope), isActive: true };

      if (input.categoryId) where.categoryId = input.categoryId;
      if (input.stockStatus) where.stockStatus = input.stockStatus;

      if (input.query) {
        const q = input.query.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
          /^\d{8,13}$/.test(q) ? { barcode: q } : { barcode: { contains: q } },
        ];
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

      const canSeeSensitive = hasMinRole(ctx.user.role as Role, 'SUPERVISOR');
      return { items: items.map((item: any) => withVisibility(item, canSeeSensitive, input.query)), nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string(), scope: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const product = await ctx.db.product.findFirstOrThrow({
        where: { ...adminStoreWhere(scope), id: input.id },
        include: { category: true },
      });

      const isSupervisor = hasMinRole(ctx.user.role as Role, 'SUPERVISOR');

      return withVisibility(product, isSupervisor);
    }),

  create: supervisorProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      brand: z.string().max(100).optional(),
      size: z.string().max(50).optional(),
      unit: z.string().max(30).optional(),
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
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const storeId = requireSingleAdminStore(scope);
      const { scope: _scope, ...data } = input;
      if (data.categoryId) {
        await ctx.db.category.findFirstOrThrow({ where: { id: data.categoryId, storeId } });
      }
      const product = await ctx.db.product.create({
        data: {
          ...data,
          storeId,
          brand: normalizeOptional(data.brand),
          size: normalizeOptional(data.size),
          unit: normalizeOptional(data.unit),
          barcode: normalizeOptional(data.barcode),
          sku: normalizeOptional(data.sku),
          location: normalizeOptional(data.location),
          supplier: normalizeOptional(data.supplier),
        },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'PRODUCT_CREATED',
        storeId,
        sourceType: 'PRODUCT',
        sourceId: product.id,
        note: product.name,
      });
      return product;
    }),

  update: supervisorProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      brand: z.string().max(100).nullable().optional(),
      size: z.string().max(50).nullable().optional(),
      unit: z.string().max(30).nullable().optional(),
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
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const { id, scope: _scope, ...data } = input;
      const current = await ctx.db.product.findFirstOrThrow({ where: { ...adminStoreWhere(scope), id } });
      if (data.categoryId) {
        await ctx.db.category.findFirstOrThrow({ where: { id: data.categoryId, storeId: current.storeId } });
      }
      const product = await ctx.db.product.update({
        where: { id },
        data: {
          ...data,
          brand: data.brand === undefined ? undefined : normalizeOptional(data.brand),
          size: data.size === undefined ? undefined : normalizeOptional(data.size),
          unit: data.unit === undefined ? undefined : normalizeOptional(data.unit),
          barcode: data.barcode === undefined ? undefined : normalizeOptional(data.barcode),
          sku: data.sku === undefined ? undefined : normalizeOptional(data.sku),
          location: data.location === undefined ? undefined : normalizeOptional(data.location),
          supplier: data.supplier === undefined ? undefined : normalizeOptional(data.supplier),
        },
      });
      await logAdminAction(ctx.db, ctx.user.id, scope, {
        action: 'PRODUCT_UPDATED',
        storeId: current.storeId,
        sourceType: 'PRODUCT',
        sourceId: product.id,
        note: product.name,
      });
      return product;
    }),

  importBatch: managerProcedure
    .input(z.object({
      products: z.array(z.object({
        name: z.string().min(1),
        brand: z.string().optional(),
        size: z.string().optional(),
        unit: z.string().optional(),
        barcode: z.string().optional(),
        sku: z.string().optional(),
        categoryName: z.string().optional(),
        costPrice: z.number().min(0),
        retailPrice: z.number().min(0),
        markupPercent: z.number().optional(),
        location: z.string().optional(),
        supplier: z.string().optional(),
      })).max(500),
      upsert: z.boolean().default(false),
      importSource: z.string().max(100).optional(),
      scope: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input.scope);
      const storeId = requireSingleAdminStore(scope);
      let imported = 0;
      let updated = 0;
      const errors: { row: number; reason: string }[] = [];
      const duplicateRows = new Set<number>();
      const seenBarcodes = new Map<string, number>();
      const seenSkus = new Map<string, number>();
      const importSource = normalizeOptional(input.importSource) || 'CSV import';

      input.products.forEach((p, i) => {
        const row = i + 1;
        const barcode = normalizeOptional(p.barcode);
        const sku = normalizeOptional(p.sku);
        if (barcode) {
          const first = seenBarcodes.get(barcode);
          if (first) {
            duplicateRows.add(row);
            errors.push({ row, reason: `Duplicate barcode in file; first seen on row ${first}` });
          } else {
            seenBarcodes.set(barcode, row);
          }
        }
        if (sku) {
          const first = seenSkus.get(sku.toLowerCase());
          if (first) {
            duplicateRows.add(row);
            errors.push({ row, reason: `Duplicate SKU in file; first seen on row ${first}` });
          } else {
            seenSkus.set(sku.toLowerCase(), row);
          }
        }
      });

      // Pre-fetch/create categories (outside transaction — these should persist even if products fail)
      const categoryMap = new Map<string, string>();
      for (const p of input.products) {
        const categoryName = normalizeOptional(p.categoryName);
        if (categoryName && !categoryMap.has(categoryName)) {
          try {
            let cat = await ctx.db.category.findUnique({
              where: { storeId_name: { storeId, name: categoryName } },
            });
            if (!cat) {
              cat = await ctx.db.category.create({
                data: { storeId, name: categoryName, defaultMarkupPercent: 0 },
              });
            }
            categoryMap.set(categoryName, cat.id);
          } catch (err: any) {
            // Category creation failed — skip products in this category
            errors.push({ row: 0, reason: `Category "${categoryName}" creation failed: ${err.message}` });
          }
        }
      }

      // Create products individually (no transaction — each row independent)
      for (let i = 0; i < input.products.length; i++) {
        const p = input.products[i];
        if (duplicateRows.has(i + 1)) continue;
        try {
          const barcode = normalizeOptional(p.barcode);
          const sku = normalizeOptional(p.sku);
          const categoryName = normalizeOptional(p.categoryName);
          const markupPercent = p.markupPercent ?? (p.costPrice > 0 ? ((p.retailPrice - p.costPrice) / p.costPrice) * 100 : 0);
          const data = {
            name: p.name.trim(),
            brand: normalizeOptional(p.brand),
            size: normalizeOptional(p.size),
            unit: normalizeOptional(p.unit),
            barcode,
            sku,
            categoryId: categoryName ? categoryMap.get(categoryName) : null,
            costPrice: p.costPrice,
            retailPrice: p.retailPrice,
            markupPercent,
            location: normalizeOptional(p.location),
            supplier: normalizeOptional(p.supplier),
            importSource,
            lastImportedAt: new Date(),
          };
          const existing = input.upsert && (barcode || sku)
            ? await ctx.db.product.findFirst({
                where: {
                  storeId,
                  OR: [
                    ...(barcode ? [{ barcode }] : []),
                    ...(sku ? [{ sku }] : []),
                  ],
                },
              })
            : null;

          if (existing) {
            await ctx.db.product.update({
              where: { id: existing.id },
              data,
            });
            updated++;
          } else {
            await ctx.db.product.create({
            data: {
              storeId,
              ...data,
            },
          });
          imported++;
          }
        } catch (err: any) {
          const reason = err.message?.includes('Unique') || err.code === 'P2002'
            ? 'Duplicate barcode or SKU'
            : err.message || 'Unknown error';
          errors.push({ row: i + 1, reason });
        }
      }

      if (imported || updated) {
        await logAdminAction(ctx.db, ctx.user.id, scope, {
          action: 'PRODUCTS_IMPORTED',
          storeId,
          sourceType: 'PRODUCT',
          note: `Imported ${imported} and updated ${updated} product${imported + updated === 1 ? '' : 's'}`,
          metadata: { imported, updated, errors: errors.length, importSource },
        });
      }

      return { imported, updated, errors };
    }),

  qa: managerProcedure
    .input(z.object({
      scope: z.string().optional(),
      lowMarginThreshold: z.number().min(-100).max(100).default(10),
      staleDays: z.number().int().min(1).max(365).default(45),
    }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await resolveAdminScope(ctx as any, input?.scope);
      const products = await ctx.db.product.findMany({
        where: { ...adminStoreWhere(scope), isActive: true },
        include: { category: { select: { name: true } }, store: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      });
      const staleCutoff = new Date(Date.now() - (input?.staleDays ?? 45) * 24 * 60 * 60 * 1000);
      const lowMarginThreshold = input?.lowMarginThreshold ?? 10;
      const duplicateNameGroups = new Map<string, any[]>();
      products.forEach((product: any) => {
        const key = normalizeName(product.name);
        if (!key) return;
        duplicateNameGroups.set(key, [...(duplicateNameGroups.get(key) ?? []), product]);
      });
      const duplicateLookingNames = [...duplicateNameGroups.values()]
        .filter((group) => group.length > 1)
        .flat()
        .slice(0, 50);

      const findings = {
        missingBarcodeOrSku: products.filter((p: any) => !p.barcode && !p.sku).slice(0, 50),
        duplicateLookingNames,
        zeroCost: products.filter((p: any) => Number(p.costPrice) <= 0).slice(0, 50),
        zeroRetail: products.filter((p: any) => Number(p.retailPrice) <= 0).slice(0, 50),
        missingCategory: products.filter((p: any) => !p.categoryId).slice(0, 50),
        missingLocation: products.filter((p: any) => !p.location).slice(0, 50),
        staleImport: products.filter((p: any) => !p.lastImportedAt || p.lastImportedAt < staleCutoff).slice(0, 50),
        lowMargin: products.filter((p: any) => Number(p.markupPercent) < lowMarginThreshold).slice(0, 50),
      };

      return {
        scope,
        totalProducts: products.length,
        summary: Object.fromEntries(Object.entries(findings).map(([key, value]) => [key, value.length])),
        findings,
      };
    }),
});
