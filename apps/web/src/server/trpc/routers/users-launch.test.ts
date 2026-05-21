import assert from 'node:assert/strict';
import { hash } from 'bcryptjs';
import { usersRouter } from './users';
import { storesRouter } from './stores';

function ctx(role = 'OWNER', storeId = 'store-a', overrides: any = {}) {
  return {
    session: { user: { id: `${role.toLowerCase()}-1`, name: role, role, storeId, mustChangePin: false } },
    db: overrides,
  };
}

async function main() {
  const publicCaller = usersRouter.createCaller(ctx('STAFF', 'store-a', {
    store: {
      findMany: async ({ where, select, orderBy }: any) => {
        assert.deepEqual(where, { isActive: true, launchEnabled: true });
        assert.ok(select.id);
        assert.equal(orderBy.name, 'asc');
        return [{ id: 'store-a', name: 'SuperPlus Santa Cruz', parish: 'Saint Elizabeth', address: 'Main Road' }];
      },
    },
    user: {
      findMany: async ({ where }: any) => {
        assert.equal(where.storeId, 'store-a');
        assert.deepEqual(where.store, { isActive: true, launchEnabled: true });
        return [
          { id: 'u-1', fullName: 'Camille Meyler', role: 'MANAGER', store: { name: 'SuperPlus Santa Cruz' } },
        ];
      },
    },
  }) as any);

  const stores = await publicCaller.loginStores();
  assert.equal(stores.length, 1);
  const staff = await publicCaller.loginList({ storeId: 'store-a' });
  assert.equal(staff[0].firstName, 'Camille');

  const pinHash = await hash('1234', 10);
  let pinUpdate: any;
  const resetCaller = usersRouter.createCaller(ctx('STAFF', 'store-a', {
    user: {
      findUniqueOrThrow: async () => ({ id: 'staff-1', pinHash }),
      update: async ({ data, select }: any) => {
        pinUpdate = { data, select };
        return { id: 'staff-1', fullName: 'Maya Brown', ...data };
      },
    },
  }) as any);

  await assert.rejects(
    () => resetCaller.changeMyPin({ currentPin: '1234', newPin: '1234', confirmPin: '1234' }),
    /new PIN/
  );
  await resetCaller.changeMyPin({ currentPin: '1234', newPin: '2468', confirmPin: '2468' });
  assert.equal(pinUpdate.data.mustChangePin, false);
  assert.ok(pinUpdate.data.pinChangedAt instanceof Date);

  let updateManyWhere: any;
  let storeUpdateData: any;
  const launchCaller = storesRouter.createCaller(ctx('OWNER', 'owner-store', {
    store: {
      findFirstOrThrow: async ({ where }: any) => {
        assert.equal(where.id, 'store-a');
        assert.equal(where.isActive, true);
        return { id: 'store-a', name: 'SuperPlus Santa Cruz' };
      },
      update: async ({ data }: any) => {
        storeUpdateData = data;
        return { id: 'store-a', ...data };
      },
    },
    user: {
      updateMany: async ({ where, data }: any) => {
        updateManyWhere = where;
        assert.equal(data.mustChangePin, true);
        assert.equal(data.onboardingVersion, 0);
        return { count: 23 };
      },
    },
    adminActionLog: { create: async () => ({ id: 'log-1' }) },
  }) as any);

  const launch = await launchCaller.prepareLaunch({ storeId: 'store-a', temporaryPin: '1234', launchNotes: 'Week 1' });
  assert.equal(launch.affectedUsers, 23);
  assert.deepEqual(updateManyWhere, { storeId: 'store-a', isActive: true });
  assert.equal(storeUpdateData.launchEnabled, true);

  console.log('Users launch tests passed');
}

main().catch((error) => {
  throw error;
});
