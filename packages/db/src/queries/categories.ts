import type { Database, Category } from '../types';

type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

// ---------------------------------------------------------------------------
// Get all categories ordered by sort_order
// ---------------------------------------------------------------------------
export async function getCategories(
  supabase: any,
): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Get a single category by ID
// ---------------------------------------------------------------------------
export async function getCategoryById(
  supabase: any,
  id: string,
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Create a new category
// ---------------------------------------------------------------------------
export async function createCategory(
  supabase: any,
  data: CategoryInsert,
): Promise<Category> {
  const { data: category, error } = await supabase
    .from('categories')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return category;
}

// ---------------------------------------------------------------------------
// Update an existing category
// ---------------------------------------------------------------------------
export async function updateCategory(
  supabase: any,
  id: string,
  data: CategoryUpdate,
): Promise<Category> {
  const { data: category, error } = await supabase
    .from('categories')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return category;
}
