'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSuppliers } from '@superplus/db/hooks';
import type { Supplier } from '@superplus/db';
import { SearchBar, StatusBadge } from '@superplus/ui';
import { DashboardShell } from '../components/dashboard-shell';
import { DataTable, type Column } from '../components/data-table';

export default function SuppliersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: suppliers, loading } = useSuppliers();

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    if (!searchQuery.trim()) return suppliers;

    const q = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.contact_email?.toLowerCase().includes(q) ||
        s.contact_phone?.includes(q)
    );
  }, [suppliers, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier Name',
      sortable: true,
      render: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      key: 'contact_phone',
      header: 'Phone',
      render: (s) => s.contact_phone ?? '-',
    },
    {
      key: 'contact_email',
      header: 'Email',
      render: (s) => (
        <span className="text-xs text-text-secondary">{s.contact_email ?? '-'}</span>
      ),
    },
    {
      key: 'delivery_days',
      header: 'Delivery Days',
      render: (s) => s.delivery_days ?? '-',
    },
    {
      key: 'lead_time_days',
      header: 'Lead Time',
      sortable: true,
      render: (s) => (s.lead_time_days != null ? `${s.lead_time_days}d` : '-'),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (s) => (
        <StatusBadge
          label={s.is_active ? 'Active' : 'Inactive'}
          variant={s.is_active ? 'success' : 'neutral'}
          dot
        />
      ),
    },
  ];

  return (
    <DashboardShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Suppliers</h1>
          <p className="text-sm text-text-secondary mt-1">
            {suppliers?.length ?? 0} suppliers in directory
          </p>
        </div>
        <button
          onClick={() => router.push('/suppliers/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white text-sm font-semibold rounded-button hover:bg-brand-primary/90 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Supplier
        </button>
      </div>

      <div className="mb-6">
        <SearchBar
          placeholder="Search suppliers..."
          onSearch={handleSearch}
          autoFocus={false}
        />
      </div>

      <div className="bg-surface rounded-card border border-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-brand-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <DataTable<Supplier>
            data={filteredSuppliers}
            columns={columns}
            keyExtractor={(s) => s.id}
            onRowClick={(s) => router.push(`/suppliers/${s.id}`)}
            emptyMessage="No suppliers found"
          />
        )}
      </div>
    </DashboardShell>
  );
}
