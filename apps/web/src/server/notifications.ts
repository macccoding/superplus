import { db as _db } from '@superplus/db';
import { sendWebPushToUser } from './push';

type DB = typeof _db;

export async function createNotification(
  db: DB,
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
) {
  const notification = await db.notification.create({
    data: { userId, type: type as any, title, body, link },
  });
  await sendWebPushToUser(db, userId, { title, body, link, type }).catch(() => null);
  return notification;
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
  await Promise.all(users.map((u: { id: string }) => createNotification(db, u.id, type, title, body, link)));
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
  await Promise.all(users.map((u: { id: string }) => createNotification(db, u.id, type, title, body, link)));
}
