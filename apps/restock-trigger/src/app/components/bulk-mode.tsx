'use client';

import { useState, useCallback } from 'react';
import { SearchBar, QuickAction, NotificationBanner, LoadingState } from '@superplus/ui';
import { useProductSearch } from '@superplus/db/hooks';
import { useSupabase } from '@superplus/auth';
import { createRestockRequest } from '@superplus/db/queries/stock-events';
import type { Product } from '@superplus/db';

interface BulkModeProps {
  userId: string;
}

export function BulkMode({ userId }: BulkModeProps) {
  const supabase = useSupabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: searchResults, loading: searching } = useProductSearch(searchQuery);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleAddProduct = useCallback((product: Product) => {
    setQueue((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.id === product.id)) return prev;
      return [...prev, product];
    });
    setSearchQuery('');
  }, []);

  const handleRemoveProduct = useCallback((productId: string) => {
    setQueue((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const handleSubmitAll = useCallback(async () => {
    if (queue.length === 0) return;
    setSubmitting(true);
    try {
      await Promise.all(
        queue.map((product) =>
          createRestockRequest(supabase, {
            productId: product.id,
            reportedByUserId: userId,
            priority: 'normal',
          })
        )
      );
      setSuccess(true);
      setQueue([]);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to submit bulk restock:', err);
    } finally {
      setSubmitting(false);
    }
  }, [queue, userId]);

  return (
    <div className="space-y-4">
      <div className="bg-brand-secondary/5 border border-brand-secondary/20 rounded-card px-4 py-3">
        <p className="text-sm text-brand-secondary font-medium">
          Bulk Mode: Search and tap products to add them to the restock queue
        </p>
      </div>

      <SearchBar
        placeholder="Search products to add..."
        onSearch={handleSearch}
        value={searchQuery}
        autoFocus
      />

      {/* Search results */}
      {searchQuery && (
        <div className="space-y-1">
          {searching ? (
            <LoadingState message="Searching..." />
          ) : searchResults && searchResults.length > 0 ? (
            searchResults.slice(0, 8).map((product) => {
              const alreadyQueued = queue.some((p) => p.id === product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => !alreadyQueued && handleAddProduct(product)}
                  disabled={alreadyQueued}
                  className={`w-full text-left p-3 rounded-card border transition-colors ${
                    alreadyQueued
                      ? 'bg-success/5 border-success/20 opacity-60'
                      : 'bg-surface border-gray-200 hover:shadow-md active:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-text-primary text-sm">{product.name}</p>
                    {alreadyQueued && (
                      <span className="text-xs text-success font-medium">Added</span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <p className="text-sm text-text-secondary text-center py-4">No products found</p>
          )}
        </div>
      )}

      {/* Queued items */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">
              Restock Queue
            </h3>
            <span className="bg-brand-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {queue.length}
            </span>
          </div>

          {queue.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between bg-surface border border-gray-200 rounded-card px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{product.name}</p>
                {product.shelf_location && (
                  <p className="text-xs text-text-secondary">{product.shelf_location}</p>
                )}
              </div>
              <button
                onClick={() => handleRemoveProduct(product.id)}
                className="ml-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-text-secondary transition-colors"
                aria-label={`Remove ${product.name}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          ))}

          <QuickAction
            label={`Submit All (${queue.length} items)`}
            variant="primary"
            loading={submitting}
            onClick={handleSubmitAll}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
          />
        </div>
      )}

      {success && (
        <NotificationBanner
          type="success"
          message={`All restock requests submitted successfully`}
          autoDismissMs={3000}
          onDismiss={() => setSuccess(false)}
        />
      )}
    </div>
  );
}
