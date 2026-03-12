'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@superplus/db/client';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function signInWithPhone(phone: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
  });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function verifyOtp(phone: string, token: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

  if (error) {
    return { error: error.message };
  }

  return { data };
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

export async function getSession() {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
