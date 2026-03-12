import type { Database, Supplier } from '../types';

type SupplierInsert = Database['public']['Tables']['suppliers']['Insert'];
type SupplierUpdate = Database['public']['Tables']['suppliers']['Update'];

// ---------------------------------------------------------------------------
// Get all suppliers, optionally filtered by active status
// ---------------------------------------------------------------------------
export async function getSuppliers(
  supabase: any,
  filters: {
    isActive?: boolean;
  } = {},
): Promise<Supplier[]> {
  let query = supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Get a single supplier by ID
// ---------------------------------------------------------------------------
export async function getSupplierById(
  supabase: any,
  id: string,
): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Create a new supplier
// ---------------------------------------------------------------------------
export async function createSupplier(
  supabase: any,
  data: SupplierInsert,
): Promise<Supplier> {
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return supplier;
}

// ---------------------------------------------------------------------------
// Update an existing supplier
// ---------------------------------------------------------------------------
export async function updateSupplier(
  supabase: any,
  id: string,
  data: SupplierUpdate,
): Promise<Supplier> {
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return supplier;
}
