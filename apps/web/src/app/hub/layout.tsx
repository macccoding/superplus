import { AppShell } from '@superplus/ui';

const navItems = [
  { label: 'Home', icon: '🏠', href: '/hub' },
  { label: 'Tasks', icon: '📋', href: '/hub/tasks' },
  { label: 'Threads', icon: '💬', href: '/hub/threads' },
  { label: 'Log', icon: '📓', href: '/hub/logbook' },
];

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <AppShell title="SuperPlus" navItems={navItems}>{children}</AppShell>;
}
