'use client';

import { ProductCard, EmptyState } from '@superplus/ui';
import { useCanViewCost } from '@superplus/auth';
import type { Product } from '@superplus/db';

interface SearchResultsProps {
  results: Product[];
  query: string;
}

export function SearchResults({ results, query }: SearchResultsProps) {
  const canViewCost = useCanViewCost();

  if (results.length === 0 && query.trim()) {
    return (
      <EmptyState
        title="No products found"
        description={`No results for "${query}". Try a different search term or scan a barcode.`}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M8 11h6" />
          </svg>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary px-1">
        {results.length} result{results.length !== 1 ? 's' : ''}
      </p>
      {results.map((product) => (
        <ProductCard
          key={product.id}
          name={product.name}
          price={product.selling_price}
          unit={product.unit_of_measure}
          shelfLocation={product.shelf_location}
          costPrice={product.cost_price}
          showCost={canViewCost}
        />
      ))}
    </div>
  );
}
