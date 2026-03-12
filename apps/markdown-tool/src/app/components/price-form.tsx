'use client';

import { useState, useMemo, useCallback } from 'react';
import { ProductCard, QuickAction, PhotoCapture, NotificationBanner } from '@superplus/ui';
import { useSupabase } from '@superplus/auth';
import { createMarkdown } from '@superplus/db/queries/markdowns';
import type { Product } from '@superplus/db';
import type { MarkdownReason } from '@superplus/config';
import { MARKDOWN_REASONS } from '@superplus/config';

interface PriceFormProps {
  product: Product;
  userId: string;
  onCreated: () => void;
  onCancel: () => void;
}

const REASON_LABELS: Record<MarkdownReason, string> = {
  approaching_expiry: 'Approaching Expiry',
  damaged: 'Damaged',
  overstock: 'Overstock',
  promo: 'Promo',
  manager_directed: 'Manager Directed',
  other: 'Other',
};

const DURATION_OPTIONS = [
  { label: 'End of Day', value: 'eod' },
  { label: '3 Days', value: '3d' },
  { label: '7 Days', value: '7d' },
  { label: 'Until Removed', value: 'indefinite' },
] as const;

export function PriceForm({ product, userId, onCreated, onCancel }: PriceFormProps) {
  const supabase = useSupabase();
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState<MarkdownReason | ''>('');
  const [duration, setDuration] = useState<string>('eod');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericPrice = parseFloat(newPrice);
  const costPrice = product.cost_price;
  const currentPrice = product.selling_price;

  const marginInfo = useMemo(() => {
    if (isNaN(numericPrice) || numericPrice <= 0) return null;

    if (costPrice && costPrice > 0) {
      const margin = ((numericPrice - costPrice) / numericPrice) * 100;
      const belowCost = numericPrice < costPrice;
      return {
        margin,
        belowCost,
        color: belowCost ? 'text-danger' : margin >= 20 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger',
        bgColor: belowCost ? 'bg-danger/10' : margin >= 20 ? 'bg-success/10' : margin >= 10 ? 'bg-warning/10' : 'bg-danger/10',
      };
    }
    return null;
  }, [numericPrice, costPrice]);

  const calculateEffectiveUntil = useCallback((dur: string): string | null => {
    const now = new Date();
    switch (dur) {
      case 'eod': {
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
      }
      case '3d': {
        const end = new Date(now);
        end.setDate(end.getDate() + 3);
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
      }
      case '7d': {
        const end = new Date(now);
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
      }
      case 'indefinite':
      default:
        return null;
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!reason) {
      setError('Please select a reason for the markdown');
      return;
    }
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError('Please enter a valid markdown price');
      return;
    }
    if (numericPrice >= currentPrice) {
      setError('Markdown price must be less than the current price');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const effectiveUntil = calculateEffectiveUntil(duration);

      await createMarkdown(supabase, {
        product_id: product.id,
        original_price: currentPrice,
        markdown_price: numericPrice,
        reason: reason as MarkdownReason,
        created_by_user_id: userId,
        effective_from: new Date().toISOString(),
        effective_until: effectiveUntil,
        is_active: true,
      });

      onCreated();
    } catch (err) {
      console.error('Failed to create markdown:', err);
      setError('Failed to create markdown. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [numericPrice, reason, duration, product.id, currentPrice, userId, onCreated, calculateEffectiveUntil]);

  return (
    <div className="space-y-4">
      <ProductCard
        name={product.name}
        price={product.selling_price}
        costPrice={product.cost_price}
        showCost={!!product.cost_price}
        shelfLocation={product.shelf_location}
        unit={product.unit_of_measure}
      />

      {/* Current price display */}
      <div className="bg-surface border border-gray-200 rounded-card p-4">
        <label className="block text-sm text-text-secondary mb-1">Current Price</label>
        <p className="text-2xl font-heading font-bold text-text-primary">
          ${currentPrice.toFixed(2)}
        </p>
      </div>

      {/* New price input */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          New Markdown Price
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-xl">$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="0.00"
            className="w-full pl-10 pr-4 py-4 bg-surface border border-gray-200 rounded-input text-text-primary text-2xl font-mono font-bold placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
        </div>

        {/* Real-time margin calculator */}
        {marginInfo && (
          <div className={`mt-2 px-4 py-3 rounded-card ${marginInfo.bgColor}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${marginInfo.color}`}>
                {marginInfo.belowCost ? 'Below Cost Price!' : `Margin: ${marginInfo.margin.toFixed(1)}%`}
              </span>
              {marginInfo.belowCost && (
                <span className="text-xs text-danger font-medium">Requires manager approval</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reason selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Reason</label>
        <div className="flex flex-wrap gap-2">
          {MARKDOWN_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                reason === r
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
              }`}
            >
              {REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Duration selector */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Duration</label>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDuration(opt.value)}
              className={`py-3 px-4 rounded-button text-sm font-medium border transition-colors ${
                duration === opt.value
                  ? 'bg-brand-secondary text-white border-brand-secondary'
                  : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Photo capture (optional) */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Photo (optional)
        </label>
        <PhotoCapture
          onCapture={(file) => setPhotoFile(file)}
          label="Add Photo"
        />
      </div>

      {/* Below cost warning */}
      {marginInfo?.belowCost && (
        <NotificationBanner
          type="warning"
          message="This markdown is below cost price and will require manager approval before becoming active."
        />
      )}

      {/* Error */}
      {error && (
        <NotificationBanner
          type="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        <QuickAction
          label="Create Markdown"
          variant="primary"
          loading={submitting}
          disabled={!reason || isNaN(numericPrice) || numericPrice <= 0}
          onClick={handleSubmit}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="5" x2="5" y2="19" />
              <circle cx="6.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          }
        />
        <button
          onClick={onCancel}
          className="w-full py-3 text-sm text-text-secondary font-medium hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
