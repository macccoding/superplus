'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createBrowserClient } from '@superplus/db/client';
import type { Profile } from '@superplus/db';
import type { Role } from '@superplus/config';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  session: Session | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  supabase: ReturnType<typeof createBrowserClient>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    role: null,
    session: null,
    loading: true,
  });

  const supabase = createBrowserClient();

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data as Profile | null;
  }

  async function refreshProfile() {
    if (!state.user) return;
    const profile = await fetchProfile(state.user.id);
    setState((prev) => ({
      ...prev,
      profile,
      role: (profile?.role as Role) ?? null,
    }));
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: session.user,
          profile,
          role: (profile?.role as Role) ?? null,
          session,
          loading: false,
        });
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({
          user: session.user,
          profile,
          role: (profile?.role as Role) ?? null,
          session,
          loading: false,
        });
      } else {
        setState({
          user: null,
          profile: null,
          role: null,
          session: null,
          loading: false,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setState({
      user: null,
      profile: null,
      role: null,
      session: null,
      loading: false,
    });
  }

  return (
    <AuthContext.Provider value={{ ...state, supabase, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useSupabase() {
  const { supabase } = useAuth();
  return supabase;
}
