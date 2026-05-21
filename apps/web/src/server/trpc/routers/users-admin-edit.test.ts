import assert from 'node:assert/strict';
import { usersRouter } from './users';

const stores = [
  { id: 'store-a', name: 'Cross Roads', isActive: true },
  { id: 'store-b', name: 'Half Way Tree', isActive: true },
];

const baseUsers = [
  { id: 'owner-1', storeId: 'store-a', fullName: 'Owner One', phone: '+18760000001', role: 'OWNER', jobLane: 'SUPERVISOR', isActive: true, createdAt: new Date(), store: stores[0] },
  { id: 'manager-1', storeId: 'store-a', fullName: 'Manager One', phone: '+18760000002', role: 'MANAGER', jobLane: 'SUPERVISOR', isActive: true, createdAt: new Date(), store: stores[0] },
  { id: 'staff-1', storeId: 'store-a', fullName: 'Maya Brown', phone: '+18760000003', role: 'STAFF', jobLane: 'CASHIER', isActive: true, createdAt: new Date(), store: stores[0] },
  { id: 'staff-2', storeId: 'store-b', fullName: 'Andre Green', phone: '+18760000004', role: 'STAFF', jobLane: 'MERCHANDISER', isActive: true, createdAt: new Date(), store: stores[1] },
];

function makeCtx(role = 'MANAGER', storeId = 'store-a') {
  const users = baseUsers.map((user) => ({ ...user }));
  const logs: any[] = [];
  const actor = role === 'OWNER' ? users[0] : users[1];
  const db: any = {
    store: {
      findFirstOrThrow: async ({ where }: any) => {
        const store = stores.find((item) => item.id === where.id && item.isActive === where.isActive);
        if (!store) throw new Error('Store not found');
        return store;
      },
    },
    user: {
      findFirstOrThrow: async ({ where }: any) => {
        const user = users.find((item) => {
          if (where.id && item.id !== where.id) return false;
          if (where.storeId && item.storeId !== where.storeId) return false;
          return true;
        });
        if (!user) throw new Error('User not found');
        return user;
      },
      findFirst: async ({ where }: any) => {
        return users.find((item) => item.phone === where.phone && item.id !== where.NOT?.id) ?? null;
      },
      update: async ({ where, data }: any) => {
        const index = users.findIndex((item) => item.id === where.id);
        assert.notEqual(index, -1);
        users[index] = { ...users[index], ...data, store: stores.find((store) => store.id === (data.storeId ?? users[index].storeId)) ?? users[index].store };
        return users[index];
      },
    },
    adminActionLog: {
      create: async ({ data }: any) => {
        logs.push(data);
        return { id: `log-${logs.length}`, ...data };
      },
    },
  };
  return {
    logs,
    users,
    caller: usersRouter.createCaller({
      session: { user: { id: actor.id, name: actor.fullName, role, storeId, mustChangePin: false } },
      db,
    } as any),
  };
}

async function main() {
  const manager = makeCtx('MANAGER');
  const updated = await manager.caller.updateStaffDetails({
    id: 'staff-1',
    fullName: 'Maya Clarke',
    phone: '+18760000033',
    role: 'SUPERVISOR',
    jobLane: 'SUPERVISOR',
    storeId: 'store-a',
  });
  assert.equal(updated.fullName, 'Maya Clarke');
  assert.equal(updated.role, 'SUPERVISOR');
  assert.equal(manager.logs[0].action, 'USER_DETAILS_UPDATED');

  await assert.rejects(
    () => manager.caller.updateStaffDetails({
      id: 'manager-1',
      fullName: 'Manager Edited',
      phone: '+18760000022',
      role: 'MANAGER',
      jobLane: 'SUPERVISOR',
      storeId: 'store-a',
    }),
    /equal or higher role/
  );

  await assert.rejects(
    () => manager.caller.updateStaffDetails({
      id: 'staff-1',
      fullName: 'Maya Clarke',
      phone: '+18760000002',
      role: 'STAFF',
      jobLane: 'CASHIER',
      storeId: 'store-a',
    }),
    /already assigned/
  );

  const owner = makeCtx('OWNER');
  const moved = await owner.caller.updateStaffDetails({
    id: 'staff-2',
    fullName: 'Andre Green',
    phone: '+18760000044',
    role: 'STAFF',
    jobLane: 'MERCHANDISER',
    storeId: 'store-a',
  });
  assert.equal(moved.storeId, 'store-a');

  console.log('Users admin edit tests passed');
}

main().catch((error) => {
  throw error;
});
