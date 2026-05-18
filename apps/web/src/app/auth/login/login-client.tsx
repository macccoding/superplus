'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface StaffMember {
  phone: string;
  fullName: string;
  firstName: string;
  initials: string;
  role: string;
  storeName: string;
}

const roleColors: Record<string, { bg: string; text: string }> = {
  OWNER: { bg: 'bg-primary/10', text: 'text-primary' },
  MANAGER: { bg: 'bg-tertiary/10', text: 'text-tertiary' },
  SUPERVISOR: { bg: 'bg-secondary/10', text: 'text-secondary' },
  STAFF: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
};

const avatarColors = ['#446185', '#2e7d32', '#845500', '#c00029', '#1565c0', '#673ab7', '#5c1f5c', '#a73b21'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function LoginClient({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!selected || pin.length < 4) return;
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      phone: selected.phone,
      pin,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid PIN. Try again.');
      setPin('');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  if (!selected) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-3 flex items-center justify-center brand-shadow">
            <span className="text-on-primary text-2xl font-black tracking-tight">S+</span>
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface">SuperPlus</h1>
          <p className="text-on-surface-variant text-sm mt-1">Select your name to sign in</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {staff.map((user) => {
            const color = getAvatarColor(user.fullName);
            const rc = roleColors[user.role] || roleColors.STAFF;
            return (
              <button
                key={user.phone}
                onClick={() => { setSelected(user); setPin(''); setError(''); }}
                className="flex flex-col items-center gap-2 p-4 bg-surface-container-lowest rounded-xl shadow-sm active:scale-95 transition-all duration-150 border-2 border-transparent hover:border-primary/30 focus:border-primary"
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
        </div>
      </div>
    );
  }

  const color = getAvatarColor(selected.fullName);

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="bg-surface-container-lowest rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl"
            style={{ backgroundColor: color }}
          >
            {selected.initials}
          </div>
          <h2 className="text-xl font-extrabold text-on-surface">{selected.fullName}</h2>
          <p className="text-sm text-on-surface-variant mt-1">{selected.storeName}</p>
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
              className="w-full h-[56px] px-4 text-center text-2xl tracking-[0.3em] bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none transition-colors text-on-surface placeholder:text-outline"
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
            className="w-full h-[56px] bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-transform duration-150 flex items-center justify-center gap-2 shadow-md"
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
          className="w-full mt-4 text-center text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Choose another person
        </button>
      </div>

      <p className="text-center text-xs text-on-surface-variant mt-4">Need help? Contact IT Support</p>
    </div>
  );
}
