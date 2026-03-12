'use client';

import { useState } from 'react';
import { PriceDisplay } from '@superplus/ui';

interface PriceItem {
  id: string;
  productName: string;
  sellingPrice: number;
  costPrice: number | null;
  originalPrice?: number;
  isNewToday: boolean;
  isMarkdown: boolean;
  isLastDay: boolean;
}

interface PriceSectionProps {
  title: string;
  items: PriceItem[];
  showCost?: boolean;
}

export function PriceSection({ title, items, showCost }: PriceSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="print:break-inside-avoid">
      {/* Section Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between py-3 border-b-2 border-brand-primary print:border-black"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-heading font-bold text-text-primary">
            {title}
          </h2>
          <span className="text-xs bg-gray-100 text-text-secondary px-2 py-0.5 rounded-full print:bg-gray-200">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-secondary transition-transform print:hidden ${
            isCollapsed ? '' : 'rotate-180'
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Items List */}
      {!isCollapsed && (
        <div className="divide-y divide-gray-100">
          {items.length === 0 ? (
            <p className="py-4 text-sm text-text-secondary text-center">
              No items in this section today.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between py-3 px-2 ${
                  item.isNewToday
                    ? 'bg-success/5 border-l-4 border-success'
                    : item.isMarkdown
                      ? 'bg-warning/5 border-l-4 border-warning'
                      : item.isLastDay
                        ? 'bg-danger/5 border-l-4 border-danger'
                        : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {item.productName}
                    </p>
                    {item.isNewToday && (
                      <span className="text-[10px] font-bold bg-success text-white px-1.5 py-0.5 rounded-full uppercase print:bg-green-200 print:text-green-800">
                        New
                      </span>
                    )}
                    {item.isLastDay && (
                      <span className="text-[10px] font-bold bg-danger text-white px-1.5 py-0.5 rounded-full uppercase print:bg-red-200 print:text-red-800">
                        Last Day
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 ml-3">
                  <PriceDisplay
                    price={item.sellingPrice}
                    originalPrice={item.originalPrice}
                    costPrice={item.costPrice ?? undefined}
                    showCost={showCost}
                    size="sm"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
