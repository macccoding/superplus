'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { useSession } from 'next-auth/react';
import { EmptyState } from '@superplus/ui';

const statusLabels: Record<string, string> = { REPORTED: 'Reported', ACKNOWLEDGED: 'Acknowledged', RESTOCKED: 'Restocked' };
const locationSuggestions = ['Front', 'Aisle', 'Backroom', 'Chiller', 'Freezer'];

export default function StockOutPage() {
  return (
    <Suspense fallback={<ToolLoading title="Stock-Out Reports" />}>
      <StockOutContent />
    </Suspense>
  );
}

function ToolLoading({ title }: { title: string }) {
  return (
    <div className="px-5 py-6">
      <h2 className="text-2xl font-bold text-on-surface">{title}</h2>
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
      </div>
    </div>
  );
}

function StockOutContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const { data: reports, isLoading } = trpc.stockOuts.list.useQuery();
  const { data: myRecent } = trpc.stockOuts.myRecent.useQuery();
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const initialProductName = searchParams.get('productName') || '';
  const initialProductId = searchParams.get('productId');
  const initialLocation = searchParams.get('location') || '';
  const [showForm, setShowForm] = useState(Boolean(initialProductName));
  const [productName, setProductName] = useState(initialProductName);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(
    initialProductId ? { id: initialProductId, name: initialProductName } : null
  );
  const [location, setLocation] = useState(initialLocation);
  const [mutationError, setMutationError] = useState('');
  const [notice, setNotice] = useState('');

  const canManage = session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER' || session?.user?.role === 'SUPERVISOR';

  const create = trpc.stockOuts.create.useMutation({
    onSuccess: () => {
      utils.stockOuts.invalidate();
      setShowForm(false);
      setProductName('');
      setSelectedProduct(null);
      setLocation('');
      setNotice('Stock-out report sent.');
      setTimeout(() => setNotice(''), 4000);
    },
    onError: (err) => { setMutationError(err.message); setTimeout(() => setMutationError(''), 5000); },
  });
  const { data: productResults } = trpc.products.search.useQuery(
    { query: productName || undefined, limit: 5 },
    { enabled: showForm && productName.trim().length >= 2 && !selectedProduct }
  );

  const updateStatus = trpc.stockOuts.updateStatus.useMutation({
    onSuccess: () => utils.stockOuts.invalidate(),
    onError: (err) => { setMutationError(err.message); setTimeout(() => setMutationError(''), 5000); },
  });
  const createTask = trpc.tasks.createFromSource.useMutation({
    onSuccess: () => utils.tasks.invalidate(),
    onError: (err) => { setMutationError(err.message); setTimeout(() => setMutationError(''), 5000); },
  });

  const items = tab === 'open' ? reports : myRecent;

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Stock-Out Reports</h2>
        <p className="text-sm text-on-surface-secondary mt-1">{reports?.length || 0} open reports</p>
      </section>

      {mutationError && (
        <div className="mx-[--spacing-container] mb-4 bg-error/10 text-error rounded-[--radius-lg] p-3 flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {mutationError}
        </div>
      )}
      {notice && (
        <div className="mx-[--spacing-container] mb-4 bg-success/10 text-success rounded-[--radius-lg] p-3 flex items-center gap-2 text-sm font-bold">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {notice}
        </div>
      )}

      {/* Tabs */}
      <div className="px-5 mb-4">
        <div className="flex bg-surface-cream rounded-[--radius-lg] p-1">
          <button onClick={() => setTab('open')} className={`flex-1 py-2.5 text-center rounded-lg text-sm font-medium transition-all ${tab === 'open' ? 'bg-brand text-on-brand shadow-sm' : 'text-on-surface-secondary'}`}>Open</button>
          <button onClick={() => setTab('mine')} className={`flex-1 py-2.5 text-center rounded-lg text-sm font-medium transition-all ${tab === 'mine' ? 'bg-brand text-on-brand shadow-sm' : 'text-on-surface-secondary'}`}>My Reports</button>
        </div>
      </div>

      <section className="px-5 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        ) : items && items.length > 0 ? (
          items.map((report: any) => (
            <div key={report.id} className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-on-surface">{report.productName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {report.location && <span className="text-xs text-on-surface-secondary">{report.location}</span>}
                    <span className="text-xs text-on-surface-secondary">by {report.reportedBy?.fullName || 'You'}</span>
                  </div>
                  <span className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                    report.status === 'REPORTED' ? 'bg-error/10 text-error' :
                    report.status === 'ACKNOWLEDGED' ? 'bg-warning/20/30 text-warning' :
                    'bg-success/10 text-success'
                  }`}>{statusLabels[report.status] || report.status}</span>
                </div>
                {canManage && report.status !== 'RESTOCKED' && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => createTask.mutate({
                        sourceType: 'STOCK_OUT' as any,
                        sourceId: report.id,
                        sourceLabel: report.productName,
                        title: `Restock ${report.productName}`,
                        description: `Stock-out reported${report.location ? ` at ${report.location}` : ''}.`,
                        category: 'Stock',
                        workArea: report.location || undefined,
                        priority: 'HIGH' as any,
                      })}
                      className="h-12 px-3 bg-navy/10 rounded-lg text-sm font-bold text-navy"
                    >
                      Task
                    </button>
                    {report.status === 'REPORTED' && (
                      <button onClick={() => updateStatus.mutate({ id: report.id, status: 'ACKNOWLEDGED' })} className="h-12 px-4 bg-surface-cream rounded-lg text-sm font-medium text-on-surface-secondary">Ack</button>
                    )}
                    <button onClick={() => updateStatus.mutate({ id: report.id, status: 'RESTOCKED' })} className="h-12 px-4 bg-success/10 rounded-lg text-sm font-bold text-success">Restocked</button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={tab === 'open' ? 'check_circle' : 'receipt_long'} title={tab === 'open' ? 'No open reports' : 'No reports yet'} description={tab === 'open' ? 'All shelves stocked' : 'Your reports will appear here'} />
        )}
      </section>

      {/* Quick report form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setShowForm(false)}>
          <div className="bg-surface-white w-full rounded-t-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
            <h3 className="text-xl font-bold text-on-surface">Report Stock-Out</h3>
            <div>
              <label htmlFor="stock-product" className="block text-xs font-bold text-on-surface-secondary mb-2">Product</label>
            <input
              id="stock-product"
              value={productName}
              onChange={(e) => { setProductName(e.target.value); setSelectedProduct(null); }}
              placeholder="Search product or enter manually"
              className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors"
              autoFocus
            />
            </div>
            {!selectedProduct && productResults && productResults.items.length > 0 && (
              <div className="rounded-[--radius-lg] bg-surface overflow-hidden">
                {productResults.items.map((product: any) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setProductName(product.name);
                      setLocation(product.location || location);
                    }}
                    className="w-full p-3 text-left border-b border-outline/10 last:border-b-0 active:bg-surface-cream"
                  >
                    <p className="text-sm font-bold text-on-surface">{product.name}</p>
                    <p className="text-xs text-on-surface-secondary">{[product.brand, product.location, product.matchReason].filter(Boolean).join(' · ') || 'Catalog product'}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <div className="rounded-[--radius-lg] bg-success/10 p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-success">Linked to catalog</p>
                  <p className="text-xs text-on-surface-secondary">{selectedProduct.barcode || selectedProduct.sku || selectedProduct.category?.name || selectedProduct.name}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="w-10 h-10 rounded-lg bg-surface-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}
            <div>
              <label htmlFor="stock-location" className="block text-xs font-bold text-on-surface-secondary mb-2">Location</label>
              <input id="stock-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Aisle, shelf, or area" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {locationSuggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLocation(item)}
                    className="h-10 shrink-0 rounded-lg bg-surface-cream px-3 text-xs font-bold text-on-surface-secondary active:scale-95 transition-all"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => create.mutate({ productName: productName.trim(), productId: selectedProduct?.id, location: location.trim() || undefined })}
              disabled={!productName.trim() || create.isPending}
              className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all"
            >
              Report Empty Shelf
            </button>
          </div>
        </div>
      )}

      <button onClick={() => setShowForm(true)} className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-error text-on-error shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200">
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
