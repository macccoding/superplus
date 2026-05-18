import { PrismaClient } from '@prisma/client';

export async function createNotification(
  db: PrismaClient,
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
  db: PrismaClient,
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
    data: users.map(u => ({ userId: u.id, type: type as any, title, body, link })),
  });
}

export async function notifyByRole(
  db: PrismaClient,
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
    data: users.map(u => ({ userId: u.id, type: type as any, title, body, link })),
  });
}
