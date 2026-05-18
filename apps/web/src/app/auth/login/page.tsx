'use client';

import { trpc } from '@/lib/trpc-client';
import { LoginClient } from './login-client';

export default function LoginPage() {
  const { data: staff, isLoading } = trpc.users.loginList.useQuery();

  if (isLoading || !staff) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center brand-shadow">
            <span className="text-on-primary text-2xl font-black tracking-tight">S+</span>
          </div>
          <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
        </div>
      </div>
    );
  }

  return <LoginClient staff={staff} />;
}
