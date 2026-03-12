'use client';

import { useState, useMemo } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  accessor?: (item: T) => string | number | null | undefined;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  pageSize?: number;
  emptyMessage?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc';

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  pageSize = 15,
  emptyMessage = 'No data found',
  className = '',
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  function handleSort(columnKey: string) {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  }

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    const column = columns.find((c) => c.key === sortColumn);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const aVal = column.accessor ? column.accessor(a) : (a as Record<string, any>)[sortColumn];
      const bVal = column.accessor ? column.accessor(b) : (b as Record<string, any>)[sortColumn];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = Number(aVal) - Number(bVal);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = sortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3 ${
                    col.sortable ? 'cursor-pointer hover:text-text-primary select-none' : ''
                  } ${col.className ?? ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortColumn === col.key && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
                      >
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={`${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                } transition-colors`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm ${col.className ?? ''}`}>
                    {col.render
                      ? col.render(item)
                      : String((item as Record<string, any>)[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {paginatedData.map((item) => (
          <div
            key={keyExtractor(item)}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            className={`bg-surface border border-gray-100 rounded-card p-4 ${
              onRowClick ? 'cursor-pointer active:bg-gray-50' : ''
            }`}
          >
            {columns.map((col) => (
              <div key={col.key} className="flex items-center justify-between py-1">
                <span className="text-xs text-text-secondary font-medium">{col.header}</span>
                <span className="text-sm text-text-primary text-right">
                  {col.render
                    ? col.render(item)
                    : String((item as Record<string, any>)[col.key] ?? '-')}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-xs text-text-secondary">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-button border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 text-sm text-text-secondary">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-button border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
