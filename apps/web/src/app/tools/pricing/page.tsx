'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

export default function PricingPage() {
  const [cost, setCost] = useState('');
  const [tab, setTab] = useState<'calculator' | 'rules'>('calculator');
  const { data: categories } = trpc.categories.list.useQuery();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: session } = useSession();
  const canEditRules = session?.user?.role === 'OWNER' || session?.user?.role === 'MANAGER' || session?.user?.role === 'SUPERVISOR';

  const costNum = parseFloat(cost) || 0;
  const margins = [20, 25, 30, 35, 40, 50];

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
          </div>

          {/* Results grid */}
          {costNum > 0 && (
            <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
              <h3 className="text-sm font-medium text-on-surface-secondary mb-3">Retail Price at Margin</h3>
              <div className="grid grid-cols-2 gap-3">
                {margins.map((m) => {
                  const retail = costNum * (1 + m / 100);
                  const isDefault = selectedCategoryMarkup && Number(selectedCategoryMarkup) === m;
                  return (
                    <div
                      key={m}
                      className={`p-4 rounded-[--radius-lg] text-center transition-all ${
                        isDefault
                          ? 'bg-brand/10 border-2 border-primary'
                          : 'bg-surface border-2 border-transparent'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isDefault ? 'text-brand' : 'text-on-surface-secondary'}`}>
                        {m}% markup
                      </span>
                      <p className={`text-xl font-bold mt-1 ${isDefault ? 'text-brand' : 'text-on-surface'}`}>
                        ${retail.toFixed(2)}
                      </p>
                      <p className="text-xs text-on-surface-secondary mt-0.5">
                        Profit: ${(retail - costNum).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {costNum <= 0 && (
            <EmptyState icon="calculate" title="Enter a cost price" description="See retail prices at different margins" />
          )}
        </div>
      ) : (
        <MarginRulesTab />
      )}
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
