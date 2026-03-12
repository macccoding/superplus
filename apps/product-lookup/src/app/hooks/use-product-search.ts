'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '@superplus/auth';
import { searchProducts, getProductsForOfflineCache } from '@superplus/db/queries/products';
import { searchCachedProducts, cacheProducts, getProductCacheAge } from '@superplus/db/offline';
import { LIMITS } from '@superplus/config';
import type { Product } from '@superplus/db';

interface UseProductSearchResult {
  results: Product[];
  loading: boolean;
  error: string | null;
}

export function useProductSearch(query: string): UseProductSearchResult {
  const supabase = useSupabase();
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Periodically cache products for offline use
  useEffect(() => {
    async function syncCache() {
      try {
        const cacheAge = await getProductCacheAge();
        // Refresh cache if it's older than the configured TTL or doesn't exist
        if (cacheAge === null || cacheAge > LIMITS.PRODUCT_CACHE_TTL_MS) {
          const products = await getProductsForOfflineCache(supabase);
          await cacheProducts(
            products.map((p) => ({
              ...p,
              unit_of_measure: 'each',
            }))
          );
        }
      } catch {
        // Silently fail cache sync -- not critical
      }
    }

    syncCache();
    const interval = setInterval(syncCache, LIMITS.PRODUCT_CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, []);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      if (navigator.onLine) {
        // Online: use Supabase RPC
        const data = await searchProducts(supabase, searchQuery, 20);
        setResults(data);
      } else {
        // Offline: search IndexedDB cache
        const cached = await searchCachedProducts(searchQuery);
        // Map cached products to full Product shape with sensible defaults
        const mapped: Product[] = cached.map((p) => ({
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          category_id: p.category_id,
          subcategory_id: null,
          cost_price: null,
          selling_price: p.selling_price,
          target_margin: null,
          supplier_id: null,
          reorder_point: null,
          reorder_qty: null,
          shelf_location: p.shelf_location,
          unit_of_measure: 'each',
          is_active: true,
          is_produce: false,
          is_weight_based: false,
          created_at: '',
          updated_at: '',
        }));
        setResults(mapped);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Search failed. Please try again.');
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  return { results, loading, error };
}
