'use client';

import type { ReactNode } from 'react';
import { useAuth } from './provider';
import type { Role, AppId } from '@superplus/config';
import { hasAccess, hasMinRole } from '@superplus/config';

interface RoleGateProps {
  children: ReactNode;
  requiredRole?: Role;
  appId?: AppId;
  fallback?: ReactNode;
}

export function RoleGate({ children, requiredRole, appId, fallback }: RoleGateProps) {
  const { role, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!role) {
    return fallback ?? null;
  }

  if (requiredRole && !hasMinRole(role, requiredRole)) {
    return fallback ?? (
      <div className="flex items-center justify-center min-h-[200px] text-text-secondary">
        You don&apos;t have permission to view this content.
      </div>
    );
  }

  if (appId && !hasAccess(role, appId)) {
    return fallback ?? (
      <div className="flex items-center justify-center min-h-[200px] text-text-secondary">
        You don&apos;t have access to this app.
      </div>
    );
  }

  return <>{children}</>;
}

export function useRequireRole(requiredRole: Role): {
  allowed: boolean;
  loading: boolean;
  role: Role | null;
} {
  const { role, loading } = useAuth();

  if (loading) {
    return { allowed: false, loading: true, role: null };
  }

  return {
    allowed: role ? hasMinRole(role, requiredRole) : false,
    loading: false,
    role,
  };
}

export function useCanViewCost(): boolean {
  const { role } = useAuth();
  return role === 'owner' || role === 'manager' || role === 'supervisor';
}
