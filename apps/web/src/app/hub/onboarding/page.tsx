'use client';

import { CURRENT_ONBOARDING_VERSION } from '@superplus/config';
import { trpc } from '@/lib/trpc-client';
import { OnboardingFlow } from './onboarding-flow';
import manifestV1 from '@/data/onboarding-v1.json';

const manifests: Record<number, typeof manifestV1> = {
  1: manifestV1,
};

export default function OnboardingPage() {
  const { data: me, isLoading } = trpc.users.me.useQuery();

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-surface flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-brand text-[40px]">progress_activity</span>
      </div>
    );
  }

  // Determine which manifest to show
  const userVersion = me?.onboardingVersion ?? 0;
  let manifest: typeof manifestV1;
  let type: 'orientation' | 'whats-new';

  if (userVersion === 0) {
    // Never onboarded — show full orientation (v1)
    manifest = manifests[1]!;
    type = 'orientation';
  } else {
    // Already onboarded but behind current version — show latest What's New
    const nextVersion = userVersion + 1;
    manifest = manifests[nextVersion] ?? manifests[CURRENT_ONBOARDING_VERSION]!;
    type = 'whats-new';
  }

  if (!manifest) return null;

  return (
    <OnboardingFlow
      slides={manifest.slides}
      type={type}
      version={manifest.version}
    />
  );
}
