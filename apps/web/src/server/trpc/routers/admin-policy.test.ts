import assert from 'node:assert/strict';
import { adminRouter } from './admin';
import { logAdminAction } from './admin-audit';

const now = new Date();
const stores = [
  { id: 'store-a', name: 'Cross Roads', parish: 'Kingston', address: '', isActive: true },
  { id: 'store-b', name: 'Half Way Tree', parish: 'St Andrew', address: '', isActive: true },
];

function baseCtx(role: string, storeId = 'store-a') {
  const logs: any[] = [];
  const db: any = {
    store: {
      findMany: async () => stores,
      findFirst: async ({ where }: any) => stores.find((store) => store.id === where.id && store.isActive === where.isActive) ?? null,
      count: async () => stores.length,
    },
    task: {
      findMany: async ({ where }: any) => {
        if (where?.status === 'NEEDS_HELP') return [{
          id: 'help-1',
          storeId: 'store-a',
          title: 'Till needs help',
          status: 'NEEDS_HELP',
          helpRequestedAt: new Date(now.getTime() - 7200000),
          updatedAt: new Date(now.getTime() - 7200000),
          store: stores[0],
          assignedTo: { fullName: 'Maya' },
        }];
        if (where?.dueDate?.lt) return [{
          id: 'late-1',
          storeId: 'store-a',
          title: 'Late freezer check',
          status: 'OPEN',
          dueDate: new Date(now.getTime() - 3600000),
          createdAt: now,
          store: stores[0],
          assignedTo: null,
        }];
        return [];
      },
      count: async () => 0,
      groupBy: async () => [],
    },
    logEntry: { findMany: async () => [], count: async () => 0 },
    incident: { findMany: async () => [], count: async () => 0 },
    stockOutReport: { findMany: async () => [], count: async () => 0 },
    expiryAlert: { findMany: async () => [], count: async () => 0 },
    suggestion: { findMany: async () => [], count: async () => 0 },
    purchaseOrder: { findMany: async () => [], count: async () => 0 },
    checklistTemplate: { findMany: async () => [], count: async () => 0 },
    checklistSubmission: { findMany: async () => [], count: async () => 0 },
    user: { findMany: async () => [], count: async () => 0 },
    thread: { findMany: async () => [] },
    adminActionLog: {
      create: async ({ data }: any) => {
        logs.push(data);
        return { id: `log-${logs.length}`, ...data, createdAt: now };
      },
      findMany: async () => logs.map((log, index) => ({ id: `log-${index + 1}`, ...log, createdAt: now })),
    },
  };
  return {
    logs,
    ctx: {
      session: { user: { id: `${role.toLowerCase()}-1`, name: role, role, storeId } },
      db,
    },
  };
}

async function main() {
  const manager = baseCtx('MANAGER');
  const managerCaller = adminRouter.createCaller(manager.ctx as any);
  const attention = await managerCaller.attention({ scope: 'ALL', take: 5 });
  assert.equal(attention[0].type, 'OVERDUE_TASK');
  assert.equal(attention[0].severity, 'danger');
  assert.equal(attention.every((item: any) => item.storeId === 'store-a'), true);

  await assert.rejects(
    () => managerCaller.storeOperations({ storeId: 'store-b', days: 7 }),
    /outside your admin scope/
  );

  const owner = baseCtx('OWNER');
  await logAdminAction(owner.ctx.db, 'owner-1', 'ALL', {
    action: 'DUE_REMINDERS_SENT',
    sourceType: 'TASK',
    note: 'Sent 2 due reminders',
    metadata: { count: 2 },
  });
  assert.equal(owner.logs.length, 1);
  assert.equal(owner.logs[0].scope, 'ALL');
  assert.equal(owner.logs[0].action, 'DUE_REMINDERS_SENT');

  console.log('Admin policy tests passed');
}

main().catch((error) => {
  throw error;
});
