'use client';

import { useEffect, useState } from 'react';
import { useAuth, useSupabase } from '@superplus/auth';
import { getTodayExpiryCount, getStockEvents } from '@superplus/db/queries/stock-events';
import { EXPIRY_THRESHOLDS } from '@superplus/config';
import type { StockEvent } from '@superplus/db';

interface ExpirySummaryProps {
  onFlagAnother: () => void;
}

interface FlaggedItem {
  id: string;
  productName: string;
  expiryDate: string;
  status: 'expired' | 'critical' | 'warning' | 'ok';
}

function parseExpiryDate(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/expiry_date:(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function getExpiryStatus(dateString: string): 'expired' | 'critical' | 'warning' | 'ok' {
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

const statusColors: Record<string, string> = {
  expired: 'bg-danger text-white',
  critical: 'bg-orange-500 text-white',
  warning: 'bg-warning text-white',
  ok: 'bg-success text-white',
};

const statusLabels: Record<string, string> = {
  expired: 'EXPIRED',
  critical: '3 DAYS',
  warning: '7 DAYS',
  ok: 'OK',
};

export function ExpirySummary({ onFlagAnother }: ExpirySummaryProps) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchTodayFlags() {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [flagCount, events] = await Promise.all([
          getTodayExpiryCount(supabase, user!.id),
          getStockEvents(supabase, {
            eventType: 'expiry_flag',
            dateFrom: todayStart.toISOString(),
          }),
        ]);

        setCount(flagCount);

        // Fetch product names for events
        const productIds = [...new Set(events.map((e) => e.product_id))];
        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .in('id', productIds);

        const productMap = new Map(products?.map((p) => [p.id, p.name]) ?? []);

        const flaggedItems: FlaggedItem[] = events
          .filter((e) => e.reported_by_user_id === user!.id)
          .map((event) => {
            const expiryDate = parseExpiryDate(event.notes);
            return {
              id: event.id,
              productName: productMap.get(event.product_id) ?? 'Unknown Product',
              expiryDate: expiryDate ?? '',
              status: expiryDate ? getExpiryStatus(expiryDate) : 'ok',
            };
          });

        setItems(flaggedItems);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchTodayFlags();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-brand-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2ECC71"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-heading font-bold text-text-primary">
          You&apos;ve flagged {count} item{count !== 1 ? 's' : ''} today
        </h2>
      </div>

      {/* Flagged items list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-surface border border-gray-100 rounded-card px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{item.productName}</p>
                {item.expiryDate && (
                  <p className="text-xs text-text-secondary">
                    Expires: {new Date(item.expiryDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[item.status]}`}
              >
                {statusLabels[item.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Flag another button */}
      <button
        onClick={onFlagAnother}
        className="w-full py-3 bg-brand-primary text-white font-heading font-semibold rounded-button hover:bg-brand-primary/90 transition-colors"
      >
        Flag Another
      </button>
    </div>
  );
}
