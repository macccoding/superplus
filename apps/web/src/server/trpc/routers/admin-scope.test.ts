import assert from 'node:assert/strict';
import { adminStoreIdWhere, adminStoreWhere, requireSingleAdminStore, resolveAdminScope } from './admin-scope';

const stores = [
  { id: 'store-a', name: 'Cross Roads', isActive: true },
  { id: 'store-b', name: 'Half Way Tree', isActive: true },
];

function ctx(role: string, storeId = 'store-a') {
  return {
    user: { role },
    storeId,
    db: {
      store: {
        findMany: async () => stores,
        findFirst: async ({ where }: any) => stores.find((store) => store.id === where.id && store.isActive === where.isActive) ?? null,
      },
    },
  };
}

async function main() {
  const managerAll = await resolveAdminScope(ctx('MANAGER'), 'ALL');
  assert.deepEqual(managerAll.storeIds, ['store-a']);
  assert.equal(managerAll.isAllStores, false);
  assert.deepEqual(adminStoreWhere(managerAll), { storeId: 'store-a' });
  assert.equal(adminStoreIdWhere(managerAll), 'store-a');
  assert.equal(requireSingleAdminStore(managerAll), 'store-a');

  const managerOther = await resolveAdminScope(ctx('MANAGER'), 'store-b');
  assert.deepEqual(managerOther.storeIds, ['store-a']);
  assert.equal(managerOther.isAllStores, false);

  const ownerAll = await resolveAdminScope(ctx('OWNER'), 'ALL');
  assert.deepEqual(ownerAll.storeIds, ['store-a', 'store-b']);
  assert.equal(ownerAll.isAllStores, true);
  assert.deepEqual(adminStoreWhere(ownerAll), { storeId: { in: ['store-a', 'store-b'] } });
  assert.deepEqual(adminStoreIdWhere(ownerAll), { in: ['store-a', 'store-b'] });
  assert.throws(() => requireSingleAdminStore(ownerAll), /Choose one store/);

  const ownerStore = await resolveAdminScope(ctx('OWNER'), 'store-b');
  assert.deepEqual(ownerStore.storeIds, ['store-b']);
  assert.equal(ownerStore.label, 'Half Way Tree');
  assert.deepEqual(adminStoreWhere(ownerStore), { storeId: 'store-b' });

  await assert.rejects(() => resolveAdminScope(ctx('OWNER'), 'missing'), /Store not found/);
  console.log('Admin scope tests passed');
}

main().catch((error) => {
  throw error;
});
