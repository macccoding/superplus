# Phase 2: Core Tools — Implementation Plan

**Date:** 2026-05-16
**Spec:** `docs/superpowers/specs/2026-05-16-phase2-core-tools-design.md`
**Status:** Ready to execute

---

## Task 1: Schema + Migrations + Seed

### Files to modify

- `packages/db/prisma/schema.prisma`
- `packages/db/src/index.ts`
- `packages/db/prisma/seed.ts`

### Step 1.1 — Add enums and models to schema

Append to `packages/db/prisma/schema.prisma`:

```prisma
enum StockStatus {
  IN_STOCK
  LOW
  OUT_OF_STOCK
}

enum ChecklistItemStatus {
  DONE
  SKIPPED
  NOT_APPLICABLE
}

model Category {
  id                   String   @id @default(cuid())
  storeId              String
  name                 String
  defaultMarkupPercent Decimal  @default(30)
  sortOrder            Int      @default(0)
  isActive             Boolean  @default(true)
  createdAt            DateTime @default(now())

  store    Store     @relation(fields: [storeId], references: [id])
  products Product[]

  @@unique([storeId, name])
  @@index([storeId, sortOrder])
}

model Product {
  id              String      @id @default(cuid())
  storeId         String
  categoryId      String?
  name            String
  barcode         String?
  sku             String?
  costPrice       Decimal
  retailPrice     Decimal
  markupPercent   Decimal
  useCustomMarkup Boolean     @default(false)
  location        String?
  supplier        String?
  stockStatus     StockStatus @default(IN_STOCK)
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  store    Store     @relation(fields: [storeId], references: [id])
  category Category? @relation(fields: [categoryId], references: [id])

  @@unique([storeId, barcode])
  @@index([storeId, name])
  @@index([storeId, categoryId])
}

model ChecklistTemplate {
  id        String   @id @default(cuid())
  storeId   String
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  store       Store                  @relation(fields: [storeId], references: [id])
  items       ChecklistTemplateItem[]
  submissions ChecklistSubmission[]

  @@index([storeId])
}

model ChecklistTemplateItem {
  id         String  @id @default(cuid())
  templateId String
  label      String
  sortOrder  Int     @default(0)
  isRequired Boolean @default(true)

  template        ChecklistTemplate       @relation(fields: [templateId], references: [id], onDelete: Cascade)
  submissionItems ChecklistSubmissionItem[]

  @@index([templateId, sortOrder])
}

model ChecklistSubmission {
  id            String   @id @default(cuid())
  storeId       String
  templateId    String
  submittedById String
  date          DateTime @db.Date
  completedAt   DateTime @default(now())
  notes         String?

  store       Store              @relation(fields: [storeId], references: [id])
  template    ChecklistTemplate  @relation(fields: [templateId], references: [id])
  submittedBy User               @relation(fields: [submittedById], references: [id])
  items       ChecklistSubmissionItem[]

  @@unique([storeId, templateId, date])
  @@index([storeId, date])
}

model ChecklistSubmissionItem {
  id             String              @id @default(cuid())
  submissionId   String
  templateItemId String
  status         ChecklistItemStatus
  reason         String?

  submission   ChecklistSubmission   @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  templateItem ChecklistTemplateItem @relation(fields: [templateItemId], references: [id])

  @@index([submissionId])
}
```

### Step 1.2 — Add relations to existing Store and User models

Add to `Store` model:

```prisma
  categories           Category[]
  products             Product[]
  checklistTemplates   ChecklistTemplate[]
  checklistSubmissions ChecklistSubmission[]
```

Add to `User` model:

```prisma
  checklistSubmissions ChecklistSubmission[]
```

### Step 1.3 — Update `packages/db/src/index.ts` exports

```ts
export { db } from './client';
export type {
  Store,
  User,
  Thread,
  ThreadMessage,
  Task,
  LogEntry,
  Announcement,
  Category,
  Product,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistSubmission,
  ChecklistSubmissionItem,
} from '@prisma/client';
export {
  Role,
  ThreadCategory,
  Priority,
  TaskStatus,
  LogCategory,
  AnnouncePriority,
  StockStatus,
  ChecklistItemStatus,
} from '@prisma/client';
```

### Step 1.4 — Extend seed with sample categories and products

Add to `packages/db/prisma/seed.ts` after existing user creation:

```ts
  // Categories
  const grocery = await prisma.category.create({
    data: {
      storeId: store.id,
      name: 'Grocery',
      defaultMarkupPercent: 25,
      sortOrder: 0,
    },
  });

  const beverages = await prisma.category.create({
    data: {
      storeId: store.id,
      name: 'Beverages',
      defaultMarkupPercent: 35,
      sortOrder: 1,
    },
  });

  const snacks = await prisma.category.create({
    data: {
      storeId: store.id,
      name: 'Snacks',
      defaultMarkupPercent: 40,
      sortOrder: 2,
    },
  });

  const household = await prisma.category.create({
    data: {
      storeId: store.id,
      name: 'Household',
      defaultMarkupPercent: 30,
      sortOrder: 3,
    },
  });

  // Sample products
  await prisma.product.createMany({
    data: [
      { storeId: store.id, categoryId: grocery.id, name: 'Grace Corned Beef 340g', barcode: '8712439021001', costPrice: 450, retailPrice: 563, markupPercent: 25, location: 'Aisle 2, Shelf B' },
      { storeId: store.id, categoryId: grocery.id, name: 'Lasco Food Drink - Chocolate', barcode: '8765432101234', costPrice: 120, retailPrice: 150, markupPercent: 25, location: 'Aisle 1, Shelf A' },
      { storeId: store.id, categoryId: beverages.id, name: 'Pepsi Cola 2L', barcode: '4901234567890', costPrice: 200, retailPrice: 270, markupPercent: 35, location: 'Cooler 1' },
      { storeId: store.id, categoryId: beverages.id, name: 'Wata Water 1.5L', barcode: '8765001234567', costPrice: 80, retailPrice: 108, markupPercent: 35, location: 'Cooler 2' },
      { storeId: store.id, categoryId: snacks.id, name: 'Excelsior Water Crackers', barcode: '5012345678901', costPrice: 180, retailPrice: 252, markupPercent: 40, location: 'Aisle 3, Shelf C' },
      { storeId: store.id, categoryId: household.id, name: 'Breeze Detergent 900g', barcode: '6789012345678', costPrice: 350, retailPrice: 455, markupPercent: 30, location: 'Aisle 5, Shelf A', supplier: 'Unilever JA' },
    ],
  });

  // Checklist template
  const closingTemplate = await prisma.checklistTemplate.create({
    data: {
      storeId: store.id,
      name: 'Nightly Closing',
    },
  });

  await prisma.checklistTemplateItem.createMany({
    data: [
      { templateId: closingTemplate.id, label: 'All coolers at correct temperature', sortOrder: 0, isRequired: true },
      { templateId: closingTemplate.id, label: 'Cash register balanced and locked', sortOrder: 1, isRequired: true },
      { templateId: closingTemplate.id, label: 'Floors swept and mopped', sortOrder: 2, isRequired: true },
      { templateId: closingTemplate.id, label: 'Expired items removed from shelves', sortOrder: 3, isRequired: true },
      { templateId: closingTemplate.id, label: 'Security alarm set', sortOrder: 4, isRequired: true },
      { templateId: closingTemplate.id, label: 'Outdoor signage lights off', sortOrder: 5, isRequired: false },
      { templateId: closingTemplate.id, label: 'Trash taken to bin area', sortOrder: 6, isRequired: true },
      { templateId: closingTemplate.id, label: 'Back door locked and checked', sortOrder: 7, isRequired: true },
    ],
  });

  console.log('Seed complete: 1 store, 4 users (PIN: 1234), 4 categories, 6 products, 1 checklist template');
```

### Step 1.5 — Push schema and generate

```bash
cd packages/db && pnpm db:push && pnpm db:generate
```

### Commit message
```
feat(db): add Category, Product, Checklist models for Phase 2

Adds 6 new models + 2 enums (StockStatus, ChecklistItemStatus) for
pricing, product lookup, and closing checklist tools. Includes seed
data with sample categories, products, and a checklist template.
```

---

## Task 2: tRPC Routers — Products + Categories

### Files to create

- `apps/web/src/server/trpc/routers/products.ts`
- `apps/web/src/server/trpc/routers/categories.ts`

### Files to modify

- `apps/web/src/server/trpc/router.ts`

### Step 2.1 — Categories router

Create `apps/web/src/server/trpc/routers/categories.ts`:

```ts
import { z } from 'zod';
import { router, protectedProcedure, managerProcedure } from '../init';

export const categoriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      where: { storeId: ctx.storeId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }),

  create: managerProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      defaultMarkupPercent: z.number().min(0).max(999),
    }))
    .mutation(async ({ ctx, input }) => {
      const maxSort = await ctx.db.category.aggregate({
        where: { storeId: ctx.storeId },
        _max: { sortOrder: true },
      });
      return ctx.db.category.create({
        data: {
          storeId: ctx.storeId,
          name: input.name,
          defaultMarkupPercent: input.defaultMarkupPercent,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });
    }),

  update: managerProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      defaultMarkupPercent: z.number().min(0).max(999).optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.category.update({
        where: { id, storeId: ctx.storeId },
        data,
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const productCount = await ctx.db.product.count({
        where: { categoryId: input.id, storeId: ctx.storeId },
      });
      if (productCount > 0) {
        throw new Error(`Cannot delete category with ${productCount} products. Reassign products first.`);
      }
      return ctx.db.category.delete({
        where: { id: input.id, storeId: ctx.storeId },
      });
    }),
});
```

### Step 2.2 — Products router

Create `apps/web/src/server/trpc/routers/products.ts`:

```ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
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
        // If query looks like a barcode (all digits, 8-13 chars), search by barcode
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

      // Strip sensitive fields for staff
      const isSupervisor = hasMinRole(ctx.user.role as Role, 'SUPERVISOR');
      const products = items.map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        retailPrice: p.retailPrice,
        location: p.location,
        stockStatus: p.stockStatus,
        categoryName: p.category?.name ?? null,
        ...(isSupervisor ? {
          costPrice: p.costPrice,
          markupPercent: p.markupPercent,
          supplier: p.supplier,
        } : {}),
      }));

      return { products, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findFirst({
        where: { id: input.id, storeId: ctx.storeId },
        include: { category: true },
      });
      if (!product) throw new TRPCError({ code: 'NOT_FOUND' });

      const isSupervisor = hasMinRole(ctx.user.role as Role, 'SUPERVISOR');
      return {
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        sku: product.sku,
        retailPrice: product.retailPrice,
        location: product.location,
        stockStatus: product.stockStatus,
        categoryId: product.categoryId,
        categoryName: product.category?.name ?? null,
        useCustomMarkup: product.useCustomMarkup,
        isActive: product.isActive,
        updatedAt: product.updatedAt,
        ...(isSupervisor ? {
          costPrice: product.costPrice,
          markupPercent: product.markupPercent,
          supplier: product.supplier,
        } : {}),
      };
    }),

  create: supervisorProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      barcode: z.string().max(50).optional(),
      sku: z.string().max(50).optional(),
      categoryId: z.string().optional(),
      costPrice: z.number().min(0),
      retailPrice: z.number().min(0),
      markupPercent: z.number(),
      useCustomMarkup: z.boolean().default(false),
      location: z.string().max(200).optional(),
      supplier: z.string().max(200).optional(),
      stockStatus: z.nativeEnum(StockStatus).default(StockStatus.IN_STOCK),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.product.create({
        data: {
          ...input,
          storeId: ctx.storeId,
          barcode: input.barcode || null,
          sku: input.sku || null,
        },
      });
    }),

  update: supervisorProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(200).optional(),
      barcode: z.string().max(50).optional().nullable(),
      sku: z.string().max(50).optional().nullable(),
      categoryId: z.string().optional().nullable(),
      costPrice: z.number().min(0).optional(),
      retailPrice: z.number().min(0).optional(),
      markupPercent: z.number().optional(),
      useCustomMarkup: z.boolean().optional(),
      location: z.string().max(200).optional().nullable(),
      supplier: z.string().max(200).optional().nullable(),
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
      })).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const errors: { row: number; reason: string }[] = [];
      let imported = 0;

      // Resolve categories
      const categoryNames = [...new Set(
        input.products.map(p => p.categoryName).filter(Boolean) as string[]
      )];
      const existingCategories = await ctx.db.category.findMany({
        where: { storeId: ctx.storeId, name: { in: categoryNames } },
      });
      const categoryMap = new Map(existingCategories.map(c => [c.name, c.id]));

      // Create missing categories
      for (const name of categoryNames) {
        if (!categoryMap.has(name)) {
          const cat = await ctx.db.category.create({
            data: { storeId: ctx.storeId, name, defaultMarkupPercent: 0 },
          });
          categoryMap.set(name, cat.id);
        }
      }

      for (let i = 0; i < input.products.length; i++) {
        const row = input.products[i];
        try {
          const markupPercent = row.markupPercent ??
            (row.costPrice > 0 ? ((row.retailPrice - row.costPrice) / row.costPrice) * 100 : 0);

          await ctx.db.product.create({
            data: {
              storeId: ctx.storeId,
              name: row.name,
              barcode: row.barcode || null,
              sku: row.sku || null,
              categoryId: row.categoryName ? categoryMap.get(row.categoryName) ?? null : null,
              costPrice: row.costPrice,
              retailPrice: row.retailPrice,
              markupPercent,
              location: row.location || null,
              supplier: row.supplier || null,
            },
          });
          imported++;
        } catch (e: any) {
          errors.push({
            row: i,
            reason: e.code === 'P2002' ? 'Duplicate barcode' : (e.message ?? 'Unknown error'),
          });
        }
      }

      return { imported, errors };
    }),
});
```

### Step 2.3 — Register routers in root

Update `apps/web/src/server/trpc/router.ts`:

```ts
import { router } from './init';
import { tasksRouter } from './routers/tasks';
import { threadsRouter } from './routers/threads';
import { logbookRouter } from './routers/logbook';
import { announcementsRouter } from './routers/announcements';
import { usersRouter } from './routers/users';
import { storesRouter } from './routers/stores';
import { activityRouter } from './routers/activity';
import { productsRouter } from './routers/products';
import { categoriesRouter } from './routers/categories';

export const appRouter = router({
  tasks: tasksRouter,
  threads: threadsRouter,
  logbook: logbookRouter,
  announcements: announcementsRouter,
  users: usersRouter,
  stores: storesRouter,
  activity: activityRouter,
  products: productsRouter,
  categories: categoriesRouter,
});

export type AppRouter = typeof appRouter;
```

### Commit message
```
feat(api): add products and categories tRPC routers

Products router: search (with barcode detection), getById (role-filtered),
create, update, importBatch (batch 200, auto-creates categories).
Categories router: list (with product counts), create, update, delete.
```

---

## Task 3: tRPC Router — Checklists

### Files to create

- `apps/web/src/server/trpc/routers/checklists.ts`

### Files to modify

- `apps/web/src/server/trpc/router.ts`

### Step 3.1 — Checklists router

Create `apps/web/src/server/trpc/routers/checklists.ts`:

```ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, supervisorProcedure, managerProcedure } from '../init';
import { ChecklistItemStatus } from '@superplus/db';

export const checklistsRouter = router({
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.checklistTemplate.findMany({
      where: { storeId: ctx.storeId, isActive: true },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }),

  getTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.checklistTemplate.findFirst({
        where: { id: input.id, storeId: ctx.storeId },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
        },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });
      return template;
    }),

  createTemplate: managerProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      items: z.array(z.object({
        label: z.string().min(1).max(500),
        isRequired: z.boolean().default(true),
      })).min(1),
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
      name: z.string().min(1).max(200).optional(),
      isActive: z.boolean().optional(),
      items: z.array(z.object({
        id: z.string().optional(), // existing item
        label: z.string().min(1).max(500),
        isRequired: z.boolean().default(true),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...data } = input;

      // Verify ownership
      const template = await ctx.db.checklistTemplate.findFirst({
        where: { id, storeId: ctx.storeId },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

      // If items are provided, delete existing and recreate
      if (items) {
        await ctx.db.checklistTemplateItem.deleteMany({
          where: { templateId: id },
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
        where: { id },
        data,
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    }),

  submit: supervisorProcedure
    .input(z.object({
      templateId: z.string(),
      items: z.array(z.object({
        templateItemId: z.string(),
        status: z.nativeEnum(ChecklistItemStatus),
        reason: z.string().max(500).optional(),
      })),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate: skipped/N/A items need a reason
      for (const item of input.items) {
        if (item.status !== ChecklistItemStatus.DONE && !item.reason?.trim()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'A reason is required for skipped or N/A items',
          });
        }
      }

      // Verify template belongs to store
      const template = await ctx.db.checklistTemplate.findFirst({
        where: { id: input.templateId, storeId: ctx.storeId },
        include: { items: true },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

      // Verify all items are addressed
      if (input.items.length !== template.items.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'All checklist items must be addressed',
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check for existing submission today
      const existing = await ctx.db.checklistSubmission.findFirst({
        where: {
          storeId: ctx.storeId,
          templateId: input.templateId,
          date: today,
        },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This checklist has already been submitted today',
        });
      }

      return ctx.db.checklistSubmission.create({
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
            })),
          },
        },
        include: { items: true },
      });
    }),

  listSubmissions: managerProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      templateId: z.string().optional(),
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
          template: { select: { name: true } },
          submittedBy: { select: { fullName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 50,
      });
    }),

  getSubmission: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.checklistSubmission.findFirst({
        where: { id: input.id, storeId: ctx.storeId },
        include: {
          template: { select: { name: true } },
          submittedBy: { select: { fullName: true } },
          items: {
            include: { templateItem: { select: { label: true, isRequired: true } } },
            orderBy: { templateItem: { sortOrder: 'asc' } },
          },
        },
      });
      if (!submission) throw new TRPCError({ code: 'NOT_FOUND' });
      return submission;
    }),

  // Check if today's submission exists (for UI gating)
  todayStatus: supervisorProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await ctx.db.checklistSubmission.findFirst({
        where: {
          storeId: ctx.storeId,
          templateId: input.templateId,
          date: today,
        },
        select: { id: true, completedAt: true, submittedBy: { select: { fullName: true } } },
      });
      return existing;
    }),
});
```

### Step 3.2 — Register in root router

Add to `apps/web/src/server/trpc/router.ts`:

```ts
import { checklistsRouter } from './routers/checklists';
```

And add to the router object:

```ts
  checklists: checklistsRouter,
```

Full updated file:

```ts
import { router } from './init';
import { tasksRouter } from './routers/tasks';
import { threadsRouter } from './routers/threads';
import { logbookRouter } from './routers/logbook';
import { announcementsRouter } from './routers/announcements';
import { usersRouter } from './routers/users';
import { storesRouter } from './routers/stores';
import { activityRouter } from './routers/activity';
import { productsRouter } from './routers/products';
import { categoriesRouter } from './routers/categories';
import { checklistsRouter } from './routers/checklists';

export const appRouter = router({
  tasks: tasksRouter,
  threads: threadsRouter,
  logbook: logbookRouter,
  announcements: announcementsRouter,
  users: usersRouter,
  stores: storesRouter,
  activity: activityRouter,
  products: productsRouter,
  categories: categoriesRouter,
  checklists: checklistsRouter,
});

export type AppRouter = typeof appRouter;
```

### Commit message
```
feat(api): add checklists tRPC router

Includes: listTemplates, getTemplate, createTemplate, updateTemplate,
submit (with reason validation + one-per-day enforcement), listSubmissions,
getSubmission, todayStatus check.
```

---

## Task 4: Pricing Tool UI

### Files to create

- `apps/web/src/app/tools/pricing/page.tsx`

### Step 4.1 — Pricing tool page

Create `apps/web/src/app/tools/pricing/page.tsx`:

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { useSession } from 'next-auth/react';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';

type Tab = 'calculator' | 'rules';

function formatJMD(n: number): string {
  return '$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcRetail(cost: number, markup: number): number {
  return cost * (1 + markup / 100);
}

const MARGINS = [20, 25, 30, 35, 40, 50];

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isSupervisor = session?.user?.role ? hasMinRole(session.user.role as Role, 'SUPERVISOR') : false;

  const [tab, setTab] = useState<Tab>('calculator');
  const [costInput, setCostInput] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const { data: categories } = trpc.categories.list.useQuery();

  const cost = parseFloat(costInput) || 0;
  const selectedCategory = categories?.find((c) => c.id === selectedCategoryId);

  const results = useMemo(() => {
    if (cost <= 0) return [];
    return MARGINS.map((m) => ({
      markup: m,
      retail: calcRetail(cost, m),
      isDefault: selectedCategory ? Number(selectedCategory.defaultMarkupPercent) === m : false,
    }));
  }, [cost, selectedCategory]);

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <button onClick={() => router.push('/tools')} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Tools
        </button>
        <h2 className="text-2xl font-bold text-on-surface">Pricing</h2>
      </section>

      {/* Tabs */}
      {isSupervisor && (
        <section className="px-[--spacing-container] pb-4">
          <div className="flex bg-surface-container-high rounded-xl p-1">
            {([
              { key: 'calculator' as const, label: 'Calculator' },
              { key: 'rules' as const, label: 'Margin Rules' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2.5 text-center rounded-lg text-sm font-medium transition-all duration-200 ${
                  tab === key
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'calculator' ? (
        <CalculatorView
          costInput={costInput}
          setCostInput={setCostInput}
          cost={cost}
          results={results}
          categories={categories ?? []}
          selectedCategoryId={selectedCategoryId}
          setSelectedCategoryId={setSelectedCategoryId}
          selectedCategory={selectedCategory}
        />
      ) : (
        <MarginRulesView />
      )}
    </div>
  );
}

function CalculatorView({
  costInput, setCostInput, cost, results, categories, selectedCategoryId, setSelectedCategoryId, selectedCategory,
}: {
  costInput: string;
  setCostInput: (v: string) => void;
  cost: number;
  results: { markup: number; retail: number; isDefault: boolean }[];
  categories: any[];
  selectedCategoryId: string;
  setSelectedCategoryId: (v: string) => void;
  selectedCategory: any;
}) {
  return (
    <section className="px-[--spacing-container] pb-24 space-y-4">
      {/* Category selector */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
        <label className="block text-sm font-medium text-on-surface mb-2">Category (optional)</label>
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-base text-on-surface"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({Number(c.defaultMarkupPercent)}%)</option>
          ))}
        </select>
      </div>

      {/* Cost input */}
      <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
        <label className="block text-sm font-medium text-on-surface mb-2">Cost Price (JMD)</label>
        <input
          type="number"
          inputMode="decimal"
          value={costInput}
          onChange={(e) => setCostInput(e.target.value)}
          placeholder="0.00"
          className="w-full h-16 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-3xl font-bold text-on-surface placeholder:text-outline text-center transition-colors"
          autoFocus
        />
      </div>

      {/* Results grid */}
      {cost > 0 && (
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-on-surface-variant mb-3">Retail at markup</h3>
          <div className="grid grid-cols-2 gap-3">
            {results.map((r) => (
              <div
                key={r.markup}
                className={`rounded-xl p-4 text-center transition-all ${
                  r.isDefault
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-surface-container-low border-2 border-transparent'
                }`}
              >
                <p className="text-xs font-medium text-on-surface-variant mb-1">
                  {r.markup}%{r.isDefault && ' (default)'}
                </p>
                <p className={`text-lg font-bold ${r.isDefault ? 'text-primary' : 'text-on-surface'}`}>
                  {formatJMD(r.retail)}
                </p>
              </div>
            ))}
          </div>

          {/* Negative margin warning */}
          {results.some(r => r.markup < 0) && (
            <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg p-3">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span className="text-xs font-medium">Negative margin — selling below cost</span>
            </div>
          )}
        </div>
      )}

      {/* Category default result */}
      {cost > 0 && selectedCategory && (
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
          <p className="text-sm text-on-surface-variant">
            {selectedCategory.name} default ({Number(selectedCategory.defaultMarkupPercent)}%)
          </p>
          <p className="text-2xl font-bold text-primary mt-1">
            {formatJMD(calcRetail(cost, Number(selectedCategory.defaultMarkupPercent)))}
          </p>
        </div>
      )}
    </section>
  );
}

function MarginRulesView() {
  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.categories.list.useQuery();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const update = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      setEditingId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <section className="px-[--spacing-container] pb-24 space-y-3">
      <p className="text-sm text-on-surface-variant mb-2">
        Set default markup percentages for each category. Products using the category default will reflect changes.
      </p>

      {categories?.map((cat) => (
        <div key={cat.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="font-medium text-on-surface">{cat.name}</p>
            <p className="text-xs text-on-surface-variant">{cat._count.products} products</p>
          </div>

          {editingId === cat.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-20 h-10 px-2 bg-surface-container-low border-2 border-primary rounded-lg text-center text-sm font-bold text-on-surface focus:outline-none"
                autoFocus
              />
              <span className="text-sm text-on-surface-variant">%</span>
              <button
                onClick={() => update.mutate({ id: cat.id, defaultMarkupPercent: parseFloat(editValue) })}
                className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="w-10 h-10 rounded-lg bg-surface-container-high text-on-surface-variant flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingId(cat.id); setEditValue(String(Number(cat.defaultMarkupPercent))); }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface font-bold text-sm"
            >
              {Number(cat.defaultMarkupPercent)}%
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
            </button>
          )}
        </div>
      ))}

      {(!categories || categories.length === 0) && (
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-[48px] text-outline">category</span>
          <p className="text-on-surface-variant mt-2">No categories yet. Add them in Admin.</p>
        </div>
      )}
    </section>
  );
}
```

### Commit message
```
feat(tools): add Pricing tool with calculator and margin rules

Quick calculator: enter cost, see retail at 20-50% margins, category
dropdown highlights default. Margin Rules tab (supervisor+): inline
editing of category markup percentages with product count.
```

---

## Task 5: Product Lookup UI

### Files to create

- `apps/web/src/app/tools/product-lookup/page.tsx`
- `apps/web/src/app/tools/product-lookup/[id]/page.tsx`
- `apps/web/src/app/tools/product-lookup/barcode-scanner.tsx`

### Step 5.1 — Product lookup search page

Create `apps/web/src/app/tools/product-lookup/page.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';
import { BarcodeScanner } from './barcode-scanner';

type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW' | 'OUT_OF_STOCK';

function formatJMD(n: number | any): string {
  const val = typeof n === 'number' ? n : Number(n);
  return '$' + val.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const stockDot: Record<string, string> = {
  IN_STOCK: 'bg-success',
  LOW: 'bg-amber-500',
  OUT_OF_STOCK: 'bg-error',
};

export default function ProductLookupPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [showScanner, setShowScanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const { data: categories } = trpc.categories.list.useQuery();
  const { data, isLoading, fetchNextPage, hasNextPage } = trpc.products.search.useInfiniteQuery(
    {
      query: debouncedQuery || undefined,
      categoryId: categoryId || undefined,
      stockStatus: stockFilter !== 'ALL' ? stockFilter as any : undefined,
      limit: 20,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: debouncedQuery.length > 0 || !!categoryId || stockFilter !== 'ALL',
    }
  );

  const products = data?.pages.flatMap((p) => p.products) ?? [];
  const hasSearch = debouncedQuery.length > 0 || !!categoryId || stockFilter !== 'ALL';

  function handleBarcodeScan(barcode: string) {
    setQuery(barcode);
    setShowScanner(false);
  }

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <button onClick={() => router.push('/tools')} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Tools
        </button>
        <h2 className="text-2xl font-bold text-on-surface">Product Lookup</h2>
      </section>

      {/* Search bar */}
      <section className="px-[--spacing-container] pb-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or barcode"
              className="w-full h-14 pl-12 pr-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-outline transition-colors"
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="w-14 h-14 rounded-xl bg-surface-container-low border-2 border-outline-variant flex items-center justify-center text-on-surface-variant active:scale-95 transition-all"
            title="Scan barcode"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="px-[--spacing-container] pb-3 space-y-3">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full h-12 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface"
        >
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['ALL', 'IN_STOCK', 'LOW', 'OUT_OF_STOCK'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStockFilter(s)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                stockFilter === s
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {s === 'ALL' ? 'All' : s === 'IN_STOCK' ? 'In Stock' : s === 'LOW' ? 'Low' : 'Out'}
            </button>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="px-[--spacing-container] pb-24 space-y-3">
        {!hasSearch && (
          <EmptyState
            icon="search"
            title="Search by name or barcode"
            description="Type a product name or scan a barcode to find products"
          />
        )}

        {hasSearch && isLoading && (
          <div className="flex justify-center py-8">
            <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
          </div>
        )}

        {hasSearch && !isLoading && products.length === 0 && (
          <EmptyState
            icon="inventory_2"
            title="No products found"
            description="Try a different search term or adjust filters"
          />
        )}

        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => router.push(`/tools/product-lookup/${product.id}`)}
            className="w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm text-left active:scale-[0.98] transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-on-surface truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {product.categoryName && (
                    <span className="text-xs text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full">
                      {product.categoryName}
                    </span>
                  )}
                  {product.location && (
                    <span className="text-xs text-on-surface-variant">{product.location}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <p className="font-bold text-on-surface">{formatJMD(product.retailPrice)}</p>
                <div className={`w-2.5 h-2.5 rounded-full ${stockDot[product.stockStatus]}`} />
              </div>
            </div>
          </button>
        ))}

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            className="w-full py-3 text-center text-sm font-medium text-primary bg-primary/5 rounded-xl"
          >
            Load more
          </button>
        )}
      </section>

      {/* Barcode scanner modal */}
      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
```

### Step 5.2 — Barcode scanner component

Create `apps/web/src/app/tools/product-lookup/barcode-scanner.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      return;
    }

    let stream: MediaStream | null = null;
    let animationId: number;
    let running = true;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          detectBarcode();
        }
      } catch {
        setError('Camera access denied. Please allow camera permissions.');
      }
    }

    async function detectBarcode() {
      if (!running || !videoRef.current) return;
      try {
        // @ts-ignore BarcodeDetector is not in TS types yet
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          onScan(barcodes[0].rawValue);
          return;
        }
      } catch {
        // Detection failed, retry
      }
      animationId = requestAnimationFrame(detectBarcode);
    }

    startCamera();

    return () => {
      running = false;
      cancelAnimationFrame(animationId);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [onScan]);

  if (!supported) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
        <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-sm text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant">qr_code_scanner</span>
          <h3 className="font-bold text-on-surface mt-3">Scanner Not Available</h3>
          <p className="text-sm text-on-surface-variant mt-2">
            Your browser doesn't support barcode scanning. Enter the barcode manually in the search bar.
          </p>
          <button
            onClick={onClose}
            className="w-full h-12 mt-4 bg-primary text-on-primary font-bold rounded-xl active:scale-95 transition-all"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4">
        <h3 className="text-white font-bold">Scan Barcode</h3>
        <button onClick={onClose} className="text-white">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <span className="material-symbols-outlined text-[48px] text-white/50">videocam_off</span>
            <p className="text-white/80 mt-3">{error}</p>
            <button onClick={onClose} className="mt-4 px-6 py-3 bg-white/10 text-white rounded-xl">
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-32 border-2 border-white/60 rounded-xl" />
          </div>
          <p className="absolute bottom-8 left-0 right-0 text-center text-white/60 text-sm">
            Point camera at barcode
          </p>
        </div>
      )}
    </div>
  );
}
```

### Step 5.3 — Product detail page

Create `apps/web/src/app/tools/product-lookup/[id]/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { useSession } from 'next-auth/react';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';

function formatJMD(n: number | any): string {
  const val = typeof n === 'number' ? n : Number(n);
  return '$' + val.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const stockLabel: Record<string, { text: string; color: string }> = {
  IN_STOCK: { text: 'In Stock', color: 'text-success bg-success/10' },
  LOW: { text: 'Low Stock', color: 'text-amber-700 bg-amber-50' },
  OUT_OF_STOCK: { text: 'Out of Stock', color: 'text-error bg-error/10' },
};

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const isSupervisor = session?.user?.role ? hasMinRole(session.user.role as Role, 'SUPERVISOR') : false;

  const { data: product, isLoading } = trpc.products.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-[--spacing-container] py-6 text-center">
        <span className="material-symbols-outlined text-[48px] text-outline">error</span>
        <p className="text-on-surface-variant mt-2">Product not found</p>
      </div>
    );
  }

  const stock = stockLabel[product.stockStatus];

  return (
    <div className="px-[--spacing-container] py-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-5">
        {/* Name + category */}
        <div>
          <h2 className="text-xl font-bold text-on-surface">{product.name}</h2>
          {product.categoryName && (
            <span className="inline-block mt-1 text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">
              {product.categoryName}
            </span>
          )}
        </div>

        {/* Retail price - big */}
        <div className="text-center py-4">
          <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-1">Retail Price</p>
          <p className="text-4xl font-black text-on-surface">{formatJMD(product.retailPrice)}</p>
        </div>

        {/* Info rows */}
        <div className="space-y-3">
          {product.barcode && (
            <InfoRow icon="barcode" label="Barcode" value={product.barcode} />
          )}
          {product.location && (
            <InfoRow icon="location_on" label="Location" value={product.location} />
          )}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">inventory</span>
              <span className="text-sm text-on-surface-variant">Stock</span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${stock.color}`}>
              {stock.text}
            </span>
          </div>
        </div>

        {/* Supervisor-only section */}
        {isSupervisor && (
          <div className="border-t border-outline-variant pt-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">Manager Info</p>
            {'costPrice' in product && (
              <InfoRow icon="payments" label="Cost Price" value={formatJMD(product.costPrice)} />
            )}
            {'markupPercent' in product && (
              <InfoRow icon="percent" label="Markup" value={`${Number(product.markupPercent).toFixed(1)}%`} />
            )}
            {'supplier' in product && product.supplier && (
              <InfoRow icon="local_shipping" label="Supplier" value={product.supplier as string} />
            )}
            <InfoRow icon="update" label="Last Updated" value={new Date(product.updatedAt).toLocaleDateString()} />

            <button
              onClick={() => router.push(`/admin/products/${product.id}`)}
              className="w-full h-12 mt-2 bg-surface-container-high text-on-surface font-medium rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Edit Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{icon}</span>
        <span className="text-sm text-on-surface-variant">{label}</span>
      </div>
      <span className="text-sm font-medium text-on-surface">{value}</span>
    </div>
  );
}
```

### Commit message
```
feat(tools): add Product Lookup with search, detail, and barcode scan

Search page: debounced search, category/stock filters, paginated results.
Detail page: role-based fields (staff vs supervisor+), edit link.
Barcode scanner: BarcodeDetector API with camera feed and fallback.
```

---

## Task 6: Product Admin (CRUD + CSV Import)

### Files to create

- `apps/web/src/app/admin/products/page.tsx`
- `apps/web/src/app/admin/products/[id]/page.tsx`
- `apps/web/src/app/admin/products/new/page.tsx`
- `apps/web/src/app/admin/products/import/page.tsx`
- `apps/web/src/app/admin/categories/page.tsx`

### Step 6.1 — Install PapaParse

```bash
cd apps/web && pnpm add papaparse && pnpm add -D @types/papaparse
```

### Step 6.2 — Products admin list page

Create `apps/web/src/app/admin/products/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

function formatJMD(n: number | any): string {
  const val = typeof n === 'number' ? n : Number(n);
  return '$' + val.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const stockBadge: Record<string, string> = {
  IN_STOCK: 'bg-success/10 text-success',
  LOW: 'bg-amber-50 text-amber-700',
  OUT_OF_STOCK: 'bg-error/10 text-error',
};

export default function AdminProductsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: categories } = trpc.categories.list.useQuery();
  const { data, isLoading } = trpc.products.search.useInfiniteQuery(
    { query: query || undefined, categoryId: categoryId || undefined, limit: 50 },
    { getNextPageParam: (last) => last.nextCursor }
  );

  const products = data?.pages.flatMap((p) => p.products) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Products</h1>
          <p className="text-on-surface-variant mt-1">Manage store inventory</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/products/import')}
            className="px-4 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Import CSV
          </button>
          <button
            onClick={() => router.push('/admin/products/new')}
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl font-medium text-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products..."
          className="flex-1 h-12 px-4 bg-surface-container-low border border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-12 px-4 bg-surface-container-low border border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface"
        >
          <option value="">All Categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon="inventory_2" title="No products" description="Add products or import from CSV" />
      ) : (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-left p-4 text-on-surface-variant font-medium">Name</th>
                <th className="text-left p-4 text-on-surface-variant font-medium">Category</th>
                <th className="text-right p-4 text-on-surface-variant font-medium">Retail</th>
                <th className="text-center p-4 text-on-surface-variant font-medium">Stock</th>
                <th className="text-left p-4 text-on-surface-variant font-medium">Barcode</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/admin/products/${p.id}`)}
                  className="border-b border-outline-variant/50 hover:bg-surface-container-low cursor-pointer transition-colors"
                >
                  <td className="p-4 font-medium text-on-surface">{p.name}</td>
                  <td className="p-4 text-on-surface-variant">{p.categoryName ?? '—'}</td>
                  <td className="p-4 text-right font-medium text-on-surface">{formatJMD(p.retailPrice)}</td>
                  <td className="p-4 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stockBadge[p.stockStatus]}`}>
                      {p.stockStatus === 'IN_STOCK' ? 'In' : p.stockStatus === 'LOW' ? 'Low' : 'Out'}
                    </span>
                  </td>
                  <td className="p-4 text-on-surface-variant font-mono text-xs">{p.barcode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

### Step 6.3 — Product create/edit form

Create `apps/web/src/app/admin/products/new/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function NewProductPage() {
  return <ProductForm mode="create" />;
}

export function ProductForm({ mode, initialData }: {
  mode: 'create' | 'edit';
  initialData?: any;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery();

  const [name, setName] = useState(initialData?.name ?? '');
  const [barcode, setBarcode] = useState(initialData?.barcode ?? '');
  const [sku, setSku] = useState(initialData?.sku ?? '');
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? '');
  const [costPrice, setCostPrice] = useState(initialData?.costPrice ? String(Number(initialData.costPrice)) : '');
  const [retailPrice, setRetailPrice] = useState(initialData?.retailPrice ? String(Number(initialData.retailPrice)) : '');
  const [useCustomMarkup, setUseCustomMarkup] = useState(initialData?.useCustomMarkup ?? false);
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [supplier, setSupplier] = useState(initialData?.supplier ?? '');
  const [stockStatus, setStockStatus] = useState(initialData?.stockStatus ?? 'IN_STOCK');

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const cost = parseFloat(costPrice) || 0;
  const retail = parseFloat(retailPrice) || 0;
  const effectiveMarkup = cost > 0 ? ((retail - cost) / cost) * 100 : 0;

  // Auto-calculate retail when cost changes and not custom
  function handleCostChange(val: string) {
    setCostPrice(val);
    if (!useCustomMarkup && selectedCategory) {
      const c = parseFloat(val) || 0;
      const markup = Number(selectedCategory.defaultMarkupPercent);
      setRetailPrice((c * (1 + markup / 100)).toFixed(2));
    }
  }

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    if (!useCustomMarkup && cost > 0) {
      const cat = categories?.find(c => c.id === id);
      if (cat) {
        setRetailPrice((cost * (1 + Number(cat.defaultMarkupPercent) / 100)).toFixed(2));
      }
    }
  }

  const create = trpc.products.create.useMutation({
    onSuccess: () => { utils.products.invalidate(); router.push('/admin/products'); },
  });

  const update = trpc.products.update.useMutation({
    onSuccess: () => { utils.products.invalidate(); router.push('/admin/products'); },
  });

  function handleSubmit() {
    const data = {
      name,
      barcode: barcode || undefined,
      sku: sku || undefined,
      categoryId: categoryId || undefined,
      costPrice: cost,
      retailPrice: retail,
      markupPercent: effectiveMarkup,
      useCustomMarkup,
      location: location || undefined,
      supplier: supplier || undefined,
      stockStatus: stockStatus as any,
    };

    if (mode === 'edit' && initialData?.id) {
      update.mutate({ id: initialData.id, ...data });
    } else {
      create.mutate(data);
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back
      </button>

      <h1 className="text-2xl font-black text-on-surface mb-6">
        {mode === 'create' ? 'Add Product' : 'Edit Product'}
      </h1>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-5 max-w-2xl">
        <Field label="Product Name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grace Corned Beef 340g" className="form-input" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Barcode">
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Optional" className="form-input" />
          </Field>
          <Field label="SKU">
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" className="form-input" />
          </Field>
        </div>

        <Field label="Category">
          <select value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)} className="form-input">
            <option value="">None</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({Number(c.defaultMarkupPercent)}%)</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Cost Price (JMD)" required>
            <input type="number" value={costPrice} onChange={(e) => handleCostChange(e.target.value)} placeholder="0.00" className="form-input" />
          </Field>
          <Field label="Retail Price (JMD)" required>
            <input type="number" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} placeholder="0.00" className="form-input" disabled={!useCustomMarkup && !!categoryId} />
          </Field>
        </div>

        <div className="flex items-center justify-between bg-surface-container-low rounded-xl p-4">
          <div>
            <p className="text-sm font-medium text-on-surface">Custom markup</p>
            <p className="text-xs text-on-surface-variant">Override category default ({selectedCategory ? `${Number(selectedCategory.defaultMarkupPercent)}%` : 'none'})</p>
          </div>
          <button
            onClick={() => setUseCustomMarkup(!useCustomMarkup)}
            className={`w-12 h-7 rounded-full transition-colors ${useCustomMarkup ? 'bg-primary' : 'bg-outline-variant'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${useCustomMarkup ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {cost > 0 && retail > 0 && (
          <p className="text-sm text-on-surface-variant">
            Effective markup: <span className={`font-bold ${effectiveMarkup < 0 ? 'text-error' : 'text-on-surface'}`}>{effectiveMarkup.toFixed(1)}%</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Location">
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Aisle 2, Shelf B" className="form-input" />
          </Field>
          <Field label="Supplier">
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Optional" className="form-input" />
          </Field>
        </div>

        <Field label="Stock Status">
          <div className="grid grid-cols-3 gap-2">
            {(['IN_STOCK', 'LOW', 'OUT_OF_STOCK'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStockStatus(s)}
                className={`py-3 rounded-xl text-xs font-bold transition-all ${
                  stockStatus === s ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {s === 'IN_STOCK' ? 'In Stock' : s === 'LOW' ? 'Low' : 'Out'}
              </button>
            ))}
          </div>
        </Field>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !cost || !retail || isPending}
          className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {isPending ? (
            <><span className="material-symbols-outlined animate-spin">progress_activity</span>Saving...</>
          ) : (
            <><span className="material-symbols-outlined">save</span>{mode === 'create' ? 'Add Product' : 'Save Changes'}</>
          )}
        </button>
      </div>

      <style jsx>{`
        .form-input {
          width: 100%;
          height: 3.5rem;
          padding: 0 1rem;
          background: var(--color-surface-container-low);
          border: 2px solid var(--color-outline-variant);
          border-radius: 0.75rem;
          font-size: 0.875rem;
          color: var(--color-on-surface);
          transition: border-color 0.2s;
        }
        .form-input:focus {
          border-color: var(--color-primary);
          outline: none;
        }
        .form-input:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-on-surface mb-2">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
```

### Step 6.4 — Product edit page

Create `apps/web/src/app/admin/products/[id]/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import { trpc } from '@/lib/trpc-client';
import { ProductForm } from '../new/page';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: product, isLoading } = trpc.products.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  if (!product) {
    return <p className="text-on-surface-variant p-8">Product not found</p>;
  }

  return <ProductForm mode="edit" initialData={product} />;
}
```

### Step 6.5 — CSV import wizard

Create `apps/web/src/app/admin/products/import/page.tsx`:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import Papa from 'papaparse';

type Step = 'upload' | 'preview' | 'mapping' | 'importing' | 'done';

interface ParsedRow {
  [key: string]: string;
}

const FIELD_OPTIONS = [
  { key: 'name', label: 'Product Name', required: true },
  { key: 'costPrice', label: 'Cost Price', required: true },
  { key: 'retailPrice', label: 'Retail Price', required: true },
  { key: 'barcode', label: 'Barcode', required: false },
  { key: 'sku', label: 'SKU', required: false },
  { key: 'categoryName', label: 'Category', required: false },
  { key: 'location', label: 'Location', required: false },
  { key: 'supplier', label: 'Supplier', required: false },
  { key: '_skip', label: '— Skip —', required: false },
];

export default function ImportProductsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [rawData, setRawData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; errors: { row: number; reason: string }[] }>({ imported: 0, errors: [] });

  const importBatch = trpc.products.importBatch.useMutation();

  function handleFile(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data as ParsedRow[];
        const h = result.meta.fields ?? [];
        setRawData(data);
        setHeaders(h);
        setTotalRows(data.length);

        // Auto-map common headers
        const autoMap: Record<string, string> = {};
        for (const header of h) {
          const lower = header.toLowerCase().replace(/[^a-z]/g, '');
          if (lower.includes('name') || lower.includes('product') || lower.includes('description')) autoMap[header] = 'name';
          else if (lower.includes('cost')) autoMap[header] = 'costPrice';
          else if (lower.includes('retail') || lower.includes('price') || lower.includes('sell')) autoMap[header] = 'retailPrice';
          else if (lower.includes('barcode') || lower.includes('upc') || lower.includes('ean')) autoMap[header] = 'barcode';
          else if (lower.includes('sku') || lower.includes('code')) autoMap[header] = 'sku';
          else if (lower.includes('category') || lower.includes('dept')) autoMap[header] = 'categoryName';
          else if (lower.includes('location') || lower.includes('aisle')) autoMap[header] = 'location';
          else if (lower.includes('supplier') || lower.includes('vendor')) autoMap[header] = 'supplier';
          else autoMap[header] = '_skip';
        }
        setMapping(autoMap);
        setStep('preview');
      },
    });
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFile(file);
    }
  }, []);

  async function startImport() {
    setStep('importing');
    setProgress(0);

    // Build mapped rows
    const mappedRows = rawData.map((row) => {
      const mapped: any = {};
      for (const [header, field] of Object.entries(mapping)) {
        if (field !== '_skip' && row[header]) {
          mapped[field] = row[header];
        }
      }
      return mapped;
    }).filter((r) => r.name && (r.costPrice || r.retailPrice));

    // Convert numeric fields
    const processedRows = mappedRows.map((r) => ({
      ...r,
      costPrice: parseFloat(r.costPrice) || 0,
      retailPrice: parseFloat(r.retailPrice) || 0,
      markupPercent: r.costPrice > 0 ? ((parseFloat(r.retailPrice) - parseFloat(r.costPrice)) / parseFloat(r.costPrice)) * 100 : 0,
    }));

    // Send in batches of 200
    let totalImported = 0;
    const allErrors: { row: number; reason: string }[] = [];
    const batchSize = 200;

    for (let i = 0; i < processedRows.length; i += batchSize) {
      const batch = processedRows.slice(i, i + batchSize);
      try {
        const result = await importBatch.mutateAsync({ products: batch });
        totalImported += result.imported;
        allErrors.push(...result.errors.map(e => ({ row: e.row + i, reason: e.reason })));
      } catch {
        allErrors.push({ row: i, reason: 'Batch failed' });
      }
      setProgress(Math.min(i + batchSize, processedRows.length));
    }

    setImportResult({ imported: totalImported, errors: allErrors });
    setStep('done');
  }

  return (
    <div>
      <button onClick={() => router.push('/admin/products')} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Products
      </button>

      <h1 className="text-2xl font-black text-on-surface mb-6">Import Products</h1>

      {/* Progress steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['Upload', 'Preview', 'Map', 'Import'].map((s, i) => {
          const stepIdx = ['upload', 'preview', 'mapping', 'importing'].indexOf(step);
          const done = i < stepIdx || step === 'done';
          const active = i === stepIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                done ? 'bg-success text-white' : active ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {done ? <span className="material-symbols-outlined text-[16px]">check</span> : i + 1}
              </div>
              <span className={`text-xs ${active ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}>{s}</span>
              {i < 3 && <div className="w-8 h-0.5 bg-outline-variant" />}
            </div>
          );
        })}
      </div>

      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-outline-variant rounded-xl p-12 text-center hover:border-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant">upload_file</span>
          <p className="text-on-surface font-medium mt-3">Drop CSV file here</p>
          <p className="text-sm text-on-surface-variant mt-1">or click to select</p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="absolute inset-0 opacity-0 cursor-pointer"
            style={{ position: 'relative' }}
          />
          <label className="mt-4 inline-block px-6 py-3 bg-primary text-on-primary rounded-xl font-medium text-sm cursor-pointer">
            Choose File
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
            <p className="text-sm text-on-surface-variant mb-3">
              <span className="font-bold text-on-surface">{totalRows}</span> rows found. First 10 rows:
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="text-left p-2 text-on-surface-variant font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-outline-variant/50">
                      {headers.map((h) => (
                        <td key={h} className="p-2 text-on-surface whitespace-nowrap max-w-[150px] truncate">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button onClick={() => setStep('mapping')} className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl">
            Next: Map Columns
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <div className="space-y-4">
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-4">
            <p className="text-sm text-on-surface-variant">Map each CSV column to a product field:</p>
            {headers.map((header) => (
              <div key={header} className="flex items-center gap-4">
                <span className="text-sm font-medium text-on-surface w-40 truncate">{header}</span>
                <span className="material-symbols-outlined text-[18px] text-outline">arrow_forward</span>
                <select
                  value={mapping[header] ?? '_skip'}
                  onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                  className="flex-1 h-10 px-3 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface"
                >
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('preview')} className="px-6 py-3 bg-surface-container-high text-on-surface font-medium rounded-xl">
              Back
            </button>
            <button
              onClick={startImport}
              disabled={!Object.values(mapping).includes('name')}
              className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40"
            >
              Start Import ({totalRows} rows)
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm text-center">
          <span className="material-symbols-outlined animate-spin text-primary text-[48px]">progress_activity</span>
          <p className="text-on-surface font-bold mt-4">Importing products...</p>
          <div className="w-full bg-surface-container-high rounded-full h-3 mt-4 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${totalRows > 0 ? (progress / totalRows) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-on-surface-variant mt-2">{progress} of {totalRows} rows processed</p>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm text-center space-y-4">
          <span className="material-symbols-outlined text-success text-[48px]">check_circle</span>
          <h3 className="text-xl font-bold text-on-surface">Import Complete</h3>
          <p className="text-on-surface-variant">
            <span className="font-bold text-success">{importResult.imported}</span> products imported.
            {importResult.errors.length > 0 && (
              <> <span className="font-bold text-error">{importResult.errors.length}</span> rows skipped.</>
            )}
          </p>

          {importResult.errors.length > 0 && (
            <div className="text-left bg-error/5 rounded-xl p-4 max-h-48 overflow-y-auto">
              <p className="text-xs font-bold text-error mb-2">Skipped Rows:</p>
              {importResult.errors.slice(0, 20).map((e, i) => (
                <p key={i} className="text-xs text-on-surface-variant">Row {e.row + 1}: {e.reason}</p>
              ))}
              {importResult.errors.length > 20 && (
                <p className="text-xs text-on-surface-variant mt-1">...and {importResult.errors.length - 20} more</p>
              )}
            </div>
          )}

          <button
            onClick={() => router.push('/admin/products')}
            className="px-6 py-3 bg-primary text-on-primary font-bold rounded-xl"
          >
            View Products
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 6.6 — Categories admin page

Create `apps/web/src/app/admin/categories/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

export default function AdminCategoriesPage() {
  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.categories.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMarkup, setNewMarkup] = useState('30');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMarkup, setEditMarkup] = useState('');

  const create = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      setShowCreate(false);
      setNewName('');
      setNewMarkup('30');
    },
  });

  const update = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      setEditingId(null);
    },
  });

  const remove = trpc.categories.delete.useMutation({
    onSuccess: () => utils.categories.list.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Categories</h1>
          <p className="text-on-surface-variant mt-1">Manage product categories and markup defaults</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-primary text-on-primary rounded-xl font-medium text-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Category
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm mb-4 space-y-4">
          <h3 className="font-bold text-on-surface">New Category</h3>
          <div className="flex gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              className="flex-1 h-12 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm"
              autoFocus
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={newMarkup}
                onChange={(e) => setNewMarkup(e.target.value)}
                className="w-20 h-12 px-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-center"
              />
              <span className="text-sm text-on-surface-variant">%</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => create.mutate({ name: newName, defaultMarkupPercent: parseFloat(newMarkup) || 0 })}
              disabled={!newName.trim() || create.isPending}
              className="px-4 py-2.5 bg-primary text-on-primary rounded-xl font-medium text-sm disabled:opacity-40"
            >
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-surface-container-high text-on-surface-variant rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Category list */}
      {categories && categories.length > 0 ? (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
              {editingId === cat.id ? (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-10 px-3 bg-surface-container-low border-2 border-primary rounded-lg text-sm"
                      autoFocus
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editMarkup}
                        onChange={(e) => setEditMarkup(e.target.value)}
                        className="w-20 h-10 px-3 bg-surface-container-low border-2 border-primary rounded-lg text-sm text-center"
                      />
                      <span className="text-sm text-on-surface-variant">%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => update.mutate({
                        id: cat.id,
                        name: editName,
                        defaultMarkupPercent: parseFloat(editMarkup) || 0,
                      })}
                      className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold"
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded-lg text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-on-surface">{cat.name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{cat._count.products} products</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-on-surface">{Number(cat.defaultMarkupPercent)}%</span>
                    <button
                      onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditMarkup(String(Number(cat.defaultMarkupPercent))); }}
                      className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${cat.name}"?`)) remove.mutate({ id: cat.id }); }}
                      className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center"
                      disabled={cat._count.products > 0}
                      title={cat._count.products > 0 ? 'Cannot delete with products' : 'Delete'}
                    >
                      <span className="material-symbols-outlined text-[18px] text-error">delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="category" title="No categories" description="Create your first category to organize products" />
      )}
    </div>
  );
}
```

### Commit message
```
feat(admin): add product CRUD, CSV import wizard, and category management

Product admin: searchable list, create/edit form with auto-markup
calculation, stock status toggle.
CSV import: 4-step wizard (upload, preview, column mapping, batch import
with progress bar). PapaParse for client-side parsing.
Categories: inline CRUD with product counts and delete protection.
```

---

## Task 7: Closing Checklist UI (Staff Fill-Out)

### Files to create

- `apps/web/src/app/tools/closing-checklist/page.tsx`

### Step 7.1 — Closing checklist page

Create `apps/web/src/app/tools/closing-checklist/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

type ItemStatus = 'DONE' | 'SKIPPED' | 'NOT_APPLICABLE' | null;

interface ItemState {
  templateItemId: string;
  status: ItemStatus;
  reason: string;
}

export default function ClosingChecklistPage() {
  const router = useRouter();
  const { data: templates, isLoading } = trpc.checklists.listTemplates.useQuery();

  // If only one template, auto-select it
  const singleTemplate = templates?.length === 1 ? templates[0] : null;
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const activeTemplateId = selectedTemplateId ?? singleTemplate?.id ?? null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="px-[--spacing-container] py-6">
        <button onClick={() => router.push('/tools')} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Tools
        </button>
        <EmptyState icon="checklist" title="No checklists" description="Ask a manager to create a checklist template" />
      </div>
    );
  }

  // Template selection screen
  if (!activeTemplateId) {
    return (
      <div>
        <section className="px-[--spacing-container] pt-6 pb-4">
          <button onClick={() => router.push('/tools')} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Tools
          </button>
          <h2 className="text-2xl font-bold text-on-surface">Closing Checklist</h2>
          <p className="text-sm text-on-surface-variant mt-1">Select a checklist to fill out</p>
        </section>

        <section className="px-[--spacing-container] pb-24 space-y-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplateId(t.id)}
              className="w-full bg-surface-container-lowest rounded-xl p-5 shadow-sm text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-on-surface">{t.name}</p>
                  <p className="text-sm text-on-surface-variant mt-0.5">{t._count.items} items</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </div>
            </button>
          ))}
        </section>
      </div>
    );
  }

  return <ChecklistFillout templateId={activeTemplateId} onBack={() => setSelectedTemplateId(null)} />;
}

function ChecklistFillout({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: template } = trpc.checklists.getTemplate.useQuery({ id: templateId });
  const { data: todayStatus } = trpc.checklists.todayStatus.useQuery({ templateId });

  const [itemStates, setItemStates] = useState<Map<string, ItemState>>(new Map());
  const [reasonModalItem, setReasonModalItem] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = trpc.checklists.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      utils.checklists.todayStatus.invalidate();
    },
  });

  if (!template) {
    return (
      <div className="flex justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  // Already submitted today
  if (todayStatus) {
    return (
      <div className="px-[--spacing-container] py-6">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        <div className="bg-success/10 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-success text-[48px]">task_alt</span>
          <h3 className="text-lg font-bold text-on-surface mt-3">Already Completed</h3>
          <p className="text-sm text-on-surface-variant mt-2">
            Submitted by {todayStatus.submittedBy.fullName} at {new Date(todayStatus.completedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="px-[--spacing-container] py-6 text-center">
        <div className="bg-success/10 rounded-xl p-8">
          <span className="material-symbols-outlined text-success text-[56px]">verified</span>
          <h3 className="text-xl font-bold text-on-surface mt-4">Checklist Complete</h3>
          <p className="text-sm text-on-surface-variant mt-2">
            {template.name} signed off at {new Date().toLocaleTimeString()}
          </p>
          <button
            onClick={() => router.push('/tools')}
            className="mt-6 px-6 py-3 bg-primary text-on-primary font-bold rounded-xl"
          >
            Back to Tools
          </button>
        </div>
      </div>
    );
  }

  const completedCount = itemStates.size;
  const totalItems = template.items.length;
  const allAddressed = completedCount === totalItems;

  function setItemStatus(templateItemId: string, status: ItemStatus) {
    if (status === 'SKIPPED' || status === 'NOT_APPLICABLE') {
      setReasonModalItem(templateItemId);
      setReasonText('');
      // Temporarily store the status
      setItemStates((prev) => {
        const map = new Map(prev);
        map.set(templateItemId, { templateItemId, status, reason: '' });
        return map;
      });
    } else {
      setItemStates((prev) => {
        const map = new Map(prev);
        map.set(templateItemId, { templateItemId, status, reason: '' });
        return map;
      });
    }
  }

  function saveReason() {
    if (!reasonModalItem) return;
    setItemStates((prev) => {
      const map = new Map(prev);
      const item = map.get(reasonModalItem);
      if (item) {
        map.set(reasonModalItem, { ...item, reason: reasonText });
      }
      return map;
    });
    setReasonModalItem(null);
  }

  function handleSubmit() {
    const items = Array.from(itemStates.values()).map((item) => ({
      templateItemId: item.templateItemId,
      status: item.status as 'DONE' | 'SKIPPED' | 'NOT_APPLICABLE',
      reason: item.reason || undefined,
    }));
    submit.mutate({ templateId, items, notes: notes || undefined });
    setShowConfirm(false);
  }

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        <h2 className="text-2xl font-bold text-on-surface">{template.name}</h2>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${totalItems > 0 ? (completedCount / totalItems) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-medium text-on-surface-variant">{completedCount}/{totalItems}</span>
        </div>
      </section>

      <section className="px-[--spacing-container] pb-32 space-y-3">
        {template.items.map((item) => {
          const state = itemStates.get(item.id);
          return (
            <div key={item.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className={`font-medium ${state ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                    {item.label}
                  </p>
                  {item.isRequired && !state && (
                    <span className="text-xs text-error">Required</span>
                  )}
                  {state?.status === 'SKIPPED' && (
                    <p className="text-xs text-amber-700 mt-1">Skipped: {state.reason || '(reason needed)'}</p>
                  )}
                  {state?.status === 'NOT_APPLICABLE' && (
                    <p className="text-xs text-on-surface-variant mt-1">N/A: {state.reason || '(reason needed)'}</p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setItemStatus(item.id, 'DONE')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    state?.status === 'DONE'
                      ? 'bg-success text-white'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Done
                </button>
                <button
                  onClick={() => setItemStatus(item.id, 'SKIPPED')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    state?.status === 'SKIPPED'
                      ? 'bg-amber-500 text-white'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">skip_next</span>
                  Skip
                </button>
                <button
                  onClick={() => setItemStatus(item.id, 'NOT_APPLICABLE')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    state?.status === 'NOT_APPLICABLE'
                      ? 'bg-gray-500 text-white'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                  N/A
                </button>
              </div>
            </div>
          );
        })}

        {/* Notes */}
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-on-surface mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
            className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-outline resize-none"
          />
        </div>
      </section>

      {/* Submit button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-outline-variant">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!allAddressed || submit.isPending}
          className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">verified</span>
          Submit & Sign Off
        </button>
      </div>

      {/* Reason modal */}
      {reasonModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-t-2xl p-6 space-y-4 animate-slide-up">
            <h3 className="font-bold text-on-surface">Reason Required</h3>
            <p className="text-sm text-on-surface-variant">
              Why is this item being {itemStates.get(reasonModalItem)?.status === 'SKIPPED' ? 'skipped' : 'marked N/A'}?
            </p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Enter reason..."
              rows={3}
              className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface resize-none"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Remove the item state if no reason
                  setItemStates((prev) => {
                    const map = new Map(prev);
                    map.delete(reasonModalItem);
                    return map;
                  });
                  setReasonModalItem(null);
                }}
                className="flex-1 py-3 bg-surface-container-high text-on-surface-variant rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveReason}
                disabled={!reasonText.trim()}
                className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-on-surface text-lg">Confirm Sign-Off</h3>
            <p className="text-sm text-on-surface-variant">
              This will record the closing checklist as complete. It cannot be edited after submission.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-surface-container-high text-on-surface-variant rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submit.isPending}
                className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold disabled:opacity-40"
              >
                {submit.isPending ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Commit message
```
feat(tools): add Closing Checklist fill-out flow

Template selection (or auto-select if only one), ordered item cards
with Done/Skipped/N/A buttons, mandatory reason modal for non-Done items,
progress bar, submit confirmation, already-submitted guard.
```

---

## Task 8: Checklist Admin (Template Management + Submission History)

### Files to create

- `apps/web/src/app/admin/checklists/page.tsx`
- `apps/web/src/app/admin/checklists/[id]/page.tsx`
- `apps/web/src/app/admin/checklists/submissions/page.tsx`

### Step 8.1 — Checklist template list/create

Create `apps/web/src/app/admin/checklists/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

export default function AdminChecklistsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.checklists.listTemplates.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newItems, setNewItems] = useState<{ label: string; isRequired: boolean }[]>([
    { label: '', isRequired: true },
  ]);

  const create = trpc.checklists.createTemplate.useMutation({
    onSuccess: () => {
      utils.checklists.listTemplates.invalidate();
      setShowCreate(false);
      setNewName('');
      setNewItems([{ label: '', isRequired: true }]);
    },
  });

  function addItem() {
    setNewItems([...newItems, { label: '', isRequired: true }]);
  }

  function removeItem(idx: number) {
    setNewItems(newItems.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: 'label' | 'isRequired', value: any) {
    setNewItems(newItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function handleCreate() {
    const validItems = newItems.filter(i => i.label.trim());
    if (!newName.trim() || validItems.length === 0) return;
    create.mutate({ name: newName, items: validItems });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-on-surface">Checklists</h1>
          <p className="text-on-surface-variant mt-1">Manage checklist templates</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/checklists/submissions')}
            className="px-4 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-medium text-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            History
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-primary text-on-primary rounded-xl font-medium text-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Template
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm mb-6 space-y-4">
          <h3 className="font-bold text-on-surface text-lg">New Checklist Template</h3>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Template Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Nightly Closing"
              className="w-full h-12 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Items</label>
            <div className="space-y-2">
              {newItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant w-5">{idx + 1}.</span>
                  <input
                    value={item.label}
                    onChange={(e) => updateItem(idx, 'label', e.target.value)}
                    placeholder="Checklist item"
                    className="flex-1 h-10 px-3 bg-surface-container-low border border-outline-variant rounded-lg text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={() => updateItem(idx, 'isRequired', !item.isRequired)}
                    className={`px-2 py-1 rounded text-xs font-medium ${item.isRequired ? 'bg-error/10 text-error' : 'bg-surface-container-high text-on-surface-variant'}`}
                    title={item.isRequired ? 'Required' : 'Optional'}
                  >
                    {item.isRequired ? 'Req' : 'Opt'}
                  </button>
                  {newItems.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-error">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-sm text-primary font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add item
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newItems.some(i => i.label.trim()) || create.isPending}
              className="px-4 py-2.5 bg-primary text-on-primary rounded-xl font-medium text-sm disabled:opacity-40"
            >
              {create.isPending ? 'Creating...' : 'Create Template'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 bg-surface-container-high text-on-surface-variant rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/admin/checklists/${t.id}`)}
              className="w-full bg-surface-container-lowest rounded-xl p-5 shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-on-surface">{t.name}</p>
                  <p className="text-sm text-on-surface-variant mt-0.5">{t._count.items} items</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon="checklist" title="No templates" description="Create a checklist template for your team" />
      )}
    </div>
  );
}
```

### Step 8.2 — Edit template page

Create `apps/web/src/app/admin/checklists/[id]/page.tsx`:

```tsx
'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function EditChecklistTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: template, isLoading } = trpc.checklists.getTemplate.useQuery({ id });

  const [name, setName] = useState('');
  const [items, setItems] = useState<{ id?: string; label: string; isRequired: boolean }[]>([]);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setItems(template.items.map(i => ({ id: i.id, label: i.label, isRequired: i.isRequired })));
    }
  }, [template]);

  const update = trpc.checklists.updateTemplate.useMutation({
    onSuccess: () => {
      utils.checklists.invalidate();
      router.push('/admin/checklists');
    },
  });

  function addItem() {
    setItems([...items, { label: '', isRequired: true }]);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  function moveItem(idx: number, direction: 'up' | 'down') {
    const newItems = [...items];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    [newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]];
    setItems(newItems);
  }

  function handleSave() {
    const validItems = items.filter(i => i.label.trim());
    update.mutate({ id, name, items: validItems });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.push('/admin/checklists')} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Checklists
      </button>

      <h1 className="text-2xl font-black text-on-surface mb-6">Edit Template</h1>

      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm space-y-5 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-12 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-3">Items (drag to reorder)</label>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-surface-container-low rounded-xl p-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveItem(idx, 'up')}
                    disabled={idx === 0}
                    className="text-on-surface-variant disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
                  </button>
                  <button
                    onClick={() => moveItem(idx, 'down')}
                    disabled={idx === items.length - 1}
                    className="text-on-surface-variant disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
                  </button>
                </div>
                <span className="text-xs text-on-surface-variant w-5">{idx + 1}.</span>
                <input
                  value={item.label}
                  onChange={(e) => {
                    const updated = [...items];
                    updated[idx] = { ...updated[idx], label: e.target.value };
                    setItems(updated);
                  }}
                  className="flex-1 h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => {
                    const updated = [...items];
                    updated[idx] = { ...updated[idx], isRequired: !updated[idx].isRequired };
                    setItems(updated);
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium ${item.isRequired ? 'bg-error/10 text-error' : 'bg-surface-container-high text-on-surface-variant'}`}
                >
                  {item.isRequired ? 'Req' : 'Opt'}
                </button>
                <button onClick={() => removeItem(idx)} className="text-error">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))}
          </div>
          <button onClick={addItem} className="mt-3 text-sm text-primary font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add item
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={!name.trim() || !items.some(i => i.label.trim()) || update.isPending}
            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-40"
          >
            {update.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => router.push('/admin/checklists')}
            className="px-6 py-3 bg-surface-container-high text-on-surface-variant rounded-xl text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 8.3 — Submission history page

Create `apps/web/src/app/admin/checklists/submissions/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

export default function ChecklistSubmissionsPage() {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: submissions, isLoading } = trpc.checklists.listSubmissions.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => router.push('/admin/checklists')} className="flex items-center gap-1 text-sm text-on-surface-variant mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Checklists
      </button>

      <h1 className="text-2xl font-black text-on-surface mb-2">Submission History</h1>
      <p className="text-on-surface-variant mb-6">View past checklist submissions</p>

      {submissions && submissions.length > 0 ? (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <SubmissionCard
              key={sub.id}
              submission={sub}
              expanded={expandedId === sub.id}
              onToggle={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon="history" title="No submissions yet" description="Submissions will appear here after checklists are completed" />
      )}
    </div>
  );
}

function SubmissionCard({ submission, expanded, onToggle }: { submission: any; expanded: boolean; onToggle: () => void }) {
  const { data: detail } = trpc.checklists.getSubmission.useQuery(
    { id: submission.id },
    { enabled: expanded }
  );

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full p-5 text-left">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-on-surface">{submission.template.name}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-on-surface-variant">
                {new Date(submission.date).toLocaleDateString()}
              </span>
              <span className="text-sm text-on-surface-variant">
                by {submission.submittedBy.fullName}
              </span>
            </div>
          </div>
          <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${expanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {expanded && detail && (
        <div className="px-5 pb-5 border-t border-outline-variant/50 pt-4 space-y-2">
          <p className="text-xs text-on-surface-variant mb-3">
            Completed at {new Date(detail.completedAt).toLocaleTimeString()}
          </p>
          {detail.items.map((item: any) => (
            <div
              key={item.id}
              className={`flex items-start justify-between py-2 px-3 rounded-lg ${
                item.status === 'DONE' ? 'bg-success/5' :
                item.status === 'SKIPPED' ? 'bg-amber-50' : 'bg-gray-50'
              }`}
            >
              <div className="flex-1">
                <p className="text-sm text-on-surface">{item.templateItem.label}</p>
                {item.reason && (
                  <p className={`text-xs mt-0.5 ${item.status === 'SKIPPED' ? 'text-amber-700' : 'text-on-surface-variant'}`}>
                    {item.reason}
                  </p>
                )}
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                item.status === 'DONE' ? 'text-success' :
                item.status === 'SKIPPED' ? 'text-amber-700' : 'text-on-surface-variant'
              }`}>
                {item.status === 'DONE' ? 'Done' : item.status === 'SKIPPED' ? 'Skipped' : 'N/A'}
              </span>
            </div>
          ))}
          {detail.notes && (
            <div className="mt-3 pt-3 border-t border-outline-variant/50">
              <p className="text-xs text-on-surface-variant">Notes: {detail.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Commit message
```
feat(admin): add checklist template management and submission history

Template list with create form (name + items with required toggle).
Edit page: reorder items with up/down arrows, add/remove/edit labels.
Submission history: expandable cards showing item statuses and reasons,
skipped items highlighted.
```

---

## Task 9: Admin Sidebar Update + Integration

### Files to modify

- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/tools/page.tsx`

### Step 9.1 — Update admin sidebar with new nav items

Update `apps/web/src/app/admin/layout.tsx`:

```tsx
import { Sidebar } from '@superplus/ui';

const adminNav = [
  { label: 'Dashboard', icon: 'dashboard', href: '/admin' },
  { label: 'People', icon: 'group', href: '/admin/people' },
  { label: 'Products', icon: 'inventory_2', href: '/admin/products' },
  { label: 'Categories', icon: 'category', href: '/admin/categories' },
  { label: 'Checklists', icon: 'checklist', href: '/admin/checklists' },
  { label: 'Activity', icon: 'timeline', href: '/admin/activity' },
  { label: 'Stores', icon: 'store', href: '/admin/stores' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar items={adminNav} title="SuperPlus" />
      <main className="ml-64 flex-1 min-h-dvh bg-surface p-8">
        {children}
      </main>
    </div>
  );
}
```

### Step 9.2 — Update tools page icon grid

Update `apps/web/src/app/tools/page.tsx` to ensure links match new routes:

```tsx
import { IconGrid } from '@superplus/ui';

const toolItems = [
  { label: 'Pricing', icon: 'calculate', href: '/tools/pricing', color: '#446185' },
  { label: 'Lookup', icon: 'search', href: '/tools/product-lookup', color: '#2e7d32' },
  { label: 'Checklist', icon: 'checklist', href: '/tools/closing-checklist', color: '#c00029' },
];

export default function ToolsPage() {
  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-2">
        <h2 className="text-2xl font-bold text-on-surface">Tools</h2>
        <p className="text-sm text-on-surface-variant mt-1">Quick-access store tools</p>
      </section>

      <IconGrid items={toolItems} />

      <p className="text-center text-xs text-outline mt-4 px-[--spacing-container]">
        More tools coming soon
      </p>
    </div>
  );
}
```

### Step 9.3 — Verify build

```bash
cd apps/web && pnpm build
```

### Commit message
```
feat: wire up admin sidebar + tools grid for Phase 2

Admin sidebar: Products, Categories, Checklists links added.
Tools page: updated icon grid to link to pricing, product-lookup,
and closing-checklist routes. Removed old markup placeholder.
```

---

## Execution Notes

### Dependency on prior tasks
- Tasks 2-3 depend on Task 1 (schema must exist)
- Tasks 4-5 depend on Task 2 (products/categories routers)
- Task 6 depends on Task 2 + PapaParse install
- Tasks 7-8 depend on Task 3 (checklists router)
- Task 9 depends on all prior tasks (links must resolve)

### Parallelizable work
- Tasks 4 + 7 can run in parallel (different tools, different routers)
- Tasks 5 + 8 can run in parallel
- Task 6 must follow Task 5 (shared `ProductForm` component)

### Post-build verification
After all tasks:
1. `prisma db push` succeeds
2. `pnpm build` compiles without errors
3. All routes resolve correctly
4. tRPC type inference works end-to-end
5. Role-based field filtering works (staff vs supervisor)
6. CSV import handles errors gracefully

### Files created (summary)
```
packages/db/prisma/schema.prisma              (modified)
packages/db/prisma/seed.ts                    (modified)
packages/db/src/index.ts                      (modified)
apps/web/src/server/trpc/router.ts            (modified)
apps/web/src/server/trpc/routers/products.ts  (new)
apps/web/src/server/trpc/routers/categories.ts (new)
apps/web/src/server/trpc/routers/checklists.ts (new)
apps/web/src/app/tools/page.tsx               (modified)
apps/web/src/app/tools/pricing/page.tsx       (new)
apps/web/src/app/tools/product-lookup/page.tsx (new)
apps/web/src/app/tools/product-lookup/barcode-scanner.tsx (new)
apps/web/src/app/tools/product-lookup/[id]/page.tsx (new)
apps/web/src/app/admin/layout.tsx             (modified)
apps/web/src/app/admin/products/page.tsx      (new)
apps/web/src/app/admin/products/new/page.tsx  (new)
apps/web/src/app/admin/products/[id]/page.tsx (new)
apps/web/src/app/admin/products/import/page.tsx (new)
apps/web/src/app/admin/categories/page.tsx    (new)
apps/web/src/app/admin/checklists/page.tsx    (new)
apps/web/src/app/admin/checklists/[id]/page.tsx (new)
apps/web/src/app/admin/checklists/submissions/page.tsx (new)
```
