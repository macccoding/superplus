'use client';

import { useState } from 'react';
import { PhotoCapture, StatusBadge } from '@superplus/ui';
import type { ChecklistItem } from '@superplus/db';

interface ChecklistItemRendererProps {
  item: ChecklistItem;
  onComplete: (value?: string) => void;
  loading: boolean;
}

export function ChecklistItemRenderer({ item, onComplete, loading }: ChecklistItemRendererProps) {
  const [numericValue, setNumericValue] = useState('');
  const [cashValue, setCashValue] = useState('');

  // Determine item_type from task_text patterns. The checklist_items table doesn't have
  // item_type directly, but the template it came from does. We parse from task_text conventions:
  // Templates with numeric ranges use "[numeric]", cash uses "[cash]", photo uses "[photo]"
  const itemType = getItemType(item.task_text);
  const cleanTaskText = item.task_text
    .replace(/\[(checkbox|numeric|cash|photo)\]/i, '')
    .trim();

  if (item.is_completed) {
    return (
      <div className="bg-success/5 border border-success/20 rounded-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">{cleanTaskText}</p>
            {item.value_entered && (
              <p className="text-xs text-text-secondary mt-0.5">Value: {item.value_entered}</p>
            )}
            {item.completed_at && (
              <p className="text-xs text-text-secondary mt-0.5">
                Completed at {new Date(item.completed_at).toLocaleTimeString()}
              </p>
            )}
          </div>
          {item.is_critical && <StatusBadge label="Critical" variant="danger" size="sm" />}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface border rounded-card p-4 space-y-4 ${item.is_critical ? 'border-danger/40 ring-1 ring-danger/20' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.is_critical ? 'bg-danger/10' : 'bg-gray-100'}`}>
          <span className={`text-sm font-bold ${item.is_critical ? 'text-danger' : 'text-text-secondary'}`}>
            {item.sort_order}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-base font-medium text-text-primary">{cleanTaskText}</p>
          {item.is_critical && (
            <StatusBadge label="Critical Item" variant="danger" size="sm" className="mt-1" dot />
          )}
        </div>
      </div>

      {/* Render input based on type */}
      {itemType === 'checkbox' && (
        <button
          onClick={() => onComplete()}
          disabled={loading}
          className="w-full py-3 px-4 bg-brand-primary text-white font-medium rounded-button hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Mark Complete'}
        </button>
      )}

      {itemType === 'numeric' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Enter value</label>
            <input
              type="number"
              inputMode="decimal"
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              placeholder="Enter reading..."
              className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary text-lg font-mono placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>
          <button
            onClick={() => onComplete(numericValue)}
            disabled={loading || !numericValue}
            className="w-full py-3 px-4 bg-brand-primary text-white font-medium rounded-button hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Submit Reading'}
          </button>
        </div>
      )}

      {itemType === 'cash' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Cash amount ($)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-lg">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={cashValue}
                onChange={(e) => setCashValue(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary text-lg font-mono placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              />
            </div>
          </div>
          <button
            onClick={() => onComplete(cashValue)}
            disabled={loading || !cashValue}
            className="w-full py-3 px-4 bg-brand-primary text-white font-medium rounded-button hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Submit Amount'}
          </button>
        </div>
      )}

      {itemType === 'photo' && (
        <div className="space-y-3">
          <PhotoCapture
            onCapture={(file) => {
              // In production, upload file and get URL. For now, use filename as value.
              onComplete(file.name);
            }}
            label="Take Photo"
          />
        </div>
      )}
    </div>
  );
}

function getItemType(taskText: string): 'checkbox' | 'numeric' | 'cash' | 'photo' {
  const lower = taskText.toLowerCase();
  if (lower.includes('[numeric]')) return 'numeric';
  if (lower.includes('[cash]')) return 'cash';
  if (lower.includes('[photo]')) return 'photo';
  // Heuristic: if task mentions temperature or reading, treat as numeric
  if (lower.includes('temperature') || lower.includes('temp ') || lower.includes('reading')) return 'numeric';
  // Heuristic: if task mentions cash or register or drawer, treat as cash
  if (lower.includes('cash') || lower.includes('register') || lower.includes('drawer')) return 'cash';
  return 'checkbox';
}
