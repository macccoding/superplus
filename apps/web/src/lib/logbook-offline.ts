const LOGBOOK_LIST_PREFIX = 'superplus:logbook:list:';
const LOGBOOK_QUEUE_KEY = 'superplus:logbook:queue';

export type LogbookQueueEntry = {
  id: string;
  type: 'CREATE';
  payload: unknown;
  createdAt: string;
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function cacheLogbookList<T>(key: string, entries: T[]) {
  writeJson(`${LOGBOOK_LIST_PREFIX}${key}`, { entries, cachedAt: new Date().toISOString() });
}

export function readCachedLogbookList<T>(key: string) {
  return readJson<{ entries: T[]; cachedAt: string } | null>(`${LOGBOOK_LIST_PREFIX}${key}`, null);
}

export function queueLogbookMutation(type: LogbookQueueEntry['type'], payload: unknown) {
  const queue = readQueuedLogbookMutations();
  const entry: LogbookQueueEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  return writeJson(LOGBOOK_QUEUE_KEY, [...queue, entry]) ? entry : null;
}

export function readQueuedLogbookMutations() {
  return readJson<LogbookQueueEntry[]>(LOGBOOK_QUEUE_KEY, []);
}

export function removeQueuedLogbookMutation(id: string) {
  writeJson(LOGBOOK_QUEUE_KEY, readQueuedLogbookMutations().filter((entry) => entry.id !== id));
}

export function clearQueuedLogbookMutations() {
  writeJson(LOGBOOK_QUEUE_KEY, []);
}
