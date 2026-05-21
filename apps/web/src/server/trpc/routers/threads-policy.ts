import { ThreadReactionType } from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';

export const threadViews = ['ALL', 'CHANNELS', 'DIRECT', 'UNREAD', 'MENTIONED', 'PINNED', 'SAVED', 'RESOLVED', 'URGENT', 'NO_REPLY', 'NEEDS_TASK', 'UNACKED'] as const;
export type ThreadView = (typeof threadViews)[number];

export const allowedThreadReactions: ThreadReactionType[] = [
  ThreadReactionType.ACK,
  ThreadReactionType.THANKS,
];

export function canManageThread(user: { role: Role }): boolean {
  return hasMinRole(user.role, 'SUPERVISOR');
}

export function canViewThread(
  user: { id: string },
  thread: { type?: string | null; participantIds?: string[] }
): boolean {
  if (thread.type === 'DIRECT' || thread.type === 'CHANNEL') {
    return (thread.participantIds || []).includes(user.id);
  }
  return true;
}

export function canEditThreadMessage(
  user: { id: string; role: Role },
  message: { authorId: string; deletedAt?: Date | null }
): boolean {
  return !message.deletedAt && message.authorId === user.id;
}

export function canDeleteThreadMessage(
  user: { id: string; role: Role },
  message: { authorId: string; deletedAt?: Date | null }
): boolean {
  return !message.deletedAt && (message.authorId === user.id || canManageThread(user));
}

export function unreadCountForThread(
  messages: { authorId: string; createdAt: Date; deletedAt?: Date | null }[],
  participant: { lastReadAt?: Date | null } | null | undefined,
  userId: string
): number {
  const lastReadAt = participant?.lastReadAt;
  return messages.filter((message) => {
    if (message.deletedAt) return false;
    if (message.authorId === userId) return false;
    return !lastReadAt || message.createdAt > lastReadAt;
  }).length;
}

export function uniqueRecipients(actorId: string, recipientIds: Array<string | null | undefined>): string[] {
  return [...new Set(recipientIds.filter((id): id is string => !!id && id !== actorId))];
}

export function directThreadKeyForUsers(userId: string, recipientId: string): string {
  return `direct:${[userId, recipientId].sort().join(':')}`;
}

export function shouldNotifyFollower(participant: { userId: string; isFollowing: boolean; mutedAt?: Date | null }): boolean {
  return participant.isFollowing && !participant.mutedAt;
}
