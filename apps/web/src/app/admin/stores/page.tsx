'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';

export default function StoresPage() {
  const utils = trpc.useUtils();
  const { data: stores } = trpc.stores.list.useQuery();
  const [launchTarget, setLaunchTarget] = useState<any | null>(null);
  const [temporaryPin, setTemporaryPin] = useState('1234');
  const [launchNotes, setLaunchNotes] = useState('');
  const [launchResult, setLaunchResult] = useState<any | null>(null);
  const prepareLaunch = trpc.stores.prepareLaunch.useMutation({
    onSuccess: (result) => {
      setLaunchResult(result);
      setLaunchTarget(null);
      setTemporaryPin('1234');
      setLaunchNotes('');
      utils.stores.list.invalidate();
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-on-surface">Stores</h1>
        <p className="text-on-surface-secondary mt-1">{stores?.length || 0} locations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stores?.map((store) => (
          <div key={store.id} className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm hover:shadow-md transition-shadow">
            <Link href={`/admin/stores/${store.id}/operations`} className="block rounded-[--radius-lg] transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/30">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-[--radius-lg] bg-navy/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-navy">store</span>
                </div>
                <div>
                  <h3 className="font-bold text-on-surface text-lg">{store.name}</h3>
                  <p className="text-sm text-on-surface-secondary mt-0.5">{store.address}</p>
                  <p className="text-sm text-on-surface-secondary mt-0.5">{store.parish}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${store.isActive ? 'bg-success/10' : 'bg-error/10'}`}>
                <span className={`w-2 h-2 rounded-full ${store.isActive ? 'bg-success' : 'bg-error'}`} />
                <span className={`text-xs font-medium ${store.isActive ? 'text-success' : 'text-error'}`}>
                  {store.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-[--radius-lg] bg-surface px-3 py-2 text-sm font-bold text-on-surface-secondary">
              Open store operations
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">chevron_right</span>
            </div>
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${store.launchEnabled ? 'bg-brand/10 text-brand' : 'bg-surface-cream text-on-surface-secondary'}`}>
                <span className="material-symbols-outlined text-[16px]">{store.launchEnabled ? 'rocket_launch' : 'lock'}</span>
                {store.launchEnabled ? 'Login Live' : 'Login Hidden'}
              </span>
              {store.launchedAt && (
                <span className="text-xs font-bold text-on-surface-secondary">
                  Launched {new Date(store.launchedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {store.phone && (
              <div className="flex items-center gap-2 mt-4 text-sm text-on-surface-secondary">
                <span className="material-symbols-outlined text-[18px]">call</span>
                {store.phone}
              </div>
            )}
            <button
              type="button"
              onClick={() => { setLaunchTarget(store); setLaunchResult(null); }}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[--radius-lg] bg-brand text-sm font-bold text-on-brand transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
              Prepare Store Launch
            </button>
          </div>
        ))}
      </div>

      {launchResult && (
        <div className="fixed bottom-5 left-5 right-5 z-40 mx-auto max-w-lg rounded-[--radius-lg] bg-success p-4 text-white shadow-lg">
          <p className="font-bold">{launchResult.storeName} is launch-ready.</p>
          <p className="text-sm opacity-90">{launchResult.affectedUsers} active staff reset for first login.</p>
        </div>
      )}

      {launchTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[--radius-lg] bg-surface-white p-6 shadow-xl">
            <h2 className="text-xl font-extrabold text-on-surface">Prepare Launch</h2>
            <p className="mt-1 text-sm text-on-surface-secondary">
              This will enable staff login for {launchTarget.name}, reset active staff to the temporary PIN, and send them through onboarding again.
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-bold text-on-surface">Temporary PIN</span>
              <input
                value={temporaryPin}
                onChange={(event) => setTemporaryPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                className="h-14 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 text-center text-2xl tracking-[0.3em] text-on-surface focus:border-brand focus:outline-none"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold text-on-surface">Notes</span>
              <textarea
                value={launchNotes}
                onChange={(event) => setLaunchNotes(event.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-[--radius-lg] border-2 border-outline bg-surface p-3 text-sm text-on-surface focus:border-brand focus:outline-none"
                placeholder="Optional launch note"
              />
            </label>
            {prepareLaunch.error && <p className="mt-3 text-sm font-bold text-error">{prepareLaunch.error.message}</p>}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setLaunchTarget(null)}
                className="h-14 flex-1 rounded-[--radius-lg] bg-surface-cream font-bold text-on-surface-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => prepareLaunch.mutate({ storeId: launchTarget.id, temporaryPin, launchNotes: launchNotes || undefined })}
                disabled={temporaryPin.length !== 4 || prepareLaunch.isPending}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[--radius-lg] bg-brand font-bold text-on-brand disabled:opacity-40"
              >
                {prepareLaunch.isPending ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : 'Launch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
