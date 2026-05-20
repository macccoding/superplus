import assert from 'node:assert/strict';
import { TRPCError } from '@trpc/server';
import { announcementsRouter } from './announcements';

const now = new Date('2026-05-19T12:00:00Z');
const stores = [
  { id: 'store-a', name: 'Cross Roads' },
  { id: 'store-b', name: 'Half Way Tree' },
];

function makeDb() {
  const announcements: any[] = [];
  const receipts: any[] = [];
  const notifications: any[] = [];
  const users = [
    { id: 'owner-1', storeId: 'store-a', isActive: true, fullName: 'Owner' },
    { id: 'manager-1', storeId: 'store-a', isActive: true, fullName: 'Manager' },
    { id: 'staff-a', storeId: 'store-a', isActive: true, fullName: 'Staff A' },
    { id: 'staff-b', storeId: 'store-b', isActive: true, fullName: 'Staff B' },
  ];
  return {
    data: { announcements, receipts, notifications, users },
    db: {
      user: {
        findMany: async ({ where, select }: any) => {
          const filtered = users.filter((user) => {
            if (where?.isActive !== undefined && user.isActive !== where.isActive) return false;
            if (where?.storeId && user.storeId !== where.storeId) return false;
            return true;
          });
          return select?.id ? filtered.map((user) => ({ id: user.id })) : filtered;
        },
      },
      notification: {
        create: async ({ data }: any) => {
          const notification = { id: `notification-${notifications.length + 1}`, ...data, isRead: false, createdAt: now };
          notifications.push(notification);
          return notification;
        },
      },
      notificationPreference: {
        findUnique: async () => null,
      },
      announcement: {
        create: async ({ data }: any) => {
          const announcement = {
            id: `announcement-${announcements.length + 1}`,
            ...data,
            createdAt: now,
            updatedAt: now,
            author: { id: data.authorId, fullName: 'Author', role: 'MANAGER' },
            store: data.storeId ? stores.find((store) => store.id === data.storeId) : null,
          };
          announcements.push(announcement);
          return announcement;
        },
        findMany: async ({ where, include }: any) => {
          const filtered = announcements.filter((announcement) => {
            if (where?.AND) {
              for (const clause of where.AND) {
                if (clause?.OR?.some((item: any) => item.storeId !== undefined) && !clause.OR.some((item: any) => item.storeId === announcement.storeId)) return false;
                if (clause?.OR?.some((item: any) => item.expiresAt !== undefined)) {
                  const active = announcement.expiresAt == null || announcement.expiresAt >= new Date();
                  if (!active) return false;
                }
                if (clause?.priority && announcement.priority !== clause.priority) return false;
              }
            }
            return true;
          });
          return filtered.map((announcement) => ({
            ...announcement,
            author: include?.author ? { id: announcement.authorId, fullName: 'Author', role: 'MANAGER' } : undefined,
            store: include?.store ? (announcement.storeId ? stores.find((store) => store.id === announcement.storeId) : null) : undefined,
            receipts: include?.receipts ? receipts.filter((receipt) => {
              if (include.receipts.where?.userId && receipt.userId !== include.receipts.where.userId) return false;
              return receipt.announcementId === announcement.id;
            }) : undefined,
          }));
        },
        findFirst: async ({ where }: any) => announcements.find((announcement) => {
          if (where.id && announcement.id !== where.id) return false;
          if (where.priority && announcement.priority !== where.priority) return false;
          if (where.OR?.some((item: any) => item.storeId !== undefined) && !where.OR.some((item: any) => item.storeId === announcement.storeId)) return false;
          if (where.OR?.some((item: any) => item.storeId === null) && announcement.storeId !== null && !where.OR.some((item: any) => item.storeId === announcement.storeId)) return false;
          if (where.AND?.length && announcement.expiresAt && announcement.expiresAt < new Date()) return false;
          return true;
        }) ?? null,
        update: async ({ where, data }: any) => {
          const announcement = announcements.find((item) => item.id === where.id);
          if (!announcement) throw new Error('not found');
          Object.assign(announcement, data, { updatedAt: now });
          return announcement;
        },
      },
      announcementReceipt: {
        createMany: async ({ data }: any) => {
          for (const item of data) {
            if (!receipts.some((receipt) => receipt.announcementId === item.announcementId && receipt.userId === item.userId)) {
              receipts.push({ id: `receipt-${receipts.length + 1}`, ...item, readAt: null, acknowledgedAt: null, createdAt: now });
            }
          }
          return { count: data.length };
        },
        upsert: async ({ where, create, update }: any) => {
          let receipt = receipts.find((item) => item.announcementId === where.announcementId_userId.announcementId && item.userId === where.announcementId_userId.userId);
          if (!receipt) {
            receipt = { id: `receipt-${receipts.length + 1}`, ...create, acknowledgedAt: null, createdAt: now };
            receipts.push(receipt);
          } else {
            Object.assign(receipt, update);
          }
          return receipt;
        },
        update: async ({ where, data }: any) => {
          const receipt = receipts.find((item) => item.announcementId === where.announcementId_userId.announcementId && item.userId === where.announcementId_userId.userId);
          if (!receipt) throw new TRPCError({ code: 'NOT_FOUND' });
          Object.assign(receipt, data);
          return receipt;
        },
      },
    },
  };
}

function caller(role: string, storeId = 'store-a', db = makeDb().db, id = `${role.toLowerCase()}-1`) {
  return announcementsRouter.createCaller({
    session: { user: { id, name: role, role, storeId } },
    db,
  } as any);
}

async function main() {
  const fixture = makeDb();
  const manager = caller('MANAGER', 'store-a', fixture.db);
  const normal = await manager.create({ title: 'Store meeting', body: 'Meet by receiving.', priority: 'NORMAL', broadcast: false });
  assert.equal(normal.storeId, 'store-a');
  assert.equal(fixture.data.notifications.length, 0);
  assert.equal(fixture.data.receipts.filter((receipt) => receipt.announcementId === normal.id).length, 3);

  await assert.rejects(
    () => manager.create({ title: 'All stores', body: 'Global note', priority: 'IMPORTANT', broadcast: true }),
    /Only owners can broadcast/
  );

  const owner = caller('OWNER', 'store-a', fixture.db);
  const global = await owner.create({ title: 'Storm prep', body: 'Secure outdoor stock.', priority: 'CRITICAL', broadcast: true });
  assert.equal(global.storeId, null);
  assert.equal(fixture.data.receipts.filter((receipt) => receipt.announcementId === global.id).length, fixture.data.users.length);
  assert.equal(fixture.data.notifications.length, fixture.data.users.length);

  const staff = caller('STAFF', 'store-a', fixture.db, 'staff-a');
  await assert.rejects(
    () => staff.create({ title: 'Nope', body: 'Nope', priority: 'NORMAL', broadcast: false }),
    /FORBIDDEN/
  );

  const list = await staff.list();
  assert.equal(list.some((item: any) => item.id === global.id), true);
  assert.equal(list.some((item: any) => item.id === normal.id), true);
  assert.equal(list[0].priority, 'CRITICAL');

  await staff.acknowledge({ id: global.id });
  assert.equal(fixture.data.receipts.find((receipt) => receipt.announcementId === global.id && receipt.userId === 'staff-a')?.acknowledgedAt instanceof Date, true);

  const important = await manager.create({ title: 'Price changes', body: 'Check shelf tags.', priority: 'IMPORTANT', broadcast: false });
  assert.equal(important.priority, 'IMPORTANT');
  assert.equal(fixture.data.receipts.filter((receipt) => receipt.announcementId === important.id).length, 3);
  assert.equal(fixture.data.notifications.filter((notification) => notification.title === 'Price changes').length, 3);

  const expired = await manager.create({ title: 'Old', body: 'Hidden', priority: 'NORMAL', broadcast: false, expiresAt: new Date('2020-01-01T23:59:59Z') });
  const afterExpired = await staff.list();
  assert.equal(afterExpired.some((item: any) => item.id === expired.id), false);

  await staff.markRead({ ids: [normal.id, important.id] });
  assert.equal(fixture.data.receipts.find((receipt) => receipt.announcementId === normal.id && receipt.userId === 'staff-a')?.readAt instanceof Date, true);

  console.log('Announcement policy tests passed');
}

main().catch((error) => {
  throw error;
});
