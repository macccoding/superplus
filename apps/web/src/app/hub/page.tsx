'use client';

import { Suspense, useCallback } from 'react';
import { IconGrid } from '@superplus/ui';
import { getStaffModulesByPlacement, normalizeReleaseMode } from '@superplus/config';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { OnboardingWalkthrough } from './onboarding/onboarding-walkthrough';
import manifestV1 from '@/data/onboarding-v1.json';

const adminItem = { label: 'Admin', icon: 'admin_panel_settings', href: '/admin', color: '#1B3A5C' };
const profileItem = { label: 'Profile', icon: 'account_circle', href: '/hub/profile', color: '#E31837' };

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function WalkthroughTrigger() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: me } = trpc.users.me.useQuery();
  const walkthroughKey = me ? `walkthrough-done:${me.id}:${manifestV1.version}` : null;
  const forceWalkthrough = searchParams.get('source') === 'orientation';
  const showWalkthrough = searchParams.get('walkthrough') === '1'
    && typeof window !== 'undefined'
    && walkthroughKey
    && (forceWalkthrough || !sessionStorage.getItem(walkthroughKey));
  const handleComplete = useCallback(() => {
    if (walkthroughKey) {
      sessionStorage.setItem(walkthroughKey, '1');
    }
    router.replace('/hub');
  }, [router, walkthroughKey]);

  if (!showWalkthrough || !manifestV1.walkthrough) return null;
  return <OnboardingWalkthrough steps={manifestV1.walkthrough} onComplete={handleComplete} />;
}

export default function HubHomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: me } = trpc.users.me.useQuery();
  const canSeeStoreTasks = session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER';
  const { data: myTasks } = trpc.tasks.list.useQuery({
    view: canSeeStoreTasks ? 'ALL' : 'MINE',
    scope: canSeeStoreTasks ? session?.user?.storeId : undefined,
  });
  const { data: availableTasks } = trpc.tasks.list.useQuery({ view: 'AVAILABLE' });
  const { data: threadCounts } = trpc.threads.counts.useQuery();
  const { data: releaseModeSetting } = trpc.settings.getReleaseMode.useQuery(undefined, { retry: false });

  const releaseMode = normalizeReleaseMode(releaseModeSetting?.mode);
  const totalTasks = canSeeStoreTasks ? (myTasks?.length || 0) : (myTasks?.length || 0) + (availableTasks?.length || 0);
  const canOpenAdmin = canSeeStoreTasks;
  const hubItems = getStaffModulesByPlacement(releaseMode, 'main');
  const moreItems = getStaffModulesByPlacement(releaseMode, 'more');
  const hubItemsWithBadges = [...hubItems, profileItem].map((item) => (
    item.href === '/hub/threads'
      ? { ...item, badge: threadCounts?.unread || undefined }
      : item
  ));
  const moreItemsForUser = canOpenAdmin ? [adminItem, ...moreItems] : moreItems;
  const profileCompletion = [
    me?.preferredName,
    me?.favoriteColor,
    me?.favoriteTreat,
    me?.dreamGoal,
    me?.learningInterest,
    me?.celebrationPreference,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0).length + (me?.birthdayMonth && me?.birthdayDay ? 1 : 0);
  const shouldNudgeProfile = me && profileCompletion < 5;

  return (
    <div>
      {/* Welcome section */}
      <section className="px-5 pt-6 pb-2">
        <h2 className="text-2xl font-bold text-on-surface">{getGreeting()}</h2>
        <p className="text-sm text-on-surface-secondary mt-1">{session?.user?.storeName || 'SuperPlus'}</p>
      </section>

      {/* Icon grid */}
      <IconGrid items={hubItemsWithBadges} />

      {moreItemsForUser.length > 0 && (
        <>
          <section className="px-5 mt-2 mb-2">
            <h3 className="text-xs font-bold text-on-surface-secondary uppercase tracking-wide mb-2">More</h3>
          </section>
          <IconGrid items={moreItemsForUser} />
        </>
      )}

      {/* Quick info card — only shown when there are tasks */}
      {shouldNudgeProfile && (
        <button
          onClick={() => router.push('/hub/profile')}
          className="mx-5 mt-2 mb-3 w-[calc(100%-2.5rem)] bg-surface-white border-l-4 border-brand rounded-[--radius-lg] p-4 flex items-center gap-3 shadow-sm text-left active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-brand" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-on-surface">Finish your profile</h3>
            <p className="text-xs text-on-surface-secondary mt-0.5">
              Add your birthday, favourite color, and goals so the team can celebrate you.
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-secondary text-[20px]">chevron_right</span>
        </button>
      )}

      {totalTasks > 0 && (
        <div className="mx-5 mt-2 bg-brand-light/10 border-l-4 border-brand rounded-[--radius-lg] p-4 flex items-start gap-3 shadow-sm">
          <span
            className="material-symbols-outlined text-brand"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >info</span>
          <div>
            <h3 className="text-sm font-bold text-on-surface">
              {totalTasks} task{totalTasks !== 1 ? 's' : ''} need attention
            </h3>
            <p className="text-xs text-on-surface-secondary mt-0.5">
              {canSeeStoreTasks
                ? 'Open Tasks to see store work across the team'
                : `${availableTasks?.length || 0} unassigned, ${myTasks?.length || 0} assigned to you`}
            </p>
          </div>
        </div>
      )}

      {/* Spotlight walkthrough overlay */}
      <Suspense>
        <WalkthroughTrigger />
      </Suspense>
    </div>
  );
}
