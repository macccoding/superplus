'use client';

import { clsx } from 'clsx';

interface ProductCardProps {
  name: string;
  price: number;
  unit?: string;
  shelfLocation?: string | null;
  category?: string | null;
  costPrice?: number | null;
  showCost?: boolean;
  isMarkdown?: boolean;
  markdownPrice?: number;
  onClick?: () => void;
  className?: string;
}

export function ProductCard({
  name,
  price,
  unit = 'each',
  shelfLocation,
  category,
  costPrice,
  showCost,
  isMarkdown,
  markdownPrice,
  onClick,
  className,
}: ProductCardProps) {
  const displayPrice = isMarkdown && markdownPrice ? markdownPrice : price;
  const margin =
    showCost && costPrice ? ((displayPrice - costPrice) / displayPrice) * 100 : null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={clsx(
        'w-full text-left bg-surface rounded-card border border-gray-100 p-4 transition-shadow',
        onClick && 'hover:shadow-md active:shadow-sm cursor-pointer',
        !onClick && 'cursor-default',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-text-primary text-base leading-tight truncate">
            {name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {category && (
              <span className="text-xs text-text-secondary bg-gray-100 px-2 py-0.5 rounded-full">
                {category}
              </span>
            )}
            {shelfLocation && (
              <span className="text-xs text-text-secondary">
                {shelfLocation}
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          {isMarkdown && markdownPrice ? (
            <div>
              <span className="text-xs text-text-secondary line-through">
                ${price.toFixed(2)}
              </span>
              <div className="text-lg font-heading font-bold text-danger">
                ${markdownPrice.toFixed(2)}
              </div>
            </div>
          ) : (
            <div className="text-lg font-heading font-bold text-text-primary">
              ${displayPrice.toFixed(2)}
            </div>
          )}
          <span className="text-xs text-text-secondary">/{unit}</span>
        </div>
      </div>

      {/* Cost/Margin info for authorized users */}
      {showCost && costPrice !== null && costPrice !== undefined && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-4 text-xs text-text-secondary">
          <span>Cost: ${costPrice.toFixed(2)}</span>
          {margin !== null && (
            <span
              className={clsx(
                'font-medium',
                margin >= 20 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger'
              )}
            >
              {margin.toFixed(1)}% margin
            </span>
          )}
        </div>
      )}
    </button>
  );
}
