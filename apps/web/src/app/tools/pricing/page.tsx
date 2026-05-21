'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';
import { calculateGrossProfit, calculateRetailPrice, formatJmd, getMarginWarning, roundRetailPrice } from '@/lib/pricing';

export default function PricingPage() {
  const [cost, setCost] = useState('');
  const [manualMargin, setManualMargin] = useState('30');
  const [rounding, setRounding] = useState<'cents' | 'nearest-dollar' | 'charm'>('cents');
  const [tab, setTab] = useState<'calculator' | 'rules'>('calculator');
  const { data: categories } = trpc.categories.list.useQuery();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const { data: session } = useSession();
  const canEditRules = session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER' || session?.user?.role === 'SUPERVISOR';

  if (session && !canEditRules) {
    return (
      <div className="px-5 py-6">
        <section className="px-0 pt-0 pb-4">
          <h2 className="text-2xl font-bold text-on-surface">Pricing</h2>
        </section>
        <div className="bg-surface-white rounded-[--radius-lg] p-6 text-center shadow-sm">
          <span className="material-symbols-outlined text-on-surface-secondary text-[48px] mb-2">lock</span>
          <h3 className="text-lg font-bold text-on-surface">Supervisors Only</h3>
          <p className="text-sm text-on-surface-secondary mt-2">Ask a supervisor for price and margin help.</p>
        </div>
      </div>
    );
  }

  const costNum = parseFloat(cost) || 0;
  const manualMarginNum = parseFloat(manualMargin) || 0;
  const margins = Array.from(new Set([20, 25, 30, 35, 40, 50, manualMarginNum])).sort((a, b) => a - b);

  const selectedCategoryMarkup = categories?.find(c => c.id === selectedCategory)?.defaultMarkupPercent;

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Pricing</h2>
        <p className="text-sm text-on-surface-secondary mt-1">Calculate margins and retail prices</p>
      </section>

      {/* Tabs */}
      {canEditRules && (
        <div className="px-5 mb-4">
          <div className="flex bg-surface-cream rounded-[--radius-lg] p-1">
            <button
              onClick={() => setTab('calculator')}
              className={`flex-1 py-2.5 text-center rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === 'calculator' ? 'bg-brand text-on-brand shadow-sm' : 'text-on-surface-secondary'
              }`}
            >
              Calculator
            </button>
            <button
              onClick={() => setTab('rules')}
              className={`flex-1 py-2.5 text-center rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === 'rules' ? 'bg-brand text-on-brand shadow-sm' : 'text-on-surface-secondary'
              }`}
            >
              Margin Rules
            </button>
          </div>
        </div>
      )}

      {tab === 'calculator' ? (
        <div className="px-5 space-y-4">
          {/* Cost input */}
          <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
            <label className="block text-sm font-medium text-on-surface mb-2">Cost Price (JMD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-secondary text-lg font-bold">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                className="w-full h-16 pl-10 pr-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-2xl font-bold text-on-surface placeholder:text-on-surface-secondary transition-colors"
                autoFocus
              />
            </div>

            {/* Category selector */}
            {categories && categories.length > 0 && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-on-surface-secondary mb-2">Category (optional — highlights default margin)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !selectedCategory ? 'bg-navy text-on-navy' : 'bg-surface-cream text-on-surface-secondary'
                    }`}
                  >
                    None
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedCategory === cat.id ? 'bg-navy text-on-navy' : 'bg-surface-cream text-on-surface-secondary'
                      }`}
                    >
                      {cat.name} ({Number(cat.defaultMarkupPercent)}%)
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-secondary mb-2">Manual margin</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualMargin}
                  onChange={(e) => setManualMargin(e.target.value.replace(/[^0-9.-]/g, ''))}
                  className="w-full h-12 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-secondary mb-2">Rounding</label>
                <select value={rounding} onChange={(e) => setRounding(e.target.value as any)} className="w-full h-12 px-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface">
                  <option value="cents">Cents</option>
                  <option value="nearest-dollar">Nearest $</option>
                  <option value="charm">.99 price</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results grid */}
          {costNum > 0 && (
            <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-medium text-on-surface-secondary">Retail Price at Margin</h3>
                {canEditRules && (
                  <button onClick={() => setSaveOpen(true)} className="h-10 px-3 bg-brand text-on-brand rounded-lg text-sm font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Product
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {margins.map((m) => {
                  const retail = roundRetailPrice(calculateRetailPrice(costNum, m), rounding);
                  const isDefault = selectedCategoryMarkup && Number(selectedCategoryMarkup) === m;
                  const warning = getMarginWarning(costNum, retail);
                  return (
                    <div
                      key={m}
                      className={`p-4 rounded-[--radius-lg] text-center transition-all ${
                        isDefault
                          ? 'bg-brand/10 border-2 border-primary'
                          : warning !== 'none'
                            ? 'bg-warning/10 border-2 border-warning/40'
                            : 'bg-surface border-2 border-transparent'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isDefault ? 'text-brand' : 'text-on-surface-secondary'}`}>
                        {m}% markup
                      </span>
                      <p className={`text-xl font-bold mt-1 ${isDefault ? 'text-brand' : 'text-on-surface'}`}>
                        {formatJmd(retail)}
                      </p>
                      <p className="text-xs text-on-surface-secondary mt-0.5">
                        Profit: {formatJmd(calculateGrossProfit(costNum, retail))}
                      </p>
                      {warning !== 'none' && <p className="text-[11px] font-bold text-warning mt-1">{warning === 'negative' ? 'Loss' : 'Low margin'}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {costNum <= 0 && (
            <EmptyState icon="calculate" title="Enter a cost price" description="See retail prices at different margins" />
          )}
          {saveOpen && (
            <SaveProductSheet
              cost={costNum}
              margin={manualMarginNum}
              retail={roundRetailPrice(calculateRetailPrice(costNum, manualMarginNum), rounding)}
              categoryId={selectedCategory}
              onClose={() => setSaveOpen(false)}
            />
          )}
        </div>
      ) : (
        <MarginRulesTab />
      )}
    </div>
  );
}

function SaveProductSheet({ cost, margin, retail, categoryId, onClose }: { cost: number; margin: number; retail: number; categoryId: string | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ name: '', brand: '', size: '', unit: '', barcode: '', sku: '', location: '', supplier: '' });
  const create = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.invalidate();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div className="bg-surface-white w-full rounded-t-2xl p-6 space-y-4 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-2" />
        <h3 className="text-xl font-bold text-on-surface">Save Product</h3>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Product name" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand" className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          <input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="Size" className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit" className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
          <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Barcode" className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors font-mono" />
          <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU" className="h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
        </div>
        <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier" className="w-full h-14 px-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-on-surface placeholder:text-on-surface-secondary transition-colors" />
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface-cream rounded-[--radius-lg] p-3 text-center"><p className="text-xs text-on-surface-secondary">Cost</p><p className="font-bold text-on-surface">{formatJmd(cost)}</p></div>
          <div className="bg-surface-cream rounded-[--radius-lg] p-3 text-center"><p className="text-xs text-on-surface-secondary">Retail</p><p className="font-bold text-on-surface">{formatJmd(retail)}</p></div>
          <div className="bg-surface-cream rounded-[--radius-lg] p-3 text-center"><p className="text-xs text-on-surface-secondary">Margin</p><p className="font-bold text-on-surface">{margin.toFixed(1)}%</p></div>
        </div>
        <button
          onClick={() => create.mutate({
            name: form.name,
            brand: form.brand || undefined,
            size: form.size || undefined,
            unit: form.unit || undefined,
            barcode: form.barcode || undefined,
            sku: form.sku || undefined,
            categoryId: categoryId || undefined,
            costPrice: cost,
            retailPrice: retail,
            markupPercent: margin,
            useCustomMarkup: true,
            location: form.location || undefined,
            supplier: form.supplier || undefined,
          })}
          disabled={!form.name.trim() || cost <= 0 || retail <= 0 || create.isPending}
          className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all"
        >
          {create.isPending ? 'Saving...' : 'Save Product'}
        </button>
      </div>
    </div>
  );
}

function MarginRulesTab() {
  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const updateCategory = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.invalidate();
      setEditingId(null);
    },
  });

  return (
    <div className="px-5 space-y-3">
      {categories?.map((cat) => (
        <div key={cat.id} className="bg-surface-white rounded-[--radius-lg] p-4 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-bold text-on-surface">{cat.name}</h3>
            <p className="text-xs text-on-surface-secondary mt-0.5">{cat._count.products} products</p>
          </div>
          {editingId === cat.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-20 h-10 px-3 bg-surface border-2 border-primary rounded-lg text-center text-sm font-bold text-on-surface focus:outline-none"
                autoFocus
              />
              <span className="text-sm text-on-surface-secondary">%</span>
              <button
                onClick={() => updateCategory.mutate({ id: cat.id, defaultMarkupPercent: parseFloat(editValue) })}
                className="w-10 h-10 bg-brand text-on-brand rounded-lg flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingId(cat.id); setEditValue(String(Number(cat.defaultMarkupPercent))); }}
              className="flex items-center gap-2 px-4 py-2 bg-surface-cream rounded-lg"
            >
              <span className="text-lg font-bold text-on-surface">{Number(cat.defaultMarkupPercent)}%</span>
              <span className="material-symbols-outlined text-[16px] text-on-surface-secondary">edit</span>
            </button>
          )}
        </div>
      ))}
      {(!categories || categories.length === 0) && (
        <div className="text-center py-8 text-on-surface-secondary text-sm">
          No categories yet. Add them from the admin panel.
        </div>
      )}
    </div>
  );
}
