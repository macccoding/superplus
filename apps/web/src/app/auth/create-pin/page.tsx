'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';

export default function CreatePinPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const { data: me, isLoading } = trpc.users.me.useQuery(undefined, { enabled: status === 'authenticated', retry: false });
  const changePin = trpc.users.changeMyPin.useMutation();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login');
      return;
    }
    if (!isLoading && me && !me.mustChangePin) {
      router.replace((me.onboardingVersion ?? 0) < 1 ? '/hub/onboarding' : '/hub');
    }
  }, [isLoading, me, router, status]);

  async function submit() {
    setLocalError('');
    if (currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      setLocalError('Enter all 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setLocalError('The new PINs do not match.');
      return;
    }
    if (newPin === currentPin) {
      setLocalError('Choose a new private PIN, not the temporary PIN.');
      return;
    }
    try {
      await changePin.mutateAsync({ currentPin, newPin, confirmPin });
      await update({
        user: {
          ...session?.user,
          mustChangePin: false,
        },
      });
      router.replace('/hub/onboarding');
      router.refresh();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not change PIN. Check the temporary PIN and try again.');
    }
  }

  const clean = (value: string) => value.replace(/\D/g, '').slice(0, 4);
  const busy = isLoading || changePin.isPending;

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="rounded-[--radius-lg] bg-surface-white p-7 shadow-lg">
        <div className="mb-7 text-center">
          <span className="material-symbols-outlined mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand text-[34px]">lock_reset</span>
          <h1 className="text-2xl font-extrabold text-on-surface">Create Your PIN</h1>
          <p className="mt-2 text-sm text-on-surface-secondary">
            Use the launch PIN once, then choose a private PIN only you know.
          </p>
        </div>

        <div className="space-y-4">
          <PinField
            label="Temporary PIN"
            value={currentPin}
            onChange={(value) => { setCurrentPin(clean(value)); setLocalError(''); }}
            autoFocus
          />
          <PinField
            label="New private PIN"
            value={newPin}
            onChange={(value) => { setNewPin(clean(value)); setLocalError(''); }}
          />
          <PinField
            label="Confirm new PIN"
            value={confirmPin}
            onChange={(value) => { setConfirmPin(clean(value)); setLocalError(''); }}
            onEnter={submit}
          />
        </div>

        {(localError || changePin.error) && (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-[--radius-lg] bg-error/10 p-3 text-sm font-bold text-error">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {localError || changePin.error?.message}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={busy || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[--radius-lg] bg-brand font-extrabold text-on-brand shadow-md transition-transform active:scale-95 disabled:opacity-40"
        >
          {busy ? (
            <><span className="material-symbols-outlined animate-spin">progress_activity</span>Saving...</>
          ) : (
            <><span className="material-symbols-outlined">check</span>Save PIN</>
          )}
        </button>
      </div>
    </div>
  );
}

function PinField({
  label,
  value,
  onChange,
  onEnter,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-on-surface">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') onEnter?.(); }}
        autoFocus={autoFocus}
        className="h-14 w-full rounded-[--radius-lg] border-2 border-outline bg-surface px-4 text-center text-2xl tracking-[0.3em] text-on-surface placeholder:text-on-surface-secondary focus:border-brand focus:outline-none"
        placeholder="••••"
      />
    </label>
  );
}
