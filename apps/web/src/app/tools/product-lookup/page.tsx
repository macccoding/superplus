'use client';

import { useState, useEffect, useRef } from 'react';
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
    LOW: 'bg-tertiary-container',
    OUT_OF_STOCK: 'bg-error',
  };

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Product Lookup</h2>
      </section>

      {/* Search bar */}
      <div className="px-[--spacing-container] mb-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or barcode..."
            className="w-full h-14 pl-12 pr-14 bg-surface-container-lowest border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-outline transition-colors shadow-sm"
            autoFocus
          />
          <button
            onClick={() => setShowScanner(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-surface-container-high rounded-lg flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-on-surface-variant">qr_code_scanner</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-[--spacing-container] mb-4 flex gap-2 overflow-x-auto pb-1">
        <select
          value={categoryFilter || ''}
          onChange={(e) => setCategoryFilter(e.target.value || undefined)}
          className="h-9 px-3 bg-surface-container-high rounded-lg text-xs font-medium text-on-surface-variant border-0 focus:outline-none"
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
            className={`h-9 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              stockFilter === s ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Results */}
      <section className="px-[--spacing-container] pb-24 space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
          </div>
        )}

        {results && results.items.length > 0 ? (
          results.items.map((product: any) => (
            <button
              key={product.id}
              onClick={() => router.push(`/tools/product-lookup/${product.id}`)}
              className="w-full text-left bg-surface-container-lowest rounded-xl p-4 shadow-sm active:scale-[0.98] transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-on-surface truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {product.category && (
                      <span className="text-xs px-2 py-0.5 bg-surface-container-high rounded text-on-surface-variant">
                        {product.category.name}
                      </span>
                    )}
                    {product.location && (
                      <span className="text-xs text-outline">{product.location}</span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className="text-lg font-bold text-on-surface">${Number(product.retailPrice).toFixed(2)}</p>
                  <div className="flex items-center gap-1 mt-1 justify-end">
                    <span className={`w-2 h-2 rounded-full ${stockDot[product.stockStatus]}`} />
                    <span className="text-xs text-outline">{product.stockStatus.replace('_', ' ')}</span>
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

        {!debouncedQuery && !categoryFilter && !stockFilter && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-[48px] text-outline mb-3">inventory_2</span>
            <p className="text-on-surface-variant">Search by name or scan a barcode</p>
          </div>
        )}
      </section>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={(barcode) => { setQuery(barcode); setShowScanner(false); inputRef.current?.focus(); }}
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
      <button onClick={onClose} className="absolute top-6 right-6 text-white">
        <span className="material-symbols-outlined text-[32px]">close</span>
      </button>
      {error ? (
        <div className="text-center">
          <span className="material-symbols-outlined text-[48px] text-white/60 mb-4">no_photography</span>
          <p className="text-white">{error}</p>
          <button onClick={onClose} className="mt-4 px-6 py-3 bg-white text-black font-bold rounded-xl">
            Close
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="w-full max-w-sm rounded-xl" playsInline muted />
          <p className="text-white/80 text-sm mt-4">Point camera at barcode</p>
        </>
      )}
    </div>
  );
}
