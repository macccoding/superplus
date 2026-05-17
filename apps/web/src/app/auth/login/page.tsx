'use client';

import { useState, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const pinInputRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      phone,
      pin,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Wrong PIN. Try again.');
      setPin('');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-surface-container-lowest rounded-xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-md brand-shadow">
            <span className="text-on-primary text-[36px] font-black tracking-tight">S+</span>
          </div>
          <h1 className="text-[28px] font-extrabold text-on-surface">SuperPlus</h1>
          <p className="text-on-surface-variant text-sm mt-1">Staff Hub</p>
        </div>

        <div className="mb-10" />

        {step === 'phone' ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 876 000 0000"
                className="w-full h-[56px] px-4 text-lg bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none transition-colors text-on-surface placeholder:text-outline"
                autoFocus
              />
            </div>
            <button
              onClick={() => phone.length >= 10 && setStep('pin')}
              disabled={phone.length < 10}
              className="w-full h-[56px] bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-transform duration-150 flex items-center justify-center gap-2 shadow-md"
            >
              Next
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-2">
                Enter PIN
              </label>
              <div
                className="flex justify-center gap-3 cursor-pointer"
                onClick={() => pinInputRef.current?.focus()}
              >
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                      pin.length > i
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-outline-variant bg-surface-container-low'
                    }`}
                  >
                    {pin.length > i ? '●' : ''}
                  </div>
                ))}
              </div>
              <input
                ref={pinInputRef}
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="sr-only"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pin.length === 4) handleSubmit();
                }}
              />
              {error && (
                <div className="flex items-center justify-center gap-2 text-error text-sm mt-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={pin.length !== 4 || loading}
              className="w-full h-[56px] bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-transform duration-150 flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
            <button
              onClick={() => { setStep('phone'); setPin(''); setError(''); }}
              className="w-full h-12 text-on-surface-variant text-sm hover:text-on-surface transition-colors"
            >
              ← Change number
            </button>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-on-surface-variant mt-4">
        Need help? Contact IT Support
      </p>
    </div>
  );
}
