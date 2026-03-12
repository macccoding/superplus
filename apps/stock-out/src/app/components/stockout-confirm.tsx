'use client';

import { useState } from 'react';
import { ProductCard, QuickAction } from '@superplus/ui';
import { useAuth, useSupabase } from '@superplus/auth';
import { reportStockout } from '@superplus/db/queries/stock-events';
import type { Product } from '@superplus/db';

interface StockoutConfirmProps {
  product: Product;
  onSuccess: (productName: string) => void;
  onCancel: () => void;
}

export function StockoutConfirm({ product, onSuccess, onCancel }: StockoutConfirmProps) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [level, setLevel] = useState<'low' | 'empty'>('empty');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      await reportStockout(supabase, {
        productId: product.id,
        reportedByUserId: user.id,
        level,
      });
      onSuccess(product.name);
    } catch (err) {
      setError('Failed to report stock-out. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onCancel}
        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to search
      </button>

      <ProductCard
        name={product.name}
        price={product.selling_price}
        unit={product.unit_of_measure}
        shelfLocation={product.shelf_location}
      />

      <div>
        <label className="block text-sm font-medium text-text-primary mb-3">
          Stock Level
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLevel('low')}
            className={`py-4 px-4 rounded-card border-2 text-center font-heading font-semibold transition-all ${
              level === 'low'
                ? 'border-warning bg-warning/10 text-warning'
                : 'border-gray-200 text-text-secondary hover:border-gray-300'
            }`}
          >
            <svg
              className="mx-auto mb-1"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Low
          </button>
          <button
            type="button"
            onClick={() => setLevel('empty')}
            className={`py-4 px-4 rounded-card border-2 text-center font-heading font-semibold transition-all ${
              level === 'empty'
                ? 'border-danger bg-danger/10 text-danger'
                : 'border-gray-200 text-text-secondary hover:border-gray-300'
            }`}
          >
            <svg
              className="mx-auto mb-1"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Empty
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-card">
          {error}
        </div>
      )}

      <QuickAction
        label="Report Stock Out"
        variant="danger"
        onClick={handleSubmit}
        loading={loading}
        disabled={loading}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        }
      />
    </div>
  );
}
