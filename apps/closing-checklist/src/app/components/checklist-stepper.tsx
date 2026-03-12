'use client';

import { useState, useMemo, useCallback } from 'react';
import { QuickAction, NotificationBanner } from '@superplus/ui';
import { useSupabase } from '@superplus/auth';
import { updateChecklistItem, completeChecklist } from '@superplus/db/queries/checklists';
import type { Checklist, ChecklistItem } from '@superplus/db';
import { LIMITS } from '@superplus/config';
import { ChecklistItemRenderer } from './checklist-item';
import { CriticalAlert } from './critical-alert';

interface ChecklistStepperProps {
  checklist: Checklist & { items: ChecklistItem[] };
  onComplete: () => void;
}

export function ChecklistStepper({ checklist, onComplete }: ChecklistStepperProps) {
  const supabase = useSupabase();
  const [items, setItems] = useState<ChecklistItem[]>(
    [...checklist.items].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [currentIndex, setCurrentIndex] = useState(() => {
    const firstIncomplete = items.findIndex((item) => !item.is_completed);
    return firstIncomplete >= 0 ? firstIncomplete : 0;
  });
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const completedCount = useMemo(() => items.filter((i) => i.is_completed).length, [items]);
  const totalCount = items.length;
  const isLastItem = currentIndex === totalCount - 1;
  const allComplete = completedCount === totalCount;
  const currentItem = items[currentIndex];

  const handleItemComplete = useCallback(
    async (value?: string) => {
      if (!currentItem) return;
      setSubmitting(true);

      try {
        const now = new Date().toISOString();

        const updated = await updateChecklistItem(supabase, currentItem.id, {
          isCompleted: true,
          valueEntered: value,
          completedAt: now,
        });

        // Check for critical out-of-range values
        if (currentItem.is_critical && value) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue > LIMITS.COOLER_TEMP_MAX_F) {
            setCriticalAlert(
              `Critical: Temperature reading is ${numValue}F, above safe range (${LIMITS.COOLER_TEMP_MAX_F}F). This has been flagged to management.`
            );
          }
        }

        setItems((prev) =>
          prev.map((item) => (item.id === currentItem.id ? updated : item))
        );

        // Auto-advance to next item if not the last
        if (!isLastItem) {
          setCurrentIndex((prev) => prev + 1);
        }
      } catch (err) {
        console.error('Failed to update item:', err);
      } finally {
        setSubmitting(false);
      }
    },
    [currentItem, isLastItem]
  );

  const handleCompleteChecklist = useCallback(async () => {
    setCompleting(true);
    try {
      await completeChecklist(supabase, checklist.id);
      setSuccessMessage('Checklist completed successfully!');
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      console.error('Failed to complete checklist:', err);
    } finally {
      setCompleting(false);
    }
  }, [checklist.id, onComplete]);

  const handleGoToItem = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">
            {checklist.checklist_type === 'opening' ? 'Opening' : 'Closing'} Checklist
          </span>
          <span className="text-text-secondary">
            {completedCount}/{totalCount} completed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-brand-primary h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Item navigation dots */}
      <div className="flex gap-1 flex-wrap">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => handleGoToItem(index)}
            className={`w-8 h-8 rounded-full text-xs font-medium transition-all flex items-center justify-center ${
              index === currentIndex
                ? 'bg-brand-primary text-white ring-2 ring-brand-primary/30'
                : item.is_completed
                ? 'bg-success/20 text-success'
                : item.is_critical
                ? 'bg-danger/10 text-danger border border-danger/30'
                : 'bg-gray-100 text-text-secondary'
            }`}
            aria-label={`Go to item ${index + 1}`}
          >
            {item.is_completed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              index + 1
            )}
          </button>
        ))}
      </div>

      {/* Current item */}
      {currentItem && (
        <ChecklistItemRenderer
          item={currentItem}
          onComplete={handleItemComplete}
          loading={submitting}
        />
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3">
        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            className="flex-1 py-3 px-4 bg-gray-100 text-text-primary font-medium rounded-button hover:bg-gray-200 transition-colors"
          >
            Previous
          </button>
        )}
        {!isLastItem && currentItem?.is_completed && (
          <button
            onClick={() => setCurrentIndex((prev) => prev + 1)}
            className="flex-1 py-3 px-4 bg-brand-primary text-white font-medium rounded-button hover:bg-brand-primary/90 transition-colors"
          >
            Next
          </button>
        )}
      </div>

      {/* Complete checklist button */}
      {allComplete && (
        <QuickAction
          label="Complete Checklist"
          variant="success"
          loading={completing}
          onClick={handleCompleteChecklist}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />
      )}

      {/* Success banner */}
      {successMessage && (
        <NotificationBanner
          type="success"
          message={successMessage}
          autoDismissMs={3000}
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      {/* Critical alert modal */}
      {criticalAlert && (
        <CriticalAlert
          message={criticalAlert}
          onDismiss={() => setCriticalAlert(null)}
        />
      )}
    </div>
  );
}
