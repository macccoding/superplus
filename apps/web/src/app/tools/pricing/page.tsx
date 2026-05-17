'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/lib/trpc-client';

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
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Pricing</h2>
        <p className="text-sm text-on-surface-variant mt-1">Calculate margins and retail prices</p>
      </section>

      {/* Tabs */}
      {canEditRules && (
        <div className="px-[--spacing-container] mb-4">
          <div className="flex bg-surface-container-high rounded-xl p-1">
            <button
              onClick={() => setTab('calculator')}
              className={`flex-1 py-2.5 text-center rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === 'calculator' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              Calculator
            </button>
            <button
              onClick={() => setTab('rules')}
              className={`flex-1 py-2.5 text-center rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === 'rules' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              Margin Rules
            </button>
          </div>
        </div>
      )}

      {tab === 'calculator' ? (
        <div className="px-[--spacing-container] space-y-4">
          {/* Cost input */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
            <label className="block text-sm font-medium text-on-surface mb-2">Cost Price (JMD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg font-bold">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                className="w-full h-16 pl-10 pr-4 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-2xl font-bold text-on-surface placeholder:text-outline transition-colors"
                autoFocus
              />
            </div>

            {/* Category selector */}
            {categories && categories.length > 0 && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-on-surface-variant mb-2">Category (optional — highlights default margin)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !selectedCategory ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    None
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedCategory === cat.id ? 'bg-secondary text-on-secondary' : 'bg-surface-container-high text-on-surface-variant'
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
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-medium text-on-surface-variant mb-3">Retail Price at Margin</h3>
              <div className="grid grid-cols-2 gap-3">
                {margins.map((m) => {
                  const retail = costNum * (1 + m / 100);
                  const isDefault = selectedCategoryMarkup && Number(selectedCategoryMarkup) === m;
                  return (
                    <div
                      key={m}
                      className={`p-4 rounded-xl text-center transition-all ${
                        isDefault
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-surface-container-low border-2 border-transparent'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isDefault ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {m}% markup
                      </span>
                      <p className={`text-xl font-bold mt-1 ${isDefault ? 'text-primary' : 'text-on-surface'}`}>
                        ${retail.toFixed(2)}
                      </p>
                      <p className="text-xs text-outline mt-0.5">
                        Profit: ${(retail - costNum).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {costNum <= 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-outline mb-3">calculate</span>
              <p className="text-on-surface-variant">Enter a cost price to see margins</p>
            </div>
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
    <div className="px-[--spacing-container] space-y-3">
      {categories?.map((cat) => (
        <div key={cat.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="font-bold text-on-surface">{cat.name}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{cat._count.products} products</p>
          </div>
          {editingId === cat.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-20 h-10 px-3 bg-surface-container-low border-2 border-primary rounded-lg text-center text-sm font-bold text-on-surface focus:outline-none"
                autoFocus
              />
              <span className="text-sm text-on-surface-variant">%</span>
              <button
                onClick={() => updateCategory.mutate({ id: cat.id, defaultMarkupPercent: parseFloat(editValue) })}
                className="w-10 h-10 bg-primary text-on-primary rounded-lg flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingId(cat.id); setEditValue(String(Number(cat.defaultMarkupPercent))); }}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-lg"
            >
              <span className="text-lg font-bold text-on-surface">{Number(cat.defaultMarkupPercent)}%</span>
              <span className="material-symbols-outlined text-[16px] text-outline">edit</span>
            </button>
          )}
        </div>
      ))}
      {(!categories || categories.length === 0) && (
        <div className="text-center py-8 text-on-surface-variant text-sm">
          No categories yet. Add them from the admin panel.
        </div>
      )}
    </div>
  );
}
