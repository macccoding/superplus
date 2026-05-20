import { db as _db } from '@superplus/db';
import type { NotificationType } from '@superplus/db';
import { sendWebPushToUser } from './push';

type DB = typeof _db;
type NotificationKind = NotificationType | (string & {});

function allowsNotification(preference: any, type: NotificationKind) {
  if (type === 'THREAD_MENTION') return preference?.threadMentions ?? true;
  if (type === 'THREAD_REPLY') return preference?.threadReplies ?? true;
  if (type === 'THREAD_URGENT') return preference?.urgentThreads ?? true;
  if (type === 'TASK_ASSIGNED' || type === 'TASK_UPDATED') return preference?.taskAlerts ?? true;
  if (type === 'ANNOUNCEMENT') return preference?.announcementAlerts ?? true;
  if (type === 'SCHEDULE_PUBLISHED') return preference?.scheduleAlerts ?? true;
  if (type === 'STOCK_OUT') return preference?.stockAlerts ?? true;
  if (type === 'INCIDENT') return preference?.incidentAlerts ?? true;
  if (type === 'SUGGESTION_RESPONSE') return preference?.suggestionResponses ?? true;
  return true;
}

export async function createNotification(
  db: DB,
  userId: string,
  type: NotificationKind,
  title: string,
  body?: string,
  link?: string
) {
  const preference = await db.notificationPreference.findUnique({ where: { userId } });
  if (!allowsNotification(preference, type)) return null;
  const notification = await db.notification.create({
    data: { userId, type: type as NotificationType, title, body, link },
  });
  await sendWebPushToUser(db, userId, { title, body, link, type }).catch(() => null);
  return notification;
}

export async function notifyUsers(
  db: DB,
  userIds: string[],
  type: NotificationKind,
  title: string,
  body?: string,
  link?: string
) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;
  await Promise.all(uniqueIds.map((userId) => createNotification(db, userId, type, title, body, link)));
}

export async function notifyStoreStaff(
  db: DB,
  storeId: string,
  type: NotificationKind,
  title: string,
  body?: string,
  link?: string
) {
  const users = await db.user.findMany({
    where: { storeId, isActive: true },
    select: { id: true },
  });
  await notifyUsers(db, users.map((u: { id: string }) => u.id), type, title, body, link);
}

export async function notifyByRole(
  db: DB,
  storeId: string,
  roles: string[],
  type: NotificationKind,
  title: string,
  body?: string,
  link?: string
) {
  const users = await db.user.findMany({
    where: { storeId, isActive: true, role: { in: roles as any } },
    select: { id: true },
  });
  await notifyUsers(db, users.map((u: { id: string }) => u.id), type, title, body, link);
}
