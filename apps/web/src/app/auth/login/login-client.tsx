'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

interface LoginStore {
  id: string;
  name: string;
  parish: string;
  address: string;
}

interface StaffMember {
  loginId: string;
  fullName: string;
  firstName: string;
  initials: string;
  role: string;
  storeName: string;
}

const roleColors: Record<string, { bg: string; text: string }> = {
  OWNER: { bg: 'bg-brand/10', text: 'text-brand' },
  MANAGER: { bg: 'bg-warning/10', text: 'text-warning' },
  SUPERVISOR: { bg: 'bg-navy/10', text: 'text-navy' },
  STAFF: { bg: 'bg-surface-cream', text: 'text-on-surface-secondary' },
};

const avatarColors = ['#446185', '#2e7d32', '#845500', '#c00029', '#1565c0', '#673ab7', '#5c1f5c', '#a73b21'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

async function prefetchOnboardingAssets() {
  try {
    if (!('caches' in window)) return;
    const manifest = await import('@/data/onboarding-v1.json');
    const urls = manifest.slides
      .flatMap((s: { imageUrl: string; audioUrl: string }) => [s.imageUrl, s.audioUrl])
      .filter(Boolean);
    const cache = await caches.open('superplus-v2');
    await Promise.allSettled(urls.map((url: string) => cache.add(url)));
  } catch { /* best-effort, silent failure */ }
}

export function LoginClient({ stores }: { stores: LoginStore[] }) {
  const router = useRouter();
  const [selectedStore, setSelectedStore] = useState<LoginStore | null>(stores.length === 1 ? stores[0] : null);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const { data: staff, isLoading: staffLoading } = trpc.users.loginList.useQuery(
    { storeId: selectedStore?.id },
    { enabled: Boolean(selectedStore?.id) }
  );

  async function handleSubmit() {
    if (!selected || pin.length < 4) return;
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      phone: selected.loginId,
      pin,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid PIN. Try again.');
      setPin('');
    } else {
      // Prefetch onboarding assets into SW cache
      prefetchOnboardingAssets();
      router.push('/auth/create-pin');
      router.refresh();
    }
  }

  if (!selectedStore) {
    return (
      <div className="w-full max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <img src="/logo-transparent.png" alt="SuperPlus" className="h-24 mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-on-surface">SuperPlus</h1>
          <p className="text-on-surface-secondary text-sm mt-1">Choose your store</p>
        </div>

        <div className="space-y-3">
          {stores.map((store) => (
            <button
              key={store.id}
              type="button"
              onClick={() => { setSelectedStore(store); setSelected(null); setPin(''); setError(''); }}
              className="flex min-h-[76px] w-full items-center gap-4 rounded-[--radius-lg] border-2 border-transparent bg-surface-white p-4 text-left shadow-sm transition-all active:scale-[0.98] hover:border-brand/30 focus:border-brand"
            >
              <span className="material-symbols-outlined flex h-12 w-12 shrink-0 items-center justify-center rounded-[--radius-lg] bg-brand/10 text-brand">store</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold text-on-surface">{store.name.replace('SuperPlus ', '')}</span>
                <span className="block text-sm text-on-surface-secondary">{store.parish}</span>
              </span>
              <span className="material-symbols-outlined text-on-surface-secondary">chevron_right</span>
            </button>
          ))}
        </div>

        {stores.length === 0 && (
          <div className="rounded-[--radius-lg] bg-surface-white p-6 text-center shadow-sm">
            <p className="font-bold text-on-surface">No stores are live yet</p>
            <p className="mt-1 text-sm text-on-surface-secondary">Ask management when your store is launching.</p>
          </div>
        )}
      </div>
    );
  }

  if (!selected) {
    const staffList = staff ?? [];
    const normalizedSearch = staffSearch.trim().toLowerCase();
    const filteredStaff = normalizedSearch
      ? staffList.filter((user) => (
        user.fullName.toLowerCase().includes(normalizedSearch) ||
        user.firstName.toLowerCase().includes(normalizedSearch) ||
        user.role.toLowerCase().includes(normalizedSearch) ||
        user.storeName.toLowerCase().includes(normalizedSearch)
      ))
      : staffList;

    return (
      <div className="w-full max-w-lg mx-auto px-4">
        <div className="text-center mb-8">
          <img src="/logo-transparent.png" alt="SuperPlus" className="h-24 mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-on-surface">SuperPlus</h1>
          <p className="text-on-surface-secondary text-sm mt-1">{selectedStore.name.replace('SuperPlus ', '')} · select your name</p>
        </div>

        <button
          type="button"
          onClick={() => { setSelectedStore(null); setSelected(null); setPin(''); setError(''); }}
          className="mb-4 flex min-h-12 items-center gap-2 rounded-[--radius-lg] bg-surface-cream px-4 text-sm font-bold text-on-surface-secondary active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Change store
        </button>

        {staffLoading && (
          <div className="flex min-h-[180px] items-center justify-center rounded-[--radius-lg] bg-surface-white shadow-sm">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        )}

        {!staffLoading && staffList.length > 9 && (
          <div className="relative mb-4">
            <span aria-hidden="true" className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-secondary">search</span>
            <input
              value={staffSearch}
              onChange={(event) => setStaffSearch(event.target.value)}
              placeholder="Find your name"
              aria-label="Find your name"
              className="h-14 w-full rounded-[--radius-lg] border-2 border-outline bg-surface-white pl-12 pr-4 text-base font-bold text-on-surface shadow-sm placeholder:text-on-surface-secondary focus:border-brand focus:outline-none"
            />
          </div>
        )}

        {!staffLoading && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filteredStaff.map((user) => {
            const color = getAvatarColor(user.fullName);
            const rc = roleColors[user.role] || roleColors.STAFF;
            return (
              <button
                key={user.loginId}
                onClick={() => { setSelected(user); setPin(''); setError(''); }}
                className="flex min-h-[136px] flex-col items-center gap-2 rounded-[--radius-lg] border-2 border-transparent bg-surface-white p-4 shadow-sm transition-all duration-150 active:scale-95 hover:border-brand/30 focus:border-brand"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: color }}
                >
                  {user.initials}
                </div>
                <span className="text-sm font-bold text-on-surface text-center leading-tight">{user.firstName}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rc.bg} ${rc.text}`}>
                  {user.role}
                </span>
              </button>
            );
          })}
        </div>}

        {!staffLoading && filteredStaff.length === 0 && (
          <div className="rounded-[--radius-lg] bg-surface-white p-6 text-center shadow-sm">
            <p className="font-bold text-on-surface">No names found</p>
            <button
              type="button"
              onClick={() => setStaffSearch('')}
              className="mt-3 min-h-12 rounded-[--radius-lg] bg-surface-cream px-4 text-sm font-bold text-on-surface-secondary"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    );
  }

  const color = getAvatarColor(selected.fullName);

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="bg-surface-white rounded-[--radius-lg] shadow-lg p-8">
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl"
            style={{ backgroundColor: color }}
          >
            {selected.initials}
          </div>
          <h2 className="text-xl font-extrabold text-on-surface">{selected.fullName}</h2>
          <p className="text-sm text-on-surface-secondary mt-1">{selected.storeName}</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Enter PIN</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="••••"
              className="w-full h-[56px] px-4 text-center text-2xl tracking-[0.3em] bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-brand focus:outline-none transition-colors text-on-surface placeholder:text-on-surface-secondary"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && pin.length >= 4) handleSubmit(); }}
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-error text-sm">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={pin.length < 4 || loading}
            className="w-full h-[56px] bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-transform duration-150 flex items-center justify-center gap-2 shadow-md"
          >
            {loading ? (
              <><span className="material-symbols-outlined animate-spin">progress_activity</span>Signing in...</>
            ) : (
              'Sign In'
            )}
          </button>
        </div>

        <button
          onClick={() => { setSelected(null); setPin(''); setError(''); }}
          className="w-full mt-4 text-center text-sm text-on-surface-secondary hover:text-on-surface transition-colors flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Choose another person
        </button>
      </div>

      <p className="text-center text-xs text-on-surface-secondary mt-4">Need help? Contact IT Support</p>
    </div>
  );
}
