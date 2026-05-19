const THREAD_LIST_PREFIX = 'superplus:threads:list:';
const THREAD_DETAIL_PREFIX = 'superplus:threads:detail:';
const THREAD_QUEUE_KEY = 'superplus:threads:queue';

export type ThreadQueueEntry = {
  id: string;
  type: 'CREATE' | 'REPLY' | 'REACT' | 'MARK_READ';
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

export function cacheThreadList<T>(view: string, threads: T[]) {
  writeJson(`${THREAD_LIST_PREFIX}${view}`, { threads, cachedAt: new Date().toISOString() });
}

export function readCachedThreadList<T>(view: string) {
  return readJson<{ threads: T[]; cachedAt: string } | null>(`${THREAD_LIST_PREFIX}${view}`, null);
}

export function cacheThreadDetail<T extends { id: string }>(thread: T) {
  writeJson(`${THREAD_DETAIL_PREFIX}${thread.id}`, { thread, cachedAt: new Date().toISOString() });
}

export function readCachedThreadDetail<T>(id: string) {
  return readJson<{ thread: T; cachedAt: string } | null>(`${THREAD_DETAIL_PREFIX}${id}`, null);
}

export function queueThreadMutation(type: ThreadQueueEntry['type'], payload: unknown) {
  const queue = readQueuedThreadMutations();
  const entry: ThreadQueueEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  return writeJson(THREAD_QUEUE_KEY, [...queue, entry]) ? entry : null;
}

export function readQueuedThreadMutations() {
  return readJson<ThreadQueueEntry[]>(THREAD_QUEUE_KEY, []);
}

export function removeQueuedThreadMutation(id: string) {
  writeJson(THREAD_QUEUE_KEY, readQueuedThreadMutations().filter((entry) => entry.id !== id));
}

export function clearQueuedThreadMutations() {
  writeJson(THREAD_QUEUE_KEY, []);
}
