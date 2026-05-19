import assert from 'node:assert/strict';
import { adminRouter } from './admin';
import { ordersRouter } from './orders';
import { suggestionsRouter } from './suggestions';
import { suppliersRouter } from './suppliers';
import { usersRouter } from './users';

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
    ...overrides,
  };
  return {
    session: { user: { id: `${role.toLowerCase()}-1`, name: role, role, storeId } },
    db,
  };
}

async function main() {
  let suggestionWhere: any;
  const suggestionsCaller = suggestionsRouter.createCaller(ctx('MANAGER', 'store-a', {
    suggestion: {
      findMany: async ({ where }: any) => {
        suggestionWhere = where;
        return [{
          id: 'sug-1',
          storeId: 'store-a',
          body: 'Add clearer freezer labels',
          category: 'PROCESS',
          status: 'NEW',
          isAnonymous: true,
          author: { id: 'u-1', fullName: 'Hidden Staff' },
          respondedBy: null,
          createdAt: new Date(),
        }];
      },
    },
  }) as any);
  const suggestions = await suggestionsCaller.listAll({ scope: 'ALL' });
  assert.equal(suggestionWhere.storeId, 'store-a');
  assert.equal(suggestions[0].author, null);

  const usersCaller = usersRouter.createCaller(ctx('MANAGER', 'store-a', {
    user: {
      findMany: async ({ where }: any) => {
        assert.equal(where.storeId, 'store-a');
        return [{ id: 'u-1', fullName: 'Maya Brown', phone: '18765550123', role: 'STAFF', storeId: 'store-a', isActive: true, createdAt: new Date(), store: stores[0] }];
      },
    },
    task: {
      findMany: async ({ where }: any) => {
        assert.equal(where.storeId, 'store-a');
        return [{ id: 't-1', assignedToId: 'u-1', status: 'NEEDS_HELP', dueDate: new Date(Date.now() - 1000), updatedAt: new Date() }];
      },
    },
    adminActionLog: { findMany: async () => [] },
  }) as any);
  const staffOps = await usersCaller.staffOperations({ scope: 'ALL' });
  assert.equal(staffOps.summary.active, 1);
  assert.equal(staffOps.summary.overloaded, 1);

  const supplierOwnerCaller = suppliersRouter.createCaller(ctx('OWNER', 'store-a') as any);
  await assert.rejects(
    () => supplierOwnerCaller.create({ scope: 'ALL', name: 'Island Supplier' }),
    /Choose one store/
  );

  const orderOwnerCaller = ordersRouter.createCaller(ctx('OWNER', 'store-a') as any);
  await assert.rejects(
    () => orderOwnerCaller.create({ scope: 'ALL', supplierId: 'supplier-1', items: [{ productName: 'Rice', quantity: 1, unitCost: 10 }] }),
    /Choose one store/
  );

  const adminCaller = adminRouter.createCaller(ctx('OWNER', 'store-a', {
    stockOutReport: {
      findMany: async ({ where }: any) => {
        assert.deepEqual(where.storeId, { in: ['store-a', 'store-b'] });
        return [
          { id: 'stock-1', storeId: 'store-a', productId: 'p-1', productName: 'Rice', status: 'REPORTED', location: 'Aisle 1', createdAt: new Date(), store: stores[0], product: null, reportedBy: { id: 'u-1', fullName: 'Maya' } },
          { id: 'stock-2', storeId: 'store-a', productId: 'p-1', productName: 'Rice', status: 'ACKNOWLEDGED', location: 'Aisle 1', createdAt: new Date(), store: stores[0], product: null, reportedBy: { id: 'u-1', fullName: 'Maya' } },
        ];
      },
    },
    expiryAlert: { findMany: async () => [] },
    purchaseOrder: { findMany: async () => [] },
    supplier: { findMany: async () => [] },
  }) as any);
  const supply = await adminCaller.supplyOverview({ scope: 'ALL', days: 7 });
  assert.equal(supply.counts.repeatStockOuts, 1);
  assert.equal(supply.stockOuts[0].repeatCount, 2);

  console.log('Admin child policy tests passed');
}

main().catch((error) => {
  throw error;
});
