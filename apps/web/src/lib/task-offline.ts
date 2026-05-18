const TASK_LIST_PREFIX = 'superplus:tasks:list:';
const TASK_DETAIL_PREFIX = 'superplus:tasks:detail:';
const TASK_QUEUE_KEY = 'superplus:tasks:queue';

type QueueEntry = {
  id: string;
  type: 'ADD_UPDATE' | 'REQUEST_HELP' | 'TOGGLE_CHECKLIST' | 'COMPLETE';
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
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function cacheTaskList<T>(view: string, tasks: T[]) {
  writeJson(`${TASK_LIST_PREFIX}${view}`, { tasks, cachedAt: new Date().toISOString() });
}

export function readCachedTaskList<T>(view: string) {
  return readJson<{ tasks: T[]; cachedAt: string } | null>(`${TASK_LIST_PREFIX}${view}`, null);
}

export function cacheTaskDetail<T extends { id: string }>(task: T) {
  writeJson(`${TASK_DETAIL_PREFIX}${task.id}`, { task, cachedAt: new Date().toISOString() });
}

export function readCachedTaskDetail<T>(id: string) {
  return readJson<{ task: T; cachedAt: string } | null>(`${TASK_DETAIL_PREFIX}${id}`, null);
}

export function queueTaskMutation(type: QueueEntry['type'], payload: unknown) {
  const queue = readQueuedTaskMutations();
  const entry: QueueEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  writeJson(TASK_QUEUE_KEY, [...queue, entry]);
  return entry;
}

export function readQueuedTaskMutations() {
  return readJson<QueueEntry[]>(TASK_QUEUE_KEY, []);
}
