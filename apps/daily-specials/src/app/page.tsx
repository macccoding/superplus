'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell, LoadingState, EmptyState } from '@superplus/ui';
import { useCanViewCost, useSupabase } from '@superplus/auth';
import { getTodayPrices } from '@superplus/db/queries/daily-prices';
import { getActiveMarkdowns } from '@superplus/db/queries/markdowns';
import { getCategories } from '@superplus/db/queries/categories';
import { useRealtimeDailyPrices } from '@superplus/db/realtime';
import type { DailyPrice, Markdown, Category } from '@superplus/db';
import { PriceSection } from './components/price-section';

interface DailyPriceWithProduct extends DailyPrice {
  product: { name: string; category_id: string | null; shelf_location: string | null } | null;
}

interface MarkdownWithProduct extends Markdown {
  product: { name: string } | null;
}

export default function DailySpecialsPage() {
  const supabase = useSupabase();
  const canViewCost = useCanViewCost();
  const [prices, setPrices] = useState<DailyPriceWithProduct[]>([]);
  const [markdowns, setMarkdowns] = useState<MarkdownWithProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [pricesData, markdownsData, categoriesData] = await Promise.all([
        getTodayPrices(supabase),
        getActiveMarkdowns(supabase),
        getCategories(supabase),
      ]);
      setPrices(pricesData);
      setMarkdowns(markdownsData);
      setCategories(categoriesData);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh when daily_prices change via realtime
  useRealtimeDailyPrices(() => {
    fetchData();
  });

  // Build category map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Group prices into sections
  const sections = useMemo(() => {
    const produceItems: DailyPriceWithProduct[] = [];
    const bakeryItems: DailyPriceWithProduct[] = [];
    const promotionItems: DailyPriceWithProduct[] = [];

    prices.forEach((price) => {
      const catName = price.product?.category_id
        ? categoryMap.get(price.product.category_id)?.toLowerCase() ?? ''
        : '';

      if (catName.includes('produce') || catName.includes('fruit') || catName.includes('vegetable')) {
        produceItems.push(price);
      } else if (catName.includes('bakery') || catName.includes('bread') || catName.includes('pastry')) {
        bakeryItems.push(price);
      } else {
        promotionItems.push(price);
      }
    });

    const todayDate = new Date().toISOString().split('T')[0];

    function mapPriceItem(price: DailyPriceWithProduct) {
      const createdDate = price.created_at.split('T')[0];
      return {
        id: price.id,
        productName: price.product?.name ?? 'Unknown',
        sellingPrice: price.selling_price,
        costPrice: price.cost_price,
        isNewToday: createdDate === todayDate,
        isMarkdown: false,
        isLastDay: false,
      };
    }

    function mapMarkdownItem(md: MarkdownWithProduct) {
      const effectiveUntil = md.effective_until;
      const isLastDay = effectiveUntil
        ? effectiveUntil.split('T')[0] === todayDate
        : false;

      return {
        id: md.id,
        productName: md.product?.name ?? 'Unknown',
        sellingPrice: md.markdown_price,
        costPrice: null,
        originalPrice: md.original_price,
        isNewToday: md.created_at.split('T')[0] === todayDate,
        isMarkdown: true,
        isLastDay,
      };
    }

    return {
      produce: produceItems.map(mapPriceItem),
      bakery: bakeryItems.map(mapPriceItem),
      promotions: promotionItems.map(mapPriceItem),
      markdowns: markdowns.map(mapMarkdownItem),
    };
  }, [prices, markdowns, categoryMap]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <AppShell title="Daily Specials">
        <LoadingState message="Loading today's prices..." />
      </AppShell>
    );
  }

  const totalItems =
    sections.produce.length +
    sections.bakery.length +
    sections.promotions.length +
    sections.markdowns.length;

  return (
    <AppShell
      title="Daily Specials"
      headerRight={
        <button
          onClick={handlePrint}
          className="flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors print:hidden"
          aria-label="Print"
        >
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
          >
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect width="12" height="8" x="6" y="14" />
          </svg>
          <span className="hidden sm:inline">Print</span>
        </button>
      }
    >
      <style jsx global>{`
        @media print {
          header { display: none !important; }
          main { padding: 0 !important; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* Date header */}
      <div className="mb-6 print:mb-4">
        <h2 className="text-lg font-heading font-bold text-text-primary print:text-2xl print:text-center">
          Daily Specials
        </h2>
        <p className="text-sm text-text-secondary print:text-center">{today}</p>
      </div>

      {totalItems === 0 ? (
        <EmptyState
          title="No specials today"
          description="There are no daily prices or active markdowns set for today."
        />
      ) : (
        <div className="space-y-6">
          {sections.produce.length > 0 && (
            <PriceSection
              title="Produce"
              items={sections.produce}
              showCost={canViewCost}
            />
          )}

          {sections.bakery.length > 0 && (
            <PriceSection
              title="Bakery"
              items={sections.bakery}
              showCost={canViewCost}
            />
          )}

          {sections.promotions.length > 0 && (
            <PriceSection
              title="Promotions"
              items={sections.promotions}
              showCost={canViewCost}
            />
          )}

          {sections.markdowns.length > 0 && (
            <PriceSection
              title="Markdowns"
              items={sections.markdowns}
              showCost={canViewCost}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
