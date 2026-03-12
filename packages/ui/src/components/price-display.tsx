'use client';

import { clsx } from 'clsx';

interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  costPrice?: number;
  showCost?: boolean;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriceDisplay({
  price,
  originalPrice,
  costPrice,
  showCost,
  unit,
  size = 'md',
  className,
}: PriceDisplayProps) {
  const isMarkdown = originalPrice !== undefined && originalPrice > price;
  const margin =
    showCost && costPrice ? ((price - costPrice) / price) * 100 : null;

  const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
  };

  return (
    <div className={clsx('inline-flex flex-col', className)}>
      <div className="flex items-baseline gap-2">
        {isMarkdown && (
          <span className="text-sm text-text-secondary line-through">
            ${originalPrice.toFixed(2)}
          </span>
        )}
        <span
          className={clsx(
            'font-heading font-bold',
            sizeClasses[size],
            isMarkdown ? 'text-danger' : 'text-text-primary'
          )}
        >
          ${price.toFixed(2)}
        </span>
        {unit && (
          <span className="text-xs text-text-secondary">/{unit}</span>
        )}
      </div>
      {showCost && costPrice !== undefined && costPrice !== null && (
        <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
          <span>Cost: ${costPrice.toFixed(2)}</span>
          {margin !== null && (
            <span
              className={clsx(
                'font-medium',
                margin >= 20
                  ? 'text-success'
                  : margin >= 10
                    ? 'text-warning'
                    : 'text-danger'
              )}
            >
              {margin.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
