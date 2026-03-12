import type { Database, Suggestion } from '../types';

type SuggestionInsert = Database['public']['Tables']['suggestions']['Insert'];

// ---------------------------------------------------------------------------
// Create a new suggestion / feedback item
// ---------------------------------------------------------------------------
export async function createSuggestion(
  supabase: any,
  params: {
    message: string;
    category: Suggestion['category'];
    isAnonymous: boolean;
    userId: string;
  },
): Promise<Suggestion> {
  const { message, category, isAnonymous, userId } = params;

  const { data, error } = await supabase
    .from('suggestions')
    .insert({
      message,
      category,
      is_anonymous: isAnonymous,
      submitted_by_user_id: userId,
    } satisfies SuggestionInsert)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Get suggestions with optional filters and pagination
// ---------------------------------------------------------------------------
export async function getSuggestions(
  supabase: any,
  filters: {
    status?: Suggestion['status'];
    category?: Suggestion['category'];
    limit?: number;
    offset?: number;
  } = {},
): Promise<Suggestion[]> {
  const { status, category, limit = 50, offset = 0 } = filters;

  let query = supabase
    .from('suggestions')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== undefined) {
    query = query.eq('status', status);
  }
  if (category !== undefined) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Manager reviews a suggestion (approve, action, dismiss)
// ---------------------------------------------------------------------------
export async function reviewSuggestion(
  supabase: any,
  id: string,
  params: {
    status: Suggestion['status'];
    managerNotes: string;
  },
): Promise<Suggestion> {
  const { status, managerNotes } = params;

  const { data, error } = await supabase
    .from('suggestions')
    .update({
      status,
      manager_notes: managerNotes,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
