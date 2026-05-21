'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

export default function ProductLookupPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [stockFilter, setStockFilter] = useState<string | undefined>();
  const [showScanner, setShowScanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = useCallback((barcode: string) => {
    setQuery(barcode);
    setShowScanner(false);
    inputRef.current?.focus();
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: categories } = trpc.categories.list.useQuery();
  const { data: results, isLoading } = trpc.products.search.useQuery(
    {
      query: debouncedQuery || undefined,
      categoryId: categoryFilter,
      stockStatus: stockFilter as any,
    },
    { enabled: debouncedQuery.length > 0 || !!categoryFilter || !!stockFilter }
  );

  const stockDot: Record<string, string> = {
    IN_STOCK: 'bg-success',
    LOW: 'bg-warning/20',
    OUT_OF_STOCK: 'bg-error',
  };

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Product Lookup</h2>
      </section>

      {/* Search bar */}
      <div className="px-5 mb-4">
        <div className="relative">
          <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-secondary">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or barcode..."
            className="w-full h-14 pl-12 pr-16 bg-surface-white border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary transition-colors shadow-sm"
            autoFocus
          />
          <button
            type="button"
            aria-label="Scan barcode"
            onClick={() => setShowScanner(true)}
            className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-lg bg-surface-cream"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-on-surface-secondary">qr_code_scanner</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 mb-4 flex gap-2 overflow-x-auto pb-2">
        <select
          value={categoryFilter || ''}
          onChange={(e) => setCategoryFilter(e.target.value || undefined)}
          className="h-12 shrink-0 rounded-lg border-0 bg-surface-cream px-4 text-sm font-bold text-on-surface-secondary focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {['IN_STOCK', 'LOW', 'OUT_OF_STOCK'].map((s) => (
          <button
            key={s}
            onClick={() => setStockFilter(stockFilter === s ? undefined : s)}
            className={`h-12 shrink-0 rounded-lg px-4 text-sm font-bold whitespace-nowrap transition-all ${
              stockFilter === s ? 'bg-brand text-on-brand' : 'bg-surface-cream text-on-surface-secondary'
            }`}
          >
            {s.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      {/* Results */}
      <section className="px-5 pb-24 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        )}

        {results && results.items.length > 0 ? (
          results.items.map((product: any) => (
            <button
              key={product.id}
              onClick={() => router.push(`/tools/product-lookup/${product.id}`)}
              className="w-full text-left bg-surface-white rounded-[--radius-lg] p-4 shadow-sm active:scale-[0.98] transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-on-surface truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {product.matchReason && (
                      <span className="text-xs px-2 py-0.5 bg-brand/10 rounded text-brand font-bold">
                        {product.matchReason}
                      </span>
                    )}
                    {product.category && (
                      <span className="text-xs px-2 py-0.5 bg-surface-cream rounded text-on-surface-secondary">
                        {product.category.name}
                      </span>
                    )}
                    {product.brand && (
                      <span className="text-xs text-on-surface-secondary">{product.brand}</span>
                    )}
                    {product.location && (
                      <span className="text-xs text-on-surface-secondary">{product.location}</span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className="text-lg font-bold text-on-surface">${Number(product.retailPrice).toFixed(2)}</p>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <span aria-hidden="true" className={`w-2 h-2 rounded-full ${stockDot[product.stockStatus]}`} />
                    <span className="text-xs text-on-surface-secondary">{product.stockStatus.replaceAll('_', ' ')}</span>
                  </div>
                </div>
              </div>
            </button>
          ))
        ) : (
          !isLoading && (debouncedQuery || categoryFilter || stockFilter) && (
            <EmptyState
              icon="search_off"
              title="No products found"
              description="Try a different search or filter"
            />
          )
        )}

        {results && results.nextCursor && (
          <p className="text-center text-xs text-on-surface-secondary py-4">Showing first 20 results. Refine your search for more.</p>
        )}

        {!debouncedQuery && !categoryFilter && !stockFilter && !isLoading && (
          <EmptyState icon="inventory_2" title="Search products" description="Search by name or scan a barcode" />
        )}
      </section>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

function BarcodeScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detector: any = null;
    let animId: number;

    async function start() {
      try {
        if (!('BarcodeDetector' in window)) {
          setError('Barcode scanning not supported on this device. Enter barcode manually.');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });

        const scan = async () => {
          if (videoRef.current && detector) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                onScan(barcodes[0].rawValue);
                return;
              }
            } catch {}
          }
          animId = requestAnimationFrame(scan);
        };
        scan();
      } catch (err) {
        setError('Camera access denied. Enter barcode manually.');
      }
    }

    start();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animId) cancelAnimationFrame(animId);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-[--spacing-container]">
      <button type="button" onClick={onClose} aria-label="Close scanner" className="absolute top-6 right-6 flex h-12 w-12 items-center justify-center rounded-full text-white">
        <span aria-hidden="true" className="material-symbols-outlined text-[32px]">close</span>
      </button>
      {error ? (
        <div className="text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[48px] text-white/60 mb-4">no_photography</span>
          <p className="text-white">{error}</p>
          <button onClick={onClose} className="mt-4 px-6 py-3 bg-white text-black font-bold rounded-[--radius-lg]">
            Close
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="w-full max-w-sm rounded-[--radius-lg]" playsInline muted />
          <p className="text-white/80 text-sm mt-4">Point camera at barcode</p>
        </>
      )}
    </div>
  );
}
