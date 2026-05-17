'use client';

import { IconGrid } from '@superplus/ui';
import { useSession } from 'next-auth/react';

const hubItems = [
  { label: 'Tasks', icon: 'assignment', href: '/hub/tasks', color: '#446185' },
  { label: 'Threads', icon: 'forum', href: '/hub/threads', color: '#2e7d32' },
  { label: 'Logbook', icon: 'history', href: '/hub/logbook', color: '#845500' },
  { label: 'Announce', icon: 'campaign', href: '/hub/announcements', color: '#c00029' },
  { label: 'Profile', icon: 'person', href: '/hub/profile', color: '#767c7e' },
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

  return (
    <div>
      {/* Welcome section */}
      <section className="px-[--spacing-container] pt-6 pb-2">
        <h2 className="text-2xl font-bold text-on-surface">{getGreeting()}</h2>
        <p className="text-sm text-on-surface-variant mt-1">{session?.user?.storeName || 'SuperPlus'}</p>
      </section>

      {/* Icon grid */}
      <IconGrid items={hubItems} />

      {/* Quick info card */}
      <div className="mx-[--spacing-container] mt-2 bg-primary-container/10 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-primary">info</span>
        <div>
          <h3 className="text-sm font-bold text-on-surface">3 tasks need attention</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">2 unassigned, 1 overdue</p>
        </div>
      </div>
    </div>
  );
}
