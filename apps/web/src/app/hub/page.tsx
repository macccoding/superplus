'use client';

import { IconGrid } from '@superplus/ui';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';

const hubItems = [
  { label: 'Tasks', icon: 'assignment', href: '/hub/tasks', color: '#446185' },
  { label: 'Threads', icon: 'forum', href: '/hub/threads', color: '#2e7d32' },
  { label: 'Logbook', icon: 'history', href: '/hub/logbook', color: '#845500' },
  { label: 'Announce', icon: 'campaign', href: '/hub/announcements', color: '#c00029' },
  { label: 'Schedule', icon: 'calendar_month', href: '/hub/schedule', color: '#1565c0' },
  { label: 'Tools', icon: 'build', href: '/tools', color: '#673ab7' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function HubHomePage() {
  const { data: session } = useSession();
  const { data: myTasks } = trpc.tasks.list.useQuery({ assignedToMe: true });
  const { data: availableTasks } = trpc.tasks.list.useQuery({ unassigned: true });

  const totalTasks = (myTasks?.length || 0) + (availableTasks?.length || 0);

  return (
    <div>
      {/* Welcome section */}
      <section className="px-[--spacing-container] pt-6 pb-2">
        <h2 className="text-2xl font-bold text-on-surface">{getGreeting()}</h2>
        <p className="text-sm text-on-surface-variant mt-1">{session?.user?.storeName || 'SuperPlus'}</p>
      </section>

      {/* Icon grid */}
      <IconGrid items={hubItems} />

      {/* Quick info card — only shown when there are tasks */}
      {totalTasks > 0 && (
        <div className="mx-[--spacing-container] mt-2 bg-primary-fixed/10 border-l-4 border-primary rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >info</span>
          <div>
            <h3 className="text-sm font-bold text-on-surface">
              {totalTasks} task{totalTasks !== 1 ? 's' : ''} need attention
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {availableTasks?.length || 0} unassigned, {myTasks?.length || 0} assigned to you
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
