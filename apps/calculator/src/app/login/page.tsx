'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPassword } from '@superplus/auth/actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signInWithPassword(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-brand-primary">
            SuperPlus
          </h1>
          <p className="text-sm text-text-secondary mt-1">Calculator</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-primary text-white font-semibold rounded-button hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
