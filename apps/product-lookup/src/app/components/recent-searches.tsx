'use client';

import { useEffect, useState } from 'react';
import { ProductCard } from '@superplus/ui';
import type { Product } from '@superplus/db';

const STORAGE_KEY = 'product-lookup:recent-searches';
const MAX_RECENT = 10;

interface StoredProduct {
  id: string;
  name: string;
  selling_price: number;
  unit_of_measure: string;
  shelf_location: string | null;
}

export function addToRecentSearches(product: Product) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const items: StoredProduct[] = stored ? JSON.parse(stored) : [];

    // Remove duplicate if exists
    const filtered = items.filter((item) => item.id !== product.id);

    // Prepend new item
    const updated = [
      {
        id: product.id,
        name: product.name,
        selling_price: product.selling_price,
        unit_of_measure: product.unit_of_measure,
        shelf_location: product.shelf_location,
      },
      ...filtered,
    ].slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable
  }
}

export function RecentSearches() {
  const [items, setItems] = useState<StoredProduct[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    setItems([]);
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 text-gray-300 mx-auto mb-3"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <p className="text-sm text-text-secondary">
          Search for a product by name or scan a barcode
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-heading font-semibold text-text-secondary uppercase tracking-wide">
          Recent Searches
        </h2>
        <button
          onClick={handleClear}
          className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium"
        >
          Clear history
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <ProductCard
            key={item.id}
            name={item.name}
            price={item.selling_price}
            unit={item.unit_of_measure}
            shelfLocation={item.shelf_location}
          />
        ))}
      </div>
    </div>
  );
}
