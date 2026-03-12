import type { Database, Profile } from '../types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

// ---------------------------------------------------------------------------
// Get a single user profile by user_id (auth uid)
// ---------------------------------------------------------------------------
export async function getProfile(
  supabase: any,
  userId: string,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Get all active staff profiles
// ---------------------------------------------------------------------------
export async function getActiveStaff(
  supabase: any,
): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Get staff filtered by role
// ---------------------------------------------------------------------------
export async function getStaffByRole(
  supabase: any,
  role: Profile['role'],
): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', role)
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Update a user profile
// ---------------------------------------------------------------------------
export async function updateProfile(
  supabase: any,
  userId: string,
  data: ProfileUpdate,
): Promise<Profile> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return profile;
}
