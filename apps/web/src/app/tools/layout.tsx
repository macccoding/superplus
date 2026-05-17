import { AppShell } from '@superplus/ui';

const navItems = [
  { label: 'Home', icon: 'home', href: '/hub' },
  { label: 'Tasks', icon: 'assignment', href: '/hub/tasks' },
  { label: 'Threads', icon: 'forum', href: '/hub/threads' },
  { label: 'Log', icon: 'history', href: '/hub/logbook' },
];

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell navItems={navItems}>{children}</AppShell>;
}
