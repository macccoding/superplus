'use client';

import { useCallback, useState } from 'react';
import { AppShell, SearchBar, BarcodeScanner, LoadingState, ProductCard } from '@superplus/ui';
import { useProductSearch } from '@superplus/db/hooks';
import { useSupabase } from '@superplus/auth';
import { getProductByBarcode } from '@superplus/db/queries/products';
import type { Product } from '@superplus/db';
import { StockoutConfirm } from './components/stockout-confirm';
import { StockoutSuccess } from './components/stockout-success';

type ViewState = 'search' | 'confirm' | 'success';

export default function StockOutPage() {
  const supabase = useSupabase();
  const [view, setView] = useState<ViewState>('search');
  const [query, setQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [successName, setSuccessName] = useState('');

  const { data: results, loading } = useProductSearch(query);

  function handleSearch(value: string) {
    setQuery(value);
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product);
    setView('confirm');
  }

  function handleSuccess(productName: string) {
    setSuccessName(productName);
    setView('success');
  }

  const handleReset = useCallback(() => {
    setView('search');
    setQuery('');
    setSelectedProduct(null);
    setSuccessName('');
  }, []);

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
    <AppShell title="We're Out">
      {view === 'search' && (
        <div className="space-y-4">
          <SearchBar
            placeholder="Find the out-of-stock item..."
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
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              <p className="text-sm text-text-secondary">
                Search for the item that&apos;s out of stock
              </p>
            </div>
          )}
        </div>
      )}

      {view === 'confirm' && selectedProduct && (
        <StockoutConfirm
          product={selectedProduct}
          onSuccess={handleSuccess}
          onCancel={handleReset}
        />
      )}

      {view === 'success' && (
        <StockoutSuccess productName={successName} onReset={handleReset} />
      )}

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </AppShell>
  );
}
