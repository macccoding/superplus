import assert from 'node:assert/strict';
import { expiryAlertsRouter } from './expiryAlerts';
import { stockOutsRouter } from './stockOuts';

function ctx(overrides: any = {}) {
  return {
    session: { user: { id: 'staff-1', name: 'Staff', role: 'STAFF', storeId: 'store-a' } },
    db: {
      product: {
        findFirstOrThrow: async ({ where }: any) => {
          assert.equal(where.storeId, 'store-a');
          assert.equal(where.id, 'product-1');
          return { id: 'product-1' };
        },
      },
      stockOutReport: {
        create: async ({ data }: any) => data,
      },
      expiryAlert: {
        create: async ({ data }: any) => data,
      },
      user: { findMany: async () => { throw new Error('notification path intentionally unavailable'); } },
      ...overrides,
    },
  };
}

async function main() {
  const stockCaller = stockOutsRouter.createCaller(ctx() as any);
  const stockOut = await stockCaller.create({ productId: 'product-1', productName: 'Rice', location: 'Aisle 1' });
  assert.equal(stockOut.productId, 'product-1');
  assert.equal(stockOut.storeId, 'store-a');

  const expiryCaller = expiryAlertsRouter.createCaller(ctx() as any);
  const expiry = await expiryCaller.create({ productId: 'product-1', productName: 'Rice', expiryDate: new Date('2026-06-01'), quantity: 2 });
  assert.equal(expiry.productId, 'product-1');
  assert.equal(expiry.storeId, 'store-a');

  console.log('Tool linking tests passed');
}

main().catch((error) => {
  throw error;
});
