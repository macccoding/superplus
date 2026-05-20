'use client';

import { AppShell } from '@superplus/ui';
import { getStaffBottomNavItems, normalizeReleaseMode } from '@superplus/config';
import { AccountSwitchButton } from '@/app/account-switch-button';
import { trpc } from '@/lib/trpc-client';

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const { data: releaseModeSetting } = trpc.settings.getReleaseMode.useQuery(undefined, { retry: false });
  const releaseMode = normalizeReleaseMode(releaseModeSetting?.mode);
  const navItems = [
    { label: 'Home', icon: 'home', href: '/hub' },
    ...getStaffBottomNavItems(releaseMode),
  ];

  return <AppShell navItems={navItems} accountSlot={<AccountSwitchButton />}>{children}</AppShell>;
}
