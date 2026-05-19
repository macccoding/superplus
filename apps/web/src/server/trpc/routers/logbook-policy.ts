import type { Role } from '@superplus/config';
import { hasMinRole } from '@superplus/config';

export type LogbookStatusFilter = 'all' | 'flagged' | 'open' | 'resolved';

type LogbookUser = {
  role: Role | string;
};

type LogbookEntryState = {
  isFlagged: boolean;
  resolvedAt?: Date | string | null;
  createdAt: Date | string;
};

export function canResolveLogEntry(user: LogbookUser) {
  return hasMinRole(user.role as Role, 'SUPERVISOR');
}

export function logbookStatusWhere(status: LogbookStatusFilter) {
  if (status === 'flagged') return { isFlagged: true };
  if (status === 'open') return { isFlagged: true, resolvedAt: null };
  if (status === 'resolved') return { resolvedAt: { not: null } };
  return {};
}

export function isOpenHandover(entry: Pick<LogbookEntryState, 'isFlagged' | 'resolvedAt'>) {
  return entry.isFlagged && !entry.resolvedAt;
}

export function sortLogbookEntries<T extends LogbookEntryState>(entries: T[]) {
  return [...entries].sort((a, b) => {
    const aOpen = isOpenHandover(a) ? 1 : 0;
    const bOpen = isOpenHandover(b) ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
