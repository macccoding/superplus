'use client';

import { useState } from 'react';
import { AppShell } from '@superplus/ui';

type CalcMode = 'markup' | 'margin' | 'selling';

export default function CalculatorPage() {
  const [mode, setMode] = useState<CalcMode>('markup');
  const [costPrice, setCostPrice] = useState('');
  const [percentage, setPercentage] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  function calculate() {
    const cost = parseFloat(costPrice);
    const pct = parseFloat(percentage);
    const sell = parseFloat(sellingPrice);

    if (mode === 'markup') {
      // Given cost + markup %, find selling price
      if (!isNaN(cost) && !isNaN(pct)) {
        return {
          sellingPrice: cost * (1 + pct / 100),
          margin: (pct / (100 + pct)) * 100,
          profit: cost * (pct / 100),
        };
      }
    } else if (mode === 'margin') {
      // Given cost + margin %, find selling price
      if (!isNaN(cost) && !isNaN(pct)) {
        const sp = cost / (1 - pct / 100);
        return {
          sellingPrice: sp,
          markup: ((sp - cost) / cost) * 100,
          profit: sp - cost,
        };
      }
    } else if (mode === 'selling') {
      // Given cost + selling price, find markup & margin
      if (!isNaN(cost) && !isNaN(sell) && cost > 0) {
        return {
          markup: ((sell - cost) / cost) * 100,
          margin: ((sell - cost) / sell) * 100,
          profit: sell - cost,
        };
      }
    }
    return null;
  }

  const result = calculate();

  function handleClear() {
    setCostPrice('');
    setPercentage('');
    setSellingPrice('');
  }

  return (
    <AppShell title="Calculator" subtitle="Markup & Margin">
      {/* Mode selector */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-card mb-6">
        {([
          { key: 'markup', label: 'Markup %' },
          { key: 'margin', label: 'Margin %' },
          { key: 'selling', label: 'Price Check' },
        ] as { key: CalcMode; label: string }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setMode(tab.key);
              handleClear();
            }}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-button transition-colors ${
              mode === tab.key
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Cost Price ($)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-lg text-text-primary placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            autoFocus
          />
        </div>

        {mode !== 'selling' ? (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {mode === 'markup' ? 'Markup' : 'Margin'} (%)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-lg text-text-primary placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Selling Price ($)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-lg text-text-primary placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="bg-surface rounded-card border border-gray-100 p-5 space-y-4">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
            Results
          </h2>

          {mode === 'markup' && (
            <>
              <ResultRow
                label="Selling Price"
                value={`$${result.sellingPrice!.toFixed(2)}`}
                highlight
              />
              <ResultRow
                label="Margin"
                value={`${result.margin!.toFixed(1)}%`}
              />
              <ResultRow
                label="Profit per Unit"
                value={`$${result.profit!.toFixed(2)}`}
                variant={result.profit! > 0 ? 'success' : 'danger'}
              />
            </>
          )}

          {mode === 'margin' && (
            <>
              <ResultRow
                label="Selling Price"
                value={`$${result.sellingPrice!.toFixed(2)}`}
                highlight
              />
              <ResultRow
                label="Markup"
                value={`${result.markup!.toFixed(1)}%`}
              />
              <ResultRow
                label="Profit per Unit"
                value={`$${result.profit!.toFixed(2)}`}
                variant={result.profit! > 0 ? 'success' : 'danger'}
              />
            </>
          )}

          {mode === 'selling' && (
            <>
              <ResultRow
                label="Markup"
                value={`${result.markup!.toFixed(1)}%`}
                highlight
              />
              <ResultRow
                label="Margin"
                value={`${result.margin!.toFixed(1)}%`}
                variant={
                  result.margin! >= 20
                    ? 'success'
                    : result.margin! >= 10
                      ? 'warning'
                      : 'danger'
                }
              />
              <ResultRow
                label="Profit per Unit"
                value={`$${result.profit!.toFixed(2)}`}
                variant={result.profit! > 0 ? 'success' : 'danger'}
              />
            </>
          )}
        </div>
      )}

      {/* Quick reference */}
      <div className="mt-6 bg-surface rounded-card border border-gray-100 p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide mb-3">
          Quick Reference
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            { markup: '10%', margin: '9.1%' },
            { markup: '15%', margin: '13.0%' },
            { markup: '20%', margin: '16.7%' },
            { markup: '25%', margin: '20.0%' },
            { markup: '30%', margin: '23.1%' },
            { markup: '35%', margin: '25.9%' },
            { markup: '40%', margin: '28.6%' },
            { markup: '50%', margin: '33.3%' },
          ].map((row) => (
            <div
              key={row.markup}
              className="flex justify-between px-3 py-2 bg-gray-50 rounded-input"
            >
              <span className="text-text-secondary">MU {row.markup}</span>
              <span className="text-text-primary font-medium">MG {row.margin}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Clear button */}
      {(costPrice || percentage || sellingPrice) && (
        <button
          onClick={handleClear}
          className="w-full mt-4 py-3 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          Clear All
        </button>
      )}
    </AppShell>
  );
}

function ResultRow({
  label,
  value,
  highlight,
  variant,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  variant?: 'success' | 'warning' | 'danger';
}) {
  const valueColor = variant
    ? variant === 'success'
      ? 'text-success'
      : variant === 'warning'
        ? 'text-warning'
        : 'text-danger'
    : 'text-text-primary';

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <span
        className={`font-heading font-bold ${
          highlight ? 'text-2xl text-brand-primary' : `text-lg ${valueColor}`
        }`}
      >
        {value}
      </span>
    </div>
  );
}
