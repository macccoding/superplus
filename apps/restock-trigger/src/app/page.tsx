'use client';

import { useState, useCallback } from 'react';
import { AppShell, SearchBar, BarcodeScanner, LoadingState } from '@superplus/ui';
import { useAuth } from '@superplus/auth';
import { useProductSearch } from '@superplus/db/hooks';
import type { Product } from '@superplus/db';
import { RestockForm } from './components/restock-form';
import { BulkMode } from './components/bulk-mode';
import { PendingRestocks } from './components/pending-restocks';

type ViewTab = 'flag' | 'pending';

export default function RestockPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ViewTab>('flag');
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [bulkMode, setBulkMode] = useState(false);

  const { data: searchResults, loading: searching } = useProductSearch(searchQuery);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedProduct(null);
  }, []);

  const handleScan = useCallback((barcode: string) => {
    setSearchQuery(barcode);
    setScannerOpen(false);
  }, []);

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSearchQuery('');
  }, []);

  const handleRestockSubmitted = useCallback(() => {
    setSelectedProduct(null);
    setSearchQuery('');
  }, []);

  if (authLoading) {
    return (
      <AppShell title="Restock">
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Restock"
      headerRight={
        <button
          onClick={() => setBulkMode(!bulkMode)}
          className={`text-sm font-medium px-3 py-1 rounded-button transition-colors ${
            bulkMode ? 'bg-white text-brand-primary' : 'text-white/90 hover:text-white hover:bg-white/10'
          }`}
        >
          {bulkMode ? 'Single' : 'Bulk'}
        </button>
      }
    >
      {/* Tab toggle */}
      <div className="flex bg-gray-100 rounded-button p-1 mb-4">
        <button
          onClick={() => setActiveTab('flag')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-button transition-colors ${
            activeTab === 'flag'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary'
          }`}
        >
          Flag Item
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-button transition-colors ${
            activeTab === 'pending'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary'
          }`}
        >
          Pending
        </button>
      </div>

      {activeTab === 'flag' ? (
        <div className="space-y-4">
          <SearchBar
            placeholder="Search product to restock..."
            onSearch={handleSearch}
            onScanClick={() => setScannerOpen(true)}
            value={searchQuery}
          />

          {/* Search results */}
          {searchQuery && !selectedProduct && (
            <div className="space-y-2">
              {searching ? (
                <LoadingState message="Searching..." />
              ) : searchResults && searchResults.length > 0 ? (
                searchResults.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full text-left bg-surface border border-gray-200 rounded-card p-3 hover:shadow-md active:shadow-sm transition-shadow"
                  >
                    <p className="font-medium text-text-primary">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {product.shelf_location && (
                        <span className="text-xs text-text-secondary">{product.shelf_location}</span>
                      )}
                      {product.barcode && (
                        <span className="text-xs text-text-secondary font-mono">{product.barcode}</span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-text-secondary text-center py-4">No products found</p>
              )}
            </div>
          )}

          {/* Restock form or bulk mode */}
          {bulkMode ? (
            <BulkMode userId={user?.id ?? ''} />
          ) : (
            selectedProduct && (
              <RestockForm
                product={selectedProduct}
                userId={user?.id ?? ''}
                onSubmitted={handleRestockSubmitted}
              />
            )
          )}
        </div>
      ) : (
        <PendingRestocks userId={user?.id ?? ''} />
      )}

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </AppShell>
  );
}
