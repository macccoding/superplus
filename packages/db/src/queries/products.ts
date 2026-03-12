import type { Database, Product } from '../types';

type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

// ---------------------------------------------------------------------------
// Search products using the database full-text search RPC
// ---------------------------------------------------------------------------
export async function searchProducts(
  supabase: any,
  query: string,
  limit: number = 20,
): Promise<Product[]> {
  const { data, error } = await supabase.rpc('search_products', {
    search_query: query,
    limit_count: limit,
  });

  if (error) throw error;
  return (data ?? []) as Product[];
}

// ---------------------------------------------------------------------------
// Get a single product by its primary key
// ---------------------------------------------------------------------------
export async function getProductById(
  supabase: any,
  id: string,
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Look up a product by barcode (unique)
// ---------------------------------------------------------------------------
export async function getProductByBarcode(
  supabase: any,
  barcode: string,
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// List products with optional filters and pagination
// ---------------------------------------------------------------------------
export async function getProducts(
  supabase: any,
  filters: {
    categoryId?: string;
    supplierId?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Product[]> {
  const { categoryId, supplierId, isActive, limit = 50, offset = 0 } = filters;

  let query = supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  if (categoryId !== undefined) {
    query = query.eq('category_id', categoryId);
  }
  if (supplierId !== undefined) {
    query = query.eq('supplier_id', supplierId);
  }
  if (isActive !== undefined) {
    query = query.eq('is_active', isActive);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Create a new product
// ---------------------------------------------------------------------------
export async function createProduct(
  supabase: any,
  data: ProductInsert,
): Promise<Product> {
  const { data: product, error } = await supabase
    .from('products')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return product;
}

// ---------------------------------------------------------------------------
// Update an existing product
// ---------------------------------------------------------------------------
export async function updateProduct(
  supabase: any,
  id: string,
  data: ProductUpdate,
): Promise<Product> {
  const { data: product, error } = await supabase
    .from('products')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return product;
}

// ---------------------------------------------------------------------------
// Lightweight product list for offline / PWA cache.
// Returns only the columns needed by the scanner & quick-lookup features.
// ---------------------------------------------------------------------------
export async function getProductsForOfflineCache(
  supabase: any,
): Promise<
  Pick<Product, 'id' | 'name' | 'barcode' | 'selling_price' | 'shelf_location' | 'category_id'>[]
> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, barcode, selling_price, shelf_location, category_id')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
