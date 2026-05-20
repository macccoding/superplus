import assert from 'node:assert/strict';
import { productsRouter } from './products';

const stores = [
  { id: 'store-a', name: 'Cross Roads', isActive: true },
  { id: 'store-b', name: 'Half Way Tree', isActive: true },
];

function ctx(role: string, storeId = 'store-a', overrides: any = {}) {
  const db: any = {
    store: {
      findMany: async () => stores,
      findFirst: async ({ where }: any) => stores.find((store) => store.id === where.id && store.isActive === where.isActive) ?? null,
    },
    adminActionLog: { create: async ({ data }: any) => data },
    ...overrides,
  };
  return {
    session: { user: { id: `${role.toLowerCase()}-1`, name: role, role, storeId } },
    db,
  };
}

async function main() {
  let searchWhere: any;
  const staffCaller = productsRouter.createCaller(ctx('STAFF', 'store-a', {
    product: {
      findMany: async ({ where }: any) => {
        searchWhere = where;
        return [{
          id: 'p-1',
          storeId: 'store-a',
          name: 'Grace Corned Beef',
          brand: 'Grace',
          barcode: '12345678',
          sku: 'CB-1',
          costPrice: 100,
          retailPrice: 130,
          markupPercent: 30,
          supplier: 'Supplier',
          useCustomMarkup: false,
          stockStatus: 'IN_STOCK',
          category: { name: 'Grocery' },
        }];
      },
    },
  }) as any);
  const search = await staffCaller.search({ query: 'Grace', limit: 20 });
  assert.equal(searchWhere.storeId, 'store-a');
  assert.ok(Array.isArray(searchWhere.OR));
  assert.equal(search.items[0].costPrice, null);
  assert.equal(search.items[0].markupPercent, null);
  assert.equal(search.items[0].supplier, null);
  assert.equal(search.items[0].matchReason, 'Brand match');

  const importCalls: string[] = [];
  const importCaller = productsRouter.createCaller(ctx('MANAGER', 'store-a', {
    category: {
      findUnique: async () => ({ id: 'cat-1', name: 'Grocery' }),
      create: async () => ({ id: 'cat-new', name: 'New' }),
    },
    product: {
      findFirst: async ({ where }: any) => where.OR?.some((clause: any) => clause.barcode === '12345678') ? { id: 'existing-1' } : null,
      update: async () => { importCalls.push('update'); return { id: 'existing-1' }; },
      create: async () => { importCalls.push('create'); return { id: 'new-1' }; },
    },
  }) as any);
  const result = await importCaller.importBatch({
    upsert: true,
    importSource: 'POS test',
    products: [
      { name: 'Grace Beef', barcode: '12345678', sku: 'A1', categoryName: 'Grocery', costPrice: 100, retailPrice: 130 },
      { name: 'Duplicate SKU', sku: 'A1', costPrice: 100, retailPrice: 130 },
      { name: 'New Rice', sku: 'B1', categoryName: 'Grocery', costPrice: 200, retailPrice: 260 },
    ],
  });
  assert.equal(result.updated, 1);
  assert.equal(result.imported, 1);
  assert.equal(result.errors.length, 1);
  assert.deepEqual(importCalls, ['update', 'create']);

  const qaCaller = productsRouter.createCaller(ctx('OWNER', 'store-a', {
    product: {
      findMany: async () => [
        { id: 'p-1', name: 'Rice 1kg', barcode: null, sku: null, costPrice: 0, retailPrice: 100, markupPercent: 0, categoryId: null, location: null, lastImportedAt: null },
        { id: 'p-2', name: 'Rice 1kg', barcode: '11111111', sku: 'RICE-1', costPrice: 100, retailPrice: 105, markupPercent: 5, categoryId: 'cat-1', location: 'Aisle 1', lastImportedAt: new Date() },
      ],
    },
  }) as any);
  const qa = await qaCaller.qa({ scope: 'ALL', lowMarginThreshold: 10 });
  assert.equal(qa.summary.missingBarcodeOrSku, 1);
  assert.equal(qa.summary.duplicateLookingNames, 2);
  assert.equal(qa.summary.zeroCost, 1);
  assert.equal(qa.summary.lowMargin, 2);

  console.log('Product foundation tests passed');
}

main().catch((error) => {
  throw error;
});
