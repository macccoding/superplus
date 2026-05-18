'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import { cacheTaskList, readCachedTaskList, readQueuedTaskMutations } from '@/lib/task-offline';
import { TaskCard, EmptyState, PageHeader, PageSkeleton } from '@superplus/ui';

type Tab = 'mine' | 'available' | 'help' | 'done';
const roleRank: Record<string, number> = { STAFF: 1, SUPERVISOR: 2, MANAGER: 3, OWNER: 4 };
const listViewByTab: Record<Tab, 'MINE' | 'AVAILABLE' | 'HELP' | 'DONE'> = {
  mine: 'MINE',
  available: 'AVAILABLE',
  help: 'HELP',
  done: 'DONE',
};
const tabLabels: Record<Tab, string> = {
  mine: 'Mine',
  available: 'Pick Up',
  help: 'Help',
  done: 'Done',
};
const emptyCopy: Record<Tab, { icon: string; title: string; description: string }> = {
  mine: { icon: 'assignment', title: 'No tasks assigned right now', description: 'New work will show here when a supervisor assigns it' },
  available: { icon: 'volunteer_activism', title: 'Nothing available to pick up', description: 'All open tasks already have someone on them' },
  help: { icon: 'support_agent', title: 'No one needs help right now', description: 'Tasks asking for supervisor help will show here' },
  done: { icon: 'check_circle', title: 'Completed tasks will show here', description: 'Finished work appears here after it is marked done' },
};

function validTab(value: string | null): Tab {
  if (value === 'available' || value === 'help' || value === 'done' || value === 'mine') return value;
  return 'mine';
}

function scrollKey(tab: Tab) {
  return `superplus.tasks.scroll.${tab}`;
}

function taskDate(value?: Date | string | null) {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

export default function TasksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>(() => validTab(searchParams.get('tab')));
  const [cachedTasks, setCachedTasks] = useState<Record<Tab, any[] | undefined>>({
    mine: undefined,
    available: undefined,
    help: undefined,
    done: undefined,
  });
  const [pendingCount, setPendingCount] = useState(0);
  const canCreate = roleRank[session?.user?.role || 'STAFF'] >= 2;
  const listInput = useMemo(() => {
    const view = listViewByTab[tab];
    return tab === 'done' ? { view, take: 50 } : { view };
  }, [tab]);

  const { data: liveTasks, isLoading, isError } = trpc.tasks.list.useQuery(listInput);
  const { data: counts } = trpc.tasks.counts.useQuery();

  useEffect(() => {
    const nextTab = validTab(searchParams.get('tab'));
    if (nextTab !== tab) setTab(nextTab);
  }, [searchParams, tab]);

  useEffect(() => {
    const next: Record<Tab, any[] | undefined> = {
      mine: readCachedTaskList<any>('mine')?.tasks,
      available: readCachedTaskList<any>('available')?.tasks,
      help: readCachedTaskList<any>('help')?.tasks,
      done: readCachedTaskList<any>('done')?.tasks,
    };
    setCachedTasks(next);
    setPendingCount(readQueuedTaskMutations().length);
  }, []);

  useEffect(() => { if (liveTasks) cacheTaskList(tab, liveTasks); }, [liveTasks, tab]);

  const tasks = liveTasks ?? cachedTasks[tab];
  const usingCache = !liveTasks && !!cachedTasks[tab]?.length && isError;

  useEffect(() => {
    const saved = sessionStorage.getItem(scrollKey(tab));
    if (!saved) return;
    requestAnimationFrame(() => window.scrollTo({ top: Number(saved), behavior: 'auto' }));
  }, [tab]);

  useEffect(() => {
    if (!tasks?.length) return;
    tasks.slice(0, 12).forEach((task) => router.prefetch(`/hub/tasks/${task.id}?from=${tab}`));
  }, [router, tab, tasks]);

  const tabCounts: Record<Tab, number> = {
    mine: counts?.mine ?? (cachedTasks.mine ?? []).length,
    available: counts?.available ?? (cachedTasks.available ?? []).length,
    help: counts?.help ?? (cachedTasks.help ?? []).length,
    done: counts?.done ?? (cachedTasks.done ?? []).length,
  };
  const changeTab = (next: Tab) => {
    if (next === tab) return;
    sessionStorage.setItem(scrollKey(tab), String(window.scrollY));
    sessionStorage.removeItem(scrollKey(next));
    setTab(next);
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };
  const openTask = (id: string) => {
    sessionStorage.setItem(scrollKey(tab), String(window.scrollY));
    router.push(`/hub/tasks/${id}?from=${tab}`);
  };
  const empty = emptyCopy[tab];

  return (
    <div>
      {/* Header + Tabs */}
      <section className="px-5 pt-6 pb-4">
        <PageHeader title="Tasks" subtitle="Your work for today" />
        <div className="grid grid-cols-4 gap-1 bg-surface-cream rounded-[--radius-lg] p-1">
          {([
            { key: 'mine', label: tabLabels.mine },
            { key: 'available', label: tabLabels.available },
            { key: 'help', label: tabLabels.help },
            { key: 'done', label: tabLabels.done },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => changeTab(key)}
              className={`min-h-11 rounded-lg px-1 text-center text-sm font-bold transition-colors duration-150 ${
                tab === key
                  ? 'bg-brand text-on-brand shadow-sm rounded-lg'
                  : 'text-on-surface-secondary hover:bg-surface-creamest rounded-lg'
              }`}
            >
              {label}
              {tabCounts[key] > 0 && <span className="ml-1 text-[11px] font-bold opacity-80">{tabCounts[key]}</span>}
            </button>
          ))}
        </div>
        {(usingCache || pendingCount > 0) && (
          <div className="mt-3 rounded-[--radius-lg] bg-warning/10 px-4 py-3 text-sm font-bold text-warning flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">cloud_off</span>
            {usingCache ? 'Showing saved tasks' : `${pendingCount} task update${pendingCount === 1 ? '' : 's'} saved on this phone`}
          </div>
        )}
      </section>

      {/* Task list */}
      <section className="px-5 pb-24 space-y-3">
        {isLoading && !tasks ? (
          <PageSkeleton variant="task-list" />
        ) : tasks && tasks.length > 0 ? (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              title={task.title}
              priority={task.priority}
              status={task.status}
              assignedTo={task.assignedTo?.fullName}
              createdBy={task.createdBy.fullName}
              category={task.category}
              workArea={task.workArea}
              updateCount={task._count.updates}
              checklistCount={task._count.checklistItems}
              attachmentCount={task._count.attachments}
              dueDate={taskDate(task.dueDate)}
              onClick={() => openTask(task.id)}
            />
          ))
        ) : (
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
          />
        )}
      </section>

      {/* FAB */}
      {canCreate && (
        <button
          onClick={() => router.push(`/hub/tasks/create?from=${tab}`)}
          className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-brand text-on-brand shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      )}
    </div>
  );
}
