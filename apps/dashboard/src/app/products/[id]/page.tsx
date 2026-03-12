'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useProduct, useCategories, useSuppliers, useStockEvents } from '@superplus/db/hooks';
import { useSupabase } from '@superplus/auth';
import type { Product, DailyPrice } from '@superplus/db';
import { LoadingState } from '@superplus/ui';
import { format } from 'date-fns';
import { DashboardShell } from '../../components/dashboard-shell';
import { LineChartWidget } from '../../components/charts/line-chart';

export default function ProductDetailPage() {
  const supabase = useSupabase();
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const { data: product, loading: productLoading } = useProduct(productId);
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data: stockEvents } = useStockEvents({ productId });

  const [form, setForm] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState(false);
  const [priceHistory, setPriceHistory] = useState<DailyPrice[]>([]);

  // Load product data into form
  useEffect(() => {
    if (product) {
      setForm(product);
    }
  }, [product]);

  // Fetch price history
  useEffect(() => {
    if (!productId) return;
    supabase
      .from('daily_prices')
      .select('*')
      .eq('product_id', productId)
      .order('effective_date', { ascending: true })
      .limit(60)
      .then(({ data }) => {
        if (data) setPriceHistory(data as DailyPrice[]);
      });
  }, [productId]);

  const priceChartData = useMemo(
    () =>
      priceHistory.map((dp) => ({
        date: format(new Date(dp.effective_date), 'MMM d'),
        selling: dp.selling_price,
        cost: dp.cost_price ?? 0,
      })),
    [priceHistory]
  );

  async function handleSave() {
    if (!product) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: form.name,
          barcode: form.barcode,
          category_id: form.category_id,
          cost_price: form.cost_price,
          selling_price: form.selling_price,
          target_margin: form.target_margin,
          supplier_id: form.supplier_id,
          reorder_point: form.reorder_point,
          reorder_qty: form.reorder_qty,
          shelf_location: form.shelf_location,
          unit_of_measure: form.unit_of_measure,
          is_active: form.is_active,
          is_produce: form.is_produce,
          is_weight_based: form.is_weight_based,
        })
        .eq('id', product.id);

      if (error) {
        alert('Error saving product: ' + error.message);
      } else {
        alert('Product saved successfully');
      }
    } finally {
      setSaving(false);
    }
  }

  if (productLoading) {
    return (
      <DashboardShell>
        <LoadingState message="Loading product..." />
      </DashboardShell>
    );
  }

  if (!product) {
    return (
      <DashboardShell>
        <div className="text-center py-16">
          <p className="text-text-secondary">Product not found</p>
          <button
            onClick={() => router.push('/products')}
            className="mt-4 px-4 py-2 text-sm text-brand-primary hover:underline"
          >
            Back to Products
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
          onClick={() => router.push('/products')}
          className="flex items-center justify-center w-9 h-9 rounded-button border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold text-text-primary">{product.name}</h1>
          <p className="text-sm text-text-secondary">
            {product.barcode ? `Barcode: ${product.barcode}` : 'No barcode'}
          </p>
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
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface rounded-card border border-gray-100 p-6">
            <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
              Product Details
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
                <label className="block text-sm font-medium text-text-primary mb-1">Barcode</label>
                <input
                  type="text"
                  value={form.barcode ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Category</label>
                <select
                  value={form.category_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                >
                  <option value="">None</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Supplier</label>
                <select
                  value={form.supplier_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                >
                  <option value="">None</option>
                  {suppliers?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Selling Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.selling_price ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, selling_price: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Cost Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.cost_price ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, cost_price: parseFloat(e.target.value) || null }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Target Margin (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.target_margin ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, target_margin: parseFloat(e.target.value) || null }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Shelf Location</label>
                <input
                  type="text"
                  value={form.shelf_location ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, shelf_location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Unit of Measure</label>
                <input
                  type="text"
                  value={form.unit_of_measure ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, unit_of_measure: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Reorder Point</label>
                <input
                  type="number"
                  value={form.reorder_point ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, reorder_point: parseInt(e.target.value) || null }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>

              {/* Toggles */}
              <div className="md:col-span-2 flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active ?? true}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/30"
                  />
                  <span className="text-sm text-text-primary">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_produce ?? false}
                    onChange={(e) => setForm((f) => ({ ...f, is_produce: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/30"
                  />
                  <span className="text-sm text-text-primary">Produce</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_weight_based ?? false}
                    onChange={(e) => setForm((f) => ({ ...f, is_weight_based: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/30"
                  />
                  <span className="text-sm text-text-primary">Weight-based</span>
                </label>
              </div>
            </div>
          </div>

          {/* Price History Chart */}
          {priceChartData.length > 0 && (
            <div className="bg-surface rounded-card border border-gray-100 p-6">
              <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
                Price History
              </h2>
              <LineChartWidget
                data={priceChartData}
                xAxisKey="date"
                lines={[
                  { dataKey: 'selling', color: '#E31837', label: 'Selling Price' },
                  { dataKey: 'cost', color: '#1B3A5C', label: 'Cost Price' },
                ]}
                height={250}
              />
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          {/* Stock Events */}
          <div className="bg-surface rounded-card border border-gray-100 p-6">
            <h2 className="text-base font-heading font-semibold text-text-primary mb-4">
              Stock Event History
            </h2>
            {!stockEvents || stockEvents.length === 0 ? (
              <p className="text-sm text-text-secondary">No stock events recorded</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {stockEvents.slice(0, 20).map((event) => (
                  <div key={event.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0">
                    <div
                      className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
                        event.event_type === 'stockout'
                          ? 'bg-danger'
                          : event.event_type === 'delivery'
                          ? 'bg-success'
                          : event.event_type === 'expiry_flag'
                          ? 'bg-warning'
                          : 'bg-brand-secondary'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary capitalize">
                        {event.event_type.replace('_', ' ')}
                        {event.quantity != null ? ` (qty: ${event.quantity})` : ''}
                      </p>
                      {event.notes && (
                        <p className="text-xs text-text-secondary mt-0.5 truncate">{event.notes}</p>
                      )}
                      <p className="text-xs text-text-secondary mt-0.5">
                        {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
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
