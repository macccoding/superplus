import { AppShell } from '@superplus/ui';
import { AccountSwitchButton } from '@/app/account-switch-button';

const navItems = [
  { label: 'Home', icon: 'home', href: '/hub' },
  { label: 'Tasks', icon: 'assignment', href: '/hub/tasks' },
  { label: 'Threads', icon: 'forum', href: '/hub/threads' },
  { label: 'Log', icon: 'history', href: '/hub/logbook' },
  { label: 'Profile', icon: 'person', href: '/hub/profile' },
];

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell navItems={navItems} accountSlot={<AccountSwitchButton />}>{children}</AppShell>;
}
