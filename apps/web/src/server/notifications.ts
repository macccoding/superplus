import { db as _db } from '@superplus/db';

type DB = typeof _db;

export async function createNotification(
  db: DB,
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  return db.notification.create({
    data: { userId, type: type as any, title, body, link },
  });
}

export async function notifyStoreStaff(
  db: DB,
  storeId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  const users = await db.user.findMany({
    where: { storeId, isActive: true },
    select: { id: true },
  });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u: { id: string }) => ({ userId: u.id, type: type as any, title, body, link })),
  });
}

export async function notifyByRole(
  db: DB,
  storeId: string,
  roles: string[],
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  const users = await db.user.findMany({
    where: { storeId, isActive: true, role: { in: roles as any } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u: { id: string }) => ({ userId: u.id, type: type as any, title, body, link })),
  });
}
