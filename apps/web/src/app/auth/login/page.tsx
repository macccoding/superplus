'use client';

import { trpc } from '@/lib/trpc-client';
import { LoginClient } from './login-client';

export default function LoginPage() {
  const { data: stores, isLoading: storesLoading, isError: storesError } = trpc.users.loginStores.useQuery();

  if (storesError) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-brand rounded-2xl mx-auto mb-4 flex items-center justify-center brand-shadow">
          <span className="text-on-brand text-2xl font-extrabold">S+</span>
        </div>
        <h1 className="text-xl font-bold text-on-surface mb-2">SuperPlus</h1>
        <p className="text-error text-sm">Could not load staff list. Check your connection.</p>
      </div>
    );
  }

  if (storesLoading || !stores) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-brand rounded-2xl mx-auto mb-4 flex items-center justify-center brand-shadow">
            <span className="text-on-brand text-2xl font-extrabold tracking-tight">S+</span>
          </div>
          <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
        </div>
      </div>
    );
  }

  return <LoginClient stores={stores} />;
}
