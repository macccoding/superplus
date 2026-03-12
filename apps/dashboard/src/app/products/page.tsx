'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProducts, useCategories } from '@superplus/db/hooks';
import type { Product } from '@superplus/db';
import { SearchBar, StatusBadge, getStatusVariant } from '@superplus/ui';
import { DashboardShell } from '../components/dashboard-shell';
import { DataTable, type Column } from '../components/data-table';

export default function ProductsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const { data: products, loading } = useProducts({ isActive: undefined });
  const { data: categories } = useCategories();

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories?.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
      );
    }

    if (categoryFilter) {
      result = result.filter((p) => p.category_id === categoryFilter);
    }

    return result;
  }, [products, searchQuery, categoryFilter]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (p) => <span className="font-medium">{p.name}</span>,
    },
    {
      key: 'barcode',
      header: 'Barcode',
      sortable: true,
      render: (p) => <span className="text-text-secondary font-mono text-xs">{p.barcode ?? '-'}</span>,
    },
    {
      key: 'category_id',
      header: 'Category',
      sortable: true,
      accessor: (p) => p.category_id ? categoryMap[p.category_id] ?? '' : '',
      render: (p) => categoryMap[p.category_id ?? ''] ?? '-',
    },
    {
      key: 'selling_price',
      header: 'Price',
      sortable: true,
      render: (p) => `$${p.selling_price.toFixed(2)}`,
    },
    {
      key: 'cost_price',
      header: 'Cost',
      sortable: true,
      render: (p) => p.cost_price != null ? `$${p.cost_price.toFixed(2)}` : '-',
    },
    {
      key: 'margin',
      header: 'Margin',
      sortable: true,
      accessor: (p) => {
        if (p.cost_price == null || p.cost_price === 0) return null;
        return ((p.selling_price - p.cost_price) / p.selling_price) * 100;
      },
      render: (p) => {
        if (p.cost_price == null || p.cost_price === 0) return '-';
        const margin = ((p.selling_price - p.cost_price) / p.selling_price) * 100;
        return (
          <span className={margin < 15 ? 'text-danger font-medium' : margin > 30 ? 'text-success font-medium' : ''}>
            {margin.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (p) => (
        <StatusBadge
          label={p.is_active ? 'Active' : 'Inactive'}
          variant={p.is_active ? 'success' : 'neutral'}
          dot
        />
      ),
    },
  ];

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Products</h1>
          <p className="text-sm text-text-secondary mt-1">
            {products?.length ?? 0} products total
          </p>
        </div>
        <button
          onClick={() => router.push('/products/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white text-sm font-semibold rounded-button hover:bg-brand-primary/90 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchBar
            placeholder="Search by name or barcode..."
            onSearch={handleSearch}
            autoFocus={false}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-3 bg-surface border border-gray-200 rounded-input text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        >
          <option value="">All Categories</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Data Table */}
      <div className="bg-surface rounded-card border border-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-brand-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <DataTable<Product>
            data={filteredProducts}
            columns={columns}
            keyExtractor={(p) => p.id}
            onRowClick={(p) => router.push(`/products/${p.id}`)}
            emptyMessage="No products found matching your search"
          />
        )}
      </div>
    </DashboardShell>
  );
}
