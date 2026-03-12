'use client';

import { useState } from 'react';
import { AppShell, SearchBar, BarcodeScanner, LoadingState } from '@superplus/ui';
import { useOnlineStatus } from '@superplus/db/offline';
import { useProductSearch } from './hooks/use-product-search';
import { SearchResults } from './components/search-results';
import { RecentSearches } from './components/recent-searches';

export default function ProductLookupPage() {
  const [query, setQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { results, loading, error } = useProductSearch(query);

  function handleSearch(value: string) {
    setQuery(value);
  }

  function handleScan(barcode: string) {
    setQuery(barcode);
    setScannerOpen(false);
  }

  return (
    <AppShell
      title="Product Lookup"
      headerRight={
        !isOnline ? (
          <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded-full font-medium">
            Offline
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <SearchBar
          placeholder="Search by name or barcode..."
          onSearch={handleSearch}
          onScanClick={() => setScannerOpen(true)}
          autoFocus
        />

        {error && (
          <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-card">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingState message="Searching products..." />
        ) : query.trim() ? (
          <SearchResults results={results} query={query} />
        ) : (
          <RecentSearches />
        )}
      </div>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </AppShell>
  );
}
