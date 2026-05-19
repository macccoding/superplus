'use client';

import { AppShell } from '@superplus/ui';
import { HubNotifications } from './hub-notifications';
import { trpc } from '@/lib/trpc-client';

const baseNavItems = [
  { label: 'Home', icon: 'home', href: '/hub' },
  { label: 'Tasks', icon: 'assignment', href: '/hub/tasks' },
  { label: 'Threads', icon: 'forum', href: '/hub/threads' },
  { label: 'Log', icon: 'history', href: '/hub/logbook' },
];

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const { data: threadCounts } = trpc.threads.counts.useQuery();
  const navItems = baseNavItems.map((item) => (
    item.href === '/hub/threads'
      ? { ...item, badge: threadCounts?.unread || undefined }
      : item
  ));

  return (
    <AppShell navItems={navItems} notificationSlot={<HubNotifications />}>
      {children}
    </AppShell>
  );
}
