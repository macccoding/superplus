'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSupabase } from '@superplus/auth';
import type { Supplier, Product, StockEvent, Issue } from '@superplus/db';
import { LoadingState, StatusBadge, getStatusVariant } from '@superplus/ui';
import { format, formatDistanceToNow } from 'date-fns';
import { DashboardShell } from '../../components/dashboard-shell';

export default function SupplierDetailPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Supplier>>({});
  const [saving, setSaving] = useState(false);
  const [deliveries, setDeliveries] = useState<(StockEvent & { product?: Product })[]>([]);
  const [supplierIssues, setSupplierIssues] = useState<Issue[]>([]);

  // Fetch supplier
  useEffect(() => {
    supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setSupplier(data as Supplier);
          setForm(data as Supplier);
        }
        setLoading(false);
      });
  }, [supplierId]);

  // Fetch delivery history (stock events with type=delivery for products from this supplier)
  useEffect(() => {
    supabase
      .from('stock_events')
      .select('*, product:products!inner(*)')
      .eq('event_type', 'delivery')
      .eq('product.supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setDeliveries(data as any);
      });
  }, [supplierId]);

  // Fetch related issues
  useEffect(() => {
    supabase
      .from('issues')
      .select('*')
      .eq('issue_type', 'supplier')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setSupplierIssues(data as Issue[]);
      });
  }, [supplierId]);

  async function handleSave() {
    if (!supplier) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: form.name,
          contact_phone: form.contact_phone,
          contact_email: form.contact_email,
          delivery_days: form.delivery_days,
          lead_time_days: form.lead_time_days,
          notes: form.notes,
          is_active: form.is_active,
        })
        .eq('id', supplier.id);

      if (error) {
        alert('Error saving supplier: ' + error.message);
      } else {
        alert('Supplier saved successfully');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <LoadingState message="Loading supplier..." />
      </DashboardShell>
    );
  }

  if (!supplier) {
    return (
      <DashboardShell>
        <div className="text-center py-16">
          <p className="text-text-secondary">Supplier not found</p>
          <button
            onClick={() => router.push('/suppliers')}
            className="mt-4 px-4 py-2 text-sm text-brand-primary hover:underline"
          >
            Back to Suppliers
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/suppliers')}
          className="flex items-center justify-center w-9 h-9 rounded-button border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold text-text-primary">{supplier.name}</h1>
          <p className="text-sm text-text-secondary">Supplier details and history</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-brand-primary text-white text-sm font-semibold rounded-button hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-card border border-gray-100 p-6">
            <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
              Supplier Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Name</label>
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.contact_phone ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Email</label>
                <input
                  type="email"
                  value={form.contact_email ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Delivery Days
                </label>
                <input
                  type="text"
                  placeholder="e.g., Mon, Wed, Fri"
                  value={form.delivery_days ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_days: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  value={form.lead_time_days ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, lead_time_days: parseInt(e.target.value) || null }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active ?? true}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/30"
                  />
                  <span className="text-sm text-text-primary">Active</span>
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-primary mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={form.notes ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Delivery History */}
          <div className="bg-surface rounded-card border border-gray-100 p-6">
            <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
              Delivery History
            </h2>
            {deliveries.length === 0 ? (
              <p className="text-sm text-text-secondary">No delivery records</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {deliveries.map((d) => (
                  <div key={d.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0">
                    <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-success" />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary">
                        {(d as any).product?.name ?? 'Product'}
                        {d.quantity != null && ` (qty: ${d.quantity})`}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {format(new Date(d.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related Issues */}
          <div className="bg-surface rounded-card border border-gray-100 p-6">
            <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
              Supplier Issues
            </h2>
            {supplierIssues.length === 0 ? (
              <p className="text-sm text-text-secondary">No supplier issues reported</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {supplierIssues.map((issue) => (
                  <div key={issue.id} className="p-3 bg-background rounded-lg">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary truncate flex-1">
                        {issue.title}
                      </p>
                      <StatusBadge
                        label={issue.status}
                        variant={getStatusVariant(issue.status)}
                        size="sm"
                      />
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
