'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
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
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#E31837] rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">S+</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">SuperPlus</h1>
          <p className="text-[#6B7280] mt-1">Staff Hub</p>
        </div>

        {step === 'phone' ? (
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 876 000 0000"
              className="w-full h-14 px-4 text-lg border-2 border-gray-200 rounded-lg focus:border-[#E31837] focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => phone.length >= 10 && setStep('pin')}
              disabled={phone.length < 10}
              className="w-full h-14 mt-4 bg-[#E31837] text-white text-lg font-semibold rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-2">
              Enter PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full h-14 px-4 text-center text-3xl tracking-[0.5em] border-2 border-gray-200 rounded-lg focus:border-[#E31837] focus:outline-none"
              autoFocus
            />
            {error && (
              <p className="text-[#E74C3C] text-sm mt-2 text-center">{error}</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={pin.length !== 4 || loading}
              className="w-full h-14 mt-4 bg-[#E31837] text-white text-lg font-semibold rounded-lg disabled:opacity-40"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              onClick={() => { setStep('phone'); setPin(''); setError(''); }}
              className="w-full h-12 mt-2 text-[#6B7280] text-sm"
            >
              Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
