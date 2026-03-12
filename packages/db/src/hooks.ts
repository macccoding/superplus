'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserClient } from './client';
import type { Product, StockEvent, Category, Supplier, Profile, Task, Issue, Suggestion, Checklist, Markdown, DailyPrice } from './types';

function getSupabase() {
  return createBrowserClient();
}

type AsyncState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
};

function useQuery<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  deps: any[] = []
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  const fetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    const { data, error } = await queryFn();
    setState({
      data,
      error: error ? new Error(error.message) : null,
      loading: false,
    });
  }, deps);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { ...state, refetch: fetch };
}

// Products
export function useProducts(filters?: { categoryId?: string; isActive?: boolean }) {
  return useQuery<Product[]>(() => {
    let query = getSupabase().from('products').select('*').order('name');
    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive);
    return query;
  }, [filters?.categoryId, filters?.isActive]);
}

export function useProductSearch(searchQuery: string) {
  return useQuery<Product[]>(
    () => {
      if (!searchQuery.trim()) {
        return Promise.resolve({ data: [], error: null });
      }
      return (getSupabase().rpc as any)('search_products', {
        search_query: searchQuery,
        limit_count: 20,
      });
    },
    [searchQuery]
  );
}

export function useProduct(id: string) {
  return useQuery<Product>(
    () => getSupabase().from('products').select('*').eq('id', id).single(),
    [id]
  );
}

// Categories
export function useCategories() {
  return useQuery<Category[]>(() =>
    getSupabase().from('categories').select('*').order('sort_order')
  );
}

// Suppliers
export function useSuppliers(isActive?: boolean) {
  return useQuery<Supplier[]>(() => {
    let query = getSupabase().from('suppliers').select('*').order('name');
    if (isActive !== undefined) query = query.eq('is_active', isActive);
    return query;
  }, [isActive]);
}

// Stock Events
export function useUnresolvedStockouts() {
  return useQuery<(StockEvent & { product: Product })[]>(() =>
    getSupabase()
      .from('stock_events')
      .select('*, product:products(*)')
      .eq('event_type', 'stockout')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
  );
}

export function useStockEvents(filters?: {
  eventType?: string;
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery<StockEvent[]>(() => {
    let query = getSupabase().from('stock_events').select('*').order('created_at', { ascending: false });
    if (filters?.eventType) query = query.eq('event_type', filters.eventType);
    if (filters?.productId) query = query.eq('product_id', filters.productId);
    if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('created_at', filters.dateTo);
    return query;
  }, [filters?.eventType, filters?.productId, filters?.dateFrom, filters?.dateTo]);
}

// Checklists
export function useActiveChecklist(userId: string) {
  return useQuery<Checklist>(
    () =>
      getSupabase()
        .from('checklists')
        .select('*, checklist_items(*)')
        .eq('completed_by_user_id', userId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    [userId]
  );
}

export function useChecklistHistory(limit = 20) {
  return useQuery<Checklist[]>(() =>
    getSupabase()
      .from('checklists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

// Tasks
export function useShiftTasks(shiftDate: string, assignedTo?: string) {
  return useQuery<Task[]>(() => {
    let query = getSupabase()
      .from('tasks')
      .select('*')
      .eq('shift_date', shiftDate)
      .order('priority', { ascending: false });
    if (assignedTo) query = query.eq('assigned_to_user_id', assignedTo);
    return query;
  }, [shiftDate, assignedTo]);
}

// Issues
export function useIssues(filters?: { type?: string; severity?: string; status?: string }) {
  return useQuery<Issue[]>(() => {
    let query = getSupabase().from('issues').select('*').order('created_at', { ascending: false });
    if (filters?.type) query = query.eq('issue_type', filters.type);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.status) query = query.eq('status', filters.status);
    return query;
  }, [filters?.type, filters?.severity, filters?.status]);
}

// Markdowns
export function useActiveMarkdowns() {
  return useQuery<(Markdown & { product: Product })[]>(() =>
    getSupabase()
      .from('markdowns')
      .select('*, product:products(*)')
      .eq('is_active', true)
      .lte('effective_from', new Date().toISOString())
      .order('created_at', { ascending: false })
  );
}

// Suggestions
export function useSuggestions(filters?: { status?: string; category?: string }) {
  return useQuery<Suggestion[]>(() => {
    let query = getSupabase().from('suggestions').select('*').order('created_at', { ascending: false });
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.category) query = query.eq('category', filters.category);
    return query;
  }, [filters?.status, filters?.category]);
}

// Daily Prices
export function useTodayPrices() {
  const today = new Date().toISOString().split('T')[0];
  return useQuery<(DailyPrice & { product: Product })[]>(
    () =>
      getSupabase()
        .from('daily_prices')
        .select('*, product:products(*)')
        .eq('effective_date', today)
        .order('created_at', { ascending: false }),
    [today]
  );
}

// Profiles
export function useProfile(userId: string) {
  return useQuery<Profile>(
    () => getSupabase().from('profiles').select('*').eq('user_id', userId).single(),
    [userId]
  );
}

export function useActiveStaff() {
  return useQuery<Profile[]>(() =>
    getSupabase().from('profiles').select('*').eq('is_active', true).order('full_name')
  );
}
