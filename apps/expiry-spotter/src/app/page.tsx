'use client';

import { useState } from 'react';
import { AppShell, SearchBar, BarcodeScanner, LoadingState, ProductCard } from '@superplus/ui';
import { useProductSearch } from '@superplus/db/hooks';
import { useSupabase } from '@superplus/auth';
import { getProductByBarcode } from '@superplus/db/queries/products';
import type { Product } from '@superplus/db';
import { ExpiryForm } from './components/expiry-form';
import { ExpirySummary } from './components/expiry-summary';

type ViewState = 'search' | 'form' | 'summary';

export default function ExpirySpotterPage() {
  const supabase = useSupabase();
  const [view, setView] = useState<ViewState>('search');
  const [query, setQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: results, loading } = useProductSearch(query);

  function handleSearch(value: string) {
    setQuery(value);
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product);
    setView('form');
  }

  function handleExpirySuccess() {
    setView('summary');
    setSelectedProduct(null);
    setQuery('');
  }

  function handleFlagAnother() {
    setView('search');
    setQuery('');
    setSelectedProduct(null);
  }

  async function handleScan(barcode: string) {
    setScannerOpen(false);
    try {
      const product = await getProductByBarcode(supabase, barcode);
      if (product) {
        handleSelectProduct(product);
      } else {
        setQuery(barcode);
      }
    } catch {
      setQuery(barcode);
    }
  }

  return (
    <AppShell title="Expiry Spotter">
      {view === 'search' && (
        <div className="space-y-4">
          <SearchBar
            placeholder="Search product to check expiry..."
            onSearch={handleSearch}
            onScanClick={() => setScannerOpen(true)}
            autoFocus
          />

          {loading ? (
            <LoadingState message="Searching..." />
          ) : (
            query.trim() && (
              <div className="space-y-3">
                {results && results.length > 0 ? (
                  results.map((product) => (
                    <ProductCard
                      key={product.id}
                      name={product.name}
                      price={product.selling_price}
                      unit={product.unit_of_measure}
                      shelfLocation={product.shelf_location}
                      onClick={() => handleSelectProduct(product)}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-text-secondary text-sm">
                    No products found for &quot;{query}&quot;
                  </div>
                )}
              </div>
            )
          )}

          {!query.trim() && (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-3"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <p className="text-sm text-text-secondary">
                Search for a product to flag its expiry date
              </p>
            </div>
          )}
        </div>
      )}

      {view === 'form' && selectedProduct && (
        <ExpiryForm
          product={selectedProduct}
          onSuccess={handleExpirySuccess}
          onCancel={handleFlagAnother}
        />
      )}

      {view === 'summary' && (
        <ExpirySummary onFlagAnother={handleFlagAnother} />
      )}

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </AppShell>
  );
}
