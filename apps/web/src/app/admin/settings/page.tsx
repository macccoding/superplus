'use client';

import { normalizeReleaseMode, type ReleaseMode } from '@superplus/config';
import { PageHeader } from '@superplus/ui';
import { trpc } from '@/lib/trpc-client';

const modeCopy: Record<ReleaseMode, { title: string; description: string; icon: string }> = {
  SIMPLIFIED: {
    title: 'Simplified release',
    description: 'Staff see Tasks, Threads, Logbook, and Tools only.',
    icon: 'filter_alt',
  },
  FULL: {
    title: 'Full app',
    description: 'Staff see every released hub module.',
    icon: 'apps',
  },
};

export default function AdminSettingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.settings.getReleaseMode.useQuery(undefined, { retry: false });
  const updateMode = trpc.settings.updateReleaseMode.useMutation({
    onSuccess: () => {
      utils.settings.getReleaseMode.invalidate();
    },
  });

  const currentMode = normalizeReleaseMode(data?.mode);
  const canUpdate = data?.canUpdate === true;

  const setMode = (mode: ReleaseMode) => {
    if (!canUpdate || mode === currentMode) return;
    updateMode.mutate({ mode });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Control what staff can see in the SuperPlus app."
      />

      <section className="rounded-[--radius-lg] bg-surface-white p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[--radius-lg] bg-brand/10">
            <span className="material-symbols-outlined text-brand">rocket_launch</span>
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-on-surface">Release Mode</h2>
            <p className="mt-1 text-sm text-on-surface-secondary">
              Simplified mode is the default for the first staff rollout.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {(['SIMPLIFIED', 'FULL'] as ReleaseMode[]).map((mode) => {
            const active = currentMode === mode;
            const copy = modeCopy[mode];

            return (
              <button
                key={mode}
                type="button"
                disabled={!canUpdate || isLoading || updateMode.isPending}
                onClick={() => setMode(mode)}
                className={`min-h-28 rounded-[--radius-lg] border-2 p-4 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 ${
                  active
                    ? 'border-brand bg-brand/5 text-on-surface'
                    : 'border-border bg-surface text-on-surface-secondary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined ${active ? 'text-brand' : 'text-on-surface-secondary'}`}>
                    {copy.icon}
                  </span>
                  <span className="text-base font-extrabold">{copy.title}</span>
                </div>
                <p className="mt-2 text-sm">{copy.description}</p>
              </button>
            );
          })}
        </div>

        {!canUpdate && !isLoading && (
          <p className="mt-4 rounded-[--radius-md] bg-surface-cream p-3 text-sm font-bold text-on-surface-secondary">
            Only owners can change release mode. Managers can view the current setting.
          </p>
        )}

        {updateMode.isError && (
          <p className="mt-4 rounded-[--radius-md] bg-error/10 p-3 text-sm font-bold text-error">
            Could not update release mode. Please try again.
          </p>
        )}
      </section>
    </div>
  );
}
