'use client';

import { useState } from 'react';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
} from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

interface Preset {
  label: string;
  getRange: () => DateRange;
}

const presets: Preset[] = [
  {
    label: 'Today',
    getRange: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    },
  },
  {
    label: 'This Week',
    getRange: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Last Week',
    getRange: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 }),
      };
    },
  },
  {
    label: 'This Month',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: 'Last Month',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
  },
];

export function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  function handlePreset(preset: Preset) {
    onChange(preset.getRange());
    setIsOpen(false);
  }

  function handleFromChange(dateStr: string) {
    if (!dateStr) return;
    const from = startOfDay(new Date(dateStr + 'T00:00:00'));
    onChange({ ...value, from });
  }

  function handleToChange(dateStr: string) {
    if (!dateStr) return;
    const to = endOfDay(new Date(dateStr + 'T00:00:00'));
    onChange({ ...value, to });
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-surface border border-gray-200 rounded-button text-sm text-text-primary hover:border-gray-300 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-secondary"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>
          {format(value.from, 'MMM d, yyyy')} - {format(value.to, 'MMM d, yyyy')}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 bg-surface border border-gray-200 rounded-card shadow-lg z-50 p-4 min-w-[320px]">
            {/* Presets */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePreset(preset)}
                  className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-gray-200 rounded-button hover:bg-gray-50 hover:text-text-primary transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom range */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-text-secondary mb-2">Custom Range</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={format(value.from, 'yyyy-MM-dd')}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
                <span className="text-xs text-text-secondary">to</span>
                <input
                  type="date"
                  value={format(value.to, 'yyyy-MM-dd')}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-input focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
