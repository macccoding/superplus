'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPassword } from '@superplus/auth/actions';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signInWithPassword(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-secondary to-brand-secondary/80 px-4">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-card shadow-xl p-8">
          {/* Brand header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary mb-4">
              <svg
                className="w-8 h-8 text-white"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <h1 className="text-2xl font-heading font-bold text-text-primary">
              SuperPlus Dashboard
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Sign in to access the management dashboard
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger text-sm rounded-input px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text-primary mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@superplus.com"
                className="w-full px-4 py-3 bg-background border border-gray-200 rounded-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-primary mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-background border border-gray-200 rounded-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-brand-primary text-white font-semibold rounded-button hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/60 mt-6">
          Access restricted to managers and owners
        </p>
      </div>
    </div>
  );
}
