import {
  TaskLinkType,
  TaskStatus,
  ThreadCategory,
  ThreadLifecycleEventType,
  ThreadReactionType,
  ThreadType,
} from '@superplus/db';
import { notifyByRole } from './notifications';

const SUPERVISOR_ROLES = ['SUPERVISOR', 'MANAGER', 'OWNER'];

function minutesAgo(minutes: number, now = new Date()) {
  return new Date(now.getTime() - minutes * 60_000);
}

function hoursAgo(hours: number, now = new Date()) {
  return new Date(now.getTime() - hours * 60 * 60_000);
}

async function hasRecentLifecycleEvent(db: any, threadId: string, type: ThreadLifecycleEventType, since: Date) {
  const existing = await db.threadLifecycleEvent.findFirst({
    where: { threadId, type, createdAt: { gte: since } },
    select: { id: true },
  });
  return !!existing;
}

export async function runThreadLifecycle(db: any, input?: { storeId?: string; now?: Date }) {
  const now = input?.now ?? new Date();
  const whereScope = input?.storeId ? { storeId: input.storeId } : {};
  const summary = {
    urgentReminders: 0,
    noReplyFlags: 0,
    staleResolveSuggestions: 0,
  };

  const urgentThreads = await db.thread.findMany({
    where: {
      ...whereScope,
      type: { not: ThreadType.DIRECT },
      isResolved: false,
      category: ThreadCategory.URGENT,
      lastMessageAt: { lte: minutesAgo(15, now) },
    },
    include: {
      messages: { select: { reactions: { select: { type: true } } } },
    },
    take: 200,
  });

  for (const thread of urgentThreads) {
    const acknowledged = thread.messages.some((message: any) =>
      message.reactions.some((reaction: any) => reaction.type === ThreadReactionType.ACK)
    );
    if (acknowledged) continue;
    if (await hasRecentLifecycleEvent(db, thread.id, ThreadLifecycleEventType.URGENT_UNACKED_REMINDER, minutesAgo(60, now))) continue;
    await db.threadLifecycleEvent.create({
      data: {
        threadId: thread.id,
        type: ThreadLifecycleEventType.URGENT_UNACKED_REMINDER,
        metadata: { rule: 'urgent-unacked-15m' },
      },
    });
    await notifyByRole(
      db,
      thread.storeId,
      SUPERVISOR_ROLES,
      'THREAD_URGENT',
      `Urgent not acknowledged: ${thread.title}`,
      'No one has acknowledged this urgent thread yet.',
      `/hub/threads/${thread.id}`
    );
    summary.urgentReminders += 1;
  }

  const noReplyThreads = await db.thread.findMany({
    where: {
      ...whereScope,
      type: { not: ThreadType.DIRECT },
      isResolved: false,
      createdAt: { lte: hoursAgo(4, now) },
    },
    include: { _count: { select: { messages: true } } },
    take: 300,
  });
  for (const thread of noReplyThreads) {
    if (thread._count.messages > 1) continue;
    if (await hasRecentLifecycleEvent(db, thread.id, ThreadLifecycleEventType.NO_REPLY_FLAGGED, hoursAgo(12, now))) continue;
    await db.threadLifecycleEvent.create({
      data: {
        threadId: thread.id,
        type: ThreadLifecycleEventType.NO_REPLY_FLAGGED,
        metadata: { rule: 'no-reply-4h' },
      },
    });
    summary.noReplyFlags += 1;
  }

  const staleThreads = await db.thread.findMany({
    where: {
      ...whereScope,
      type: { not: ThreadType.DIRECT },
      isResolved: false,
      lastMessageAt: { lte: hoursAgo(48, now) },
      links: { some: { type: TaskLinkType.TASK } },
    },
    include: { links: { where: { type: TaskLinkType.TASK } } },
    take: 200,
  });
  for (const thread of staleThreads) {
    const taskIds = thread.links.map((link: any) => link.entityId);
    const doneTask = await db.task.findFirst({
      where: { id: { in: taskIds }, storeId: thread.storeId, status: TaskStatus.DONE },
      select: { id: true, title: true },
    });
    if (!doneTask) continue;
    if (await hasRecentLifecycleEvent(db, thread.id, ThreadLifecycleEventType.STALE_RESOLVE_SUGGESTED, hoursAgo(24, now))) continue;
    await db.threadLifecycleEvent.create({
      data: {
        threadId: thread.id,
        type: ThreadLifecycleEventType.STALE_RESOLVE_SUGGESTED,
        metadata: { rule: 'stale-with-done-task', taskId: doneTask.id, taskTitle: doneTask.title },
      },
    });
    summary.staleResolveSuggestions += 1;
  }

  return summary;
}
