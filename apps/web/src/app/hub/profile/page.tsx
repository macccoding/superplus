'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function ProfilePage() {
  const router = useRouter();
  const { data: user } = trpc.users.me.useQuery();
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  const changePin = trpc.users.changeMyPin.useMutation({
    onSuccess: () => {
      setPinSuccess(true);
      setShowPinChange(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => setPinSuccess(false), 3000);
    },
    onError: (err) => {
      setPinError(err.message);
    },
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="px-5 py-6">
      <h2 className="text-2xl font-bold text-on-surface mb-6">Profile</h2>

      {/* User info card */}
      <div className="bg-surface-white rounded-[--radius-lg] p-6 shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-navy/10 flex items-center justify-center">
            <span className="text-xl font-bold text-navy">
              {user.fullName.split(' ').map((n: string) => n[0]).join('')}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface">{user.fullName}</h3>
            <span className="text-sm text-on-surface-secondary">{user.role}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 py-3 border-b border-outline/20">
            <span className="material-symbols-outlined text-on-surface-secondary">call</span>
            <div>
              <p className="text-xs text-on-surface-secondary">Phone</p>
              <p className="text-sm font-medium text-on-surface">{user.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3">
            <span className="material-symbols-outlined text-on-surface-secondary">store</span>
            <div>
              <p className="text-xs text-on-surface-secondary">Store</p>
              <p className="text-sm font-medium text-on-surface">{user.store.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* PIN success message */}
      {pinSuccess && (
        <div className="bg-success/10 text-success rounded-[--radius-lg] p-4 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-sm font-medium">PIN changed successfully</span>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => router.push('/hub/schedule')}
          className="w-full bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-navy">calendar_month</span>
            <span className="text-sm font-bold text-on-surface">My Schedule</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-secondary text-[20px]">chevron_right</span>
        </button>

        <button
          onClick={() => router.push('/hub/availability')}
          className="w-full bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-warning">event_available</span>
            <span className="text-sm font-bold text-on-surface">My Availability</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-secondary text-[20px]">chevron_right</span>
        </button>

        <button
          onClick={() => setShowPinChange(!showPinChange)}
          className="w-full bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-navy">lock</span>
            <span className="text-sm font-bold text-on-surface">Change PIN</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-secondary text-[20px]">
            {showPinChange ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showPinChange && (
          <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) => { setCurrentPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="Current PIN"
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-on-surface-secondary transition-colors"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="New PIN"
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-on-surface-secondary transition-colors"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm New PIN"
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-on-surface-secondary transition-colors"
            />
            {pinError && (
              <p className="text-error text-sm text-center flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {pinError}
              </p>
            )}
            <button
              onClick={() => {
                if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
                if (newPin.length !== 4) { setPinError('PIN must be 4 digits'); return; }
                changePin.mutate({ currentPin, newPin });
              }}
              disabled={currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4 || changePin.isPending}
              className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {changePin.isPending ? (
                <><span className="material-symbols-outlined animate-spin">progress_activity</span>Updating...</>
              ) : 'Update PIN'}
            </button>
          </div>
        )}

        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="w-full bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-error">logout</span>
          <span className="text-sm font-bold text-error">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
