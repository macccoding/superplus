'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onScanClick?: () => void;
  autoFocus?: boolean;
  debounceMs?: number;
  className?: string;
  value?: string;
}

export function SearchBar({
  placeholder = 'Search products...',
  onSearch,
  onScanClick,
  autoFocus = true,
  debounceMs = 300,
  className,
  value: controlledValue,
}: SearchBarProps) {
  const [value, setValue] = useState(controlledValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (controlledValue !== undefined) {
      setValue(controlledValue);
    }
  }, [controlledValue]);

  const debouncedSearch = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(query);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedSearch(newValue);
  }

  function handleClear() {
    setValue('');
    onSearch('');
    inputRef.current?.focus();
  }

  return (
    <div className={clsx('relative', className)}>
      <div className="relative flex items-center">
        {/* Search icon */}
        <svg
          className="absolute left-3 text-text-secondary pointer-events-none"
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
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-10 pr-20 py-3 bg-surface border border-gray-200 rounded-input text-text-primary text-base placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-colors"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {/* Clear button */}
          {value && (
            <button
              onClick={handleClear}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Clear search"
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
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}

          {/* Barcode scan button */}
          {onScanClick && (
            <button
              onClick={onScanClick}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors text-brand-secondary"
              aria-label="Scan barcode"
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
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <path d="M7 12h10" />
                <path d="M7 8h2" />
                <path d="M7 16h2" />
                <path d="M15 8h2" />
                <path d="M15 16h2" />
                <path d="M11 8h2" />
                <path d="M11 16h2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
