'use client';

import { useState } from 'react';
import { ProductCard, QuickAction, PhotoCapture } from '@superplus/ui';
import { useAuth, useSupabase } from '@superplus/auth';
import { reportExpiry } from '@superplus/db/queries/stock-events';
import { EXPIRY_THRESHOLDS } from '@superplus/config';
import type { Product } from '@superplus/db';

interface ExpiryFormProps {
  product: Product;
  onSuccess: () => void;
  onCancel: () => void;
}

type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'ok';

function getExpiryStatus(dateString: string): ExpiryStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryDate = new Date(dateString);
  expiryDate.setHours(0, 0, 0, 0);

  const diffMs = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= EXPIRY_THRESHOLDS.EXPIRED) return 'expired';
  if (diffDays <= EXPIRY_THRESHOLDS.CRITICAL_DAYS) return 'critical';
  if (diffDays <= EXPIRY_THRESHOLDS.WARNING_DAYS) return 'warning';
  return 'ok';
}

function getStatusDisplay(status: ExpiryStatus): { label: string; className: string } {
  switch (status) {
    case 'expired':
      return { label: 'EXPIRED', className: 'bg-danger text-white' };
    case 'critical':
      return { label: '3 DAYS', className: 'bg-orange-500 text-white' };
    case 'warning':
      return { label: '7 DAYS', className: 'bg-warning text-white' };
    case 'ok':
      return { label: 'OK', className: 'bg-success text-white' };
  }
}

function getQuickDate(option: 'today' | 'thisWeek' | 'thisMonth'): string {
  const now = new Date();
  switch (option) {
    case 'today':
      return now.toISOString().split('T')[0];
    case 'thisWeek': {
      const end = new Date(now);
      end.setDate(end.getDate() + (7 - end.getDay()));
      return end.toISOString().split('T')[0];
    }
    case 'thisMonth': {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return end.toISOString().split('T')[0];
    }
  }
}

export function ExpiryForm({ product, onSuccess, onCancel }: ExpiryFormProps) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [expiryDate, setExpiryDate] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expiryStatus = expiryDate ? getExpiryStatus(expiryDate) : null;
  const statusDisplay = expiryStatus ? getStatusDisplay(expiryStatus) : null;

  async function handleSubmit() {
    if (!user || !expiryDate) return;

    setLoading(true);
    setError(null);

    try {
      // Photo upload would go through Supabase Storage in production
      let photoUrl: string | undefined;
      if (photoFile) {
        const path = `expiry/${product.id}/${Date.now()}-${photoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('photos')
          .upload(path, photoFile);
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('photos')
            .getPublicUrl(uploadData.path);
          photoUrl = urlData.publicUrl;
        }
      }

      await reportExpiry(supabase, {
        productId: product.id,
        reportedByUserId: user.id,
        expiryDate,
        photoUrl,
      });

      onSuccess();
    } catch (err) {
      setError('Failed to report expiry. Please try again.');
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

      {/* Expiry Date Input */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Expiry Date
        </label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        />

        {/* Quick select buttons */}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => setExpiryDate(getQuickDate('today'))}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-text-secondary rounded-full hover:bg-gray-200 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setExpiryDate(getQuickDate('thisWeek'))}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-text-secondary rounded-full hover:bg-gray-200 transition-colors"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => setExpiryDate(getQuickDate('thisMonth'))}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-text-secondary rounded-full hover:bg-gray-200 transition-colors"
          >
            This Month
          </button>
        </div>
      </div>

      {/* Status Badge */}
      {statusDisplay && (
        <div className="flex items-center gap-3">
          <span
            className={`px-4 py-2 rounded-full text-sm font-heading font-bold ${statusDisplay.className}`}
          >
            {statusDisplay.label}
          </span>
          <span className="text-sm text-text-secondary">
            {expiryStatus === 'expired'
              ? 'This product is past its expiry date'
              : expiryStatus === 'critical'
                ? 'Expires within 3 days'
                : expiryStatus === 'warning'
                  ? 'Expires within 7 days'
                  : 'Expiry date is more than 7 days away'}
          </span>
        </div>
      )}

      {/* Photo Capture (optional) */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Photo (optional)
        </label>
        <PhotoCapture
          onCapture={(file) => setPhotoFile(file)}
          label="Take photo of expiry label"
        />
      </div>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-card">
          {error}
        </div>
      )}

      <QuickAction
        label="Flag Expiry"
        variant={expiryStatus === 'expired' ? 'danger' : expiryStatus === 'critical' ? 'warning' : 'primary'}
        onClick={handleSubmit}
        loading={loading}
        disabled={loading || !expiryDate}
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
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
        }
      />
    </div>
  );
}
