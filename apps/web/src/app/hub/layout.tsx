'use client';

import { useEffect } from 'react';
import { AppShell } from '@superplus/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getBlockedStaffModule, getStaffBottomNavItems, normalizeReleaseMode, CURRENT_ONBOARDING_VERSION } from '@superplus/config';
import { AccountSwitchButton } from '@/app/account-switch-button';
import { NotificationsSlot } from '@/app/notifications-slot';
import { trpc } from '@/lib/trpc-client';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = trpc.users.me.useQuery();
  const { data: threadCounts } = trpc.threads.counts.useQuery();
  const { data: releaseModeSetting } = trpc.settings.getReleaseMode.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (me && pathname !== '/hub/onboarding') {
      if (!me.onboardedAt || me.onboardingVersion < CURRENT_ONBOARDING_VERSION) {
        router.replace('/hub/onboarding');
      }
    }
  }, [me, pathname, router]);
  const releaseMode = normalizeReleaseMode(releaseModeSetting?.mode);
  const blockedModule = getBlockedStaffModule(pathname, releaseMode);
  const baseNavItems = [
    { label: 'Home', icon: 'home', href: '/hub' },
    ...getStaffBottomNavItems(releaseMode),
  ];
  const navItems = baseNavItems.map((item) => (
    item.href === '/hub/threads'
      ? { ...item, badge: threadCounts?.unread || undefined }
      : item
  ));

  // Onboarding is full-screen — skip AppShell entirely
  if (pathname === '/hub/onboarding') {
    return <>{children}</>;
  }

  return (
    <AppShell navItems={navItems} notificationSlot={<NotificationsSlot />} accountSlot={<AccountSwitchButton />}>
      {blockedModule ? (
        <div className="px-5 py-10 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-cream">
            <span className="material-symbols-outlined text-[40px] text-brand-light">visibility_off</span>
          </div>
          <h2 className="text-xl font-extrabold text-on-surface">Not available in this release</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-on-surface-secondary">
            {blockedModule.label} is hidden while SuperPlus runs the simplified staff app.
          </p>
          <Link
            href="/hub"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[--radius-lg] bg-brand px-5 text-sm font-extrabold text-on-brand shadow-sm active:scale-[0.98]"
          >
            Back to Hub
          </Link>
        </div>
      ) : children}
    </AppShell>
  );
}
