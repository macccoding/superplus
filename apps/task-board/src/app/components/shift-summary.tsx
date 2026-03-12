'use client';

interface ShiftSummaryProps {
  completed: number;
  total: number;
}

export function ShiftSummary({ completed, total }: ShiftSummaryProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface border-t border-gray-200 px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">
          {completed} of {total} tasks completed
        </span>
        <span className="text-sm font-bold text-brand-primary">
          {total > 0 ? Math.round(percentage) : 0}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            percentage === 100
              ? 'bg-success'
              : percentage >= 50
              ? 'bg-brand-primary'
              : 'bg-warning'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
