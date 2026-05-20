import assert from 'node:assert/strict';
import { settingsRouter } from './settings';

function createDb(initialValue?: string) {
  const store = new Map<string, { key: string; value: string; updatedById?: string }>();
  if (initialValue) store.set('releaseMode', { key: 'releaseMode', value: initialValue });

  return {
    store,
    appSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => store.get(where.key) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = store.get(where.key);
        const next = existing ? { ...existing, ...update } : create;
        store.set(where.key, next);
        return next;
      },
    },
  };
}

function caller(role: 'OWNER' | 'MANAGER' | 'STAFF', db = createDb()) {
  return settingsRouter.createCaller({
    db,
    session: {
      user: {
        id: `${role.toLowerCase()}-1`,
        role,
        storeId: 'store-1',
        storeName: 'SuperPlus',
      },
    },
  } as any);
}

async function main() {
  const missing = await caller('MANAGER').getReleaseMode();
  assert.equal(missing.mode, 'SIMPLIFIED');
  assert.equal(missing.canUpdate, false);

  const fullDb = createDb('FULL');
  const owner = caller('OWNER', fullDb);
  assert.deepEqual(await owner.getReleaseMode(), { mode: 'FULL', canUpdate: true });

  await owner.updateReleaseMode({ mode: 'SIMPLIFIED' });
  assert.equal((await owner.getReleaseMode()).mode, 'SIMPLIFIED');
  assert.equal(fullDb.store.get('releaseMode')?.updatedById, 'owner-1');

  await assert.rejects(
    () => caller('MANAGER', fullDb).updateReleaseMode({ mode: 'FULL' }),
    /FORBIDDEN/
  );

  await assert.rejects(
    () => caller('STAFF', fullDb).updateReleaseMode({ mode: 'FULL' }),
    /FORBIDDEN/
  );

  console.log('Settings policy tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
