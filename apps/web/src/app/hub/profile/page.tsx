'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';

export default function ProfilePage() {
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
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="px-[--spacing-container] py-6">
      <h2 className="text-2xl font-bold text-on-surface mb-6">Profile</h2>

      {/* User info card */}
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center">
            <span className="text-xl font-bold text-on-secondary-container">
              {user.fullName.split(' ').map((n: string) => n[0]).join('')}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface">{user.fullName}</h3>
            <span className="text-sm text-on-surface-variant">{user.role}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 py-3 border-b border-outline-variant/20">
            <span className="material-symbols-outlined text-on-surface-variant">call</span>
            <div>
              <p className="text-xs text-outline">Phone</p>
              <p className="text-sm font-medium text-on-surface">{user.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3 border-b border-outline-variant/20">
            <span className="material-symbols-outlined text-on-surface-variant">store</span>
            <div>
              <p className="text-xs text-outline">Store</p>
              <p className="text-sm font-medium text-on-surface">{user.store.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3">
            <span className="material-symbols-outlined text-on-surface-variant">badge</span>
            <div>
              <p className="text-xs text-outline">Role</p>
              <p className="text-sm font-medium text-on-surface">{user.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* PIN success message */}
      {pinSuccess && (
        <div className="bg-success/10 text-success rounded-xl p-4 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-sm font-medium">PIN changed successfully</span>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => setShowPinChange(!showPinChange)}
          className="w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">lock</span>
            <span className="text-sm font-bold text-on-surface">Change PIN</span>
          </div>
          <span className="material-symbols-outlined text-outline text-[20px]">
            {showPinChange ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showPinChange && (
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-4">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) => { setCurrentPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
              placeholder="Current PIN"
              className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-outline transition-colors"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="New PIN"
              className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-outline transition-colors"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm New PIN"
              className="w-full h-14 px-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-center text-xl tracking-widest text-on-surface placeholder:text-outline transition-colors"
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
              className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {changePin.isPending ? (
                <><span className="material-symbols-outlined animate-spin">progress_activity</span>Updating...</>
              ) : 'Update PIN'}
            </button>
          </div>
        )}

        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-error">logout</span>
          <span className="text-sm font-bold text-error">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
