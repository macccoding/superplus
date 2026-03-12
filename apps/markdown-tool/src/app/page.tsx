'use client';

import { useState, useCallback } from 'react';
import { AppShell, SearchBar, LoadingState } from '@superplus/ui';
import { useAuth } from '@superplus/auth';
import { useProductSearch } from '@superplus/db/hooks';
import type { Product } from '@superplus/db';
import { PriceForm } from './components/price-form';
import { ActiveMarkdowns } from './components/active-markdowns';
import { ApprovalPending } from './components/approval-pending';

type ViewTab = 'new' | 'active' | 'pending';

export default function MarkdownToolPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ViewTab>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: searchResults, loading: searching } = useProductSearch(searchQuery);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedProduct(null);
  }, []);

  const handleSelectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSearchQuery('');
  }, []);

  const handleMarkdownCreated = useCallback(() => {
    setSelectedProduct(null);
    setSearchQuery('');
    setActiveTab('active');
  }, []);

  const isManager = role === 'owner' || role === 'manager';

  if (authLoading) {
    return (
      <AppShell title="Markdown Tool">
        <LoadingState />
      </AppShell>
    );
  }

  return (
    <AppShell title="Markdown Tool">
      {/* Tab navigation */}
      <div className="flex bg-gray-100 rounded-button p-1 mb-4">
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-button transition-colors ${
            activeTab === 'new'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary'
          }`}
        >
          New Markdown
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-button transition-colors ${
            activeTab === 'active'
              ? 'bg-surface text-text-primary shadow-sm'
              : 'text-text-secondary'
          }`}
        >
          Active
        </button>
        {isManager && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-button transition-colors ${
              activeTab === 'pending'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary'
            }`}
          >
            Pending Approval
          </button>
        )}
      </div>

      {activeTab === 'new' && (
        <div className="space-y-4">
          <SearchBar
            placeholder="Search products..."
            onSearch={handleSearch}
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-text-primary">{product.name}</p>
                        {product.shelf_location && (
                          <p className="text-xs text-text-secondary mt-0.5">{product.shelf_location}</p>
                        )}
                      </div>
                      <span className="text-lg font-heading font-bold text-text-primary">
                        ${product.selling_price.toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-text-secondary text-center py-4">No products found</p>
              )}
            </div>
          )}

          {selectedProduct && (
            <PriceForm
              product={selectedProduct}
              userId={user?.id ?? ''}
              onCreated={handleMarkdownCreated}
              onCancel={() => setSelectedProduct(null)}
            />
          )}
        </div>
      )}

      {activeTab === 'active' && <ActiveMarkdowns userId={user?.id ?? ''} />}

      {activeTab === 'pending' && isManager && (
        <ApprovalPending userId={user?.id ?? ''} />
      )}
    </AppShell>
  );
}
