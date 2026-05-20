import type { NotificationType } from '@superplus/db';

type PushPayload = {
  title: string;
  body?: string;
  link?: string;
  type?: NotificationType | string;
};

function hasPushEnv() {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY && !!process.env.VAPID_SUBJECT;
}

function minutes(value?: string | null) {
  if (!value) return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function inQuietHours(preference: any, now = new Date()) {
  const start = minutes(preference?.quietHoursStart);
  const end = minutes(preference?.quietHoursEnd);
  if (start == null || end == null || start === end) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function allowsType(preference: any, type?: string) {
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

function quietBlocks(preference: any, type?: string) {
  if (!inQuietHours(preference)) return false;
  if (type === 'THREAD_URGENT' && (preference?.urgentOverrideQuiet ?? true)) return false;
  return true;
}

export async function sendWebPushToUser(db: any, userId: string, payload: PushPayload) {
  if (!hasPushEnv()) return { sent: 0, skipped: 'missing-env' };
  const preference = await db.notificationPreference.findUnique({ where: { userId } });
  if (!allowsType(preference, payload.type) || quietBlocks(preference, payload.type)) {
    return { sent: 0, skipped: 'preferences' };
  }
  const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return { sent: 0, skipped: 'no-subscriptions' };

  const webPushModule = await import('web-push');
  const webPush = webPushModule.default ?? webPushModule;
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await db.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => null);
      }
    }
  }
  return { sent };
}
