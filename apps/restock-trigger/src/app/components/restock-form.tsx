'use client';

import { useState, useCallback } from 'react';
import { ProductCard, QuickAction, NotificationBanner } from '@superplus/ui';
import { useActiveStaff } from '@superplus/db/hooks';
import { useSupabase } from '@superplus/auth';
import { createRestockRequest } from '@superplus/db/queries/stock-events';
import type { Product } from '@superplus/db';

interface RestockFormProps {
  product: Product;
  userId: string;
  onSubmitted: () => void;
}

export function RestockForm({ product, userId, onSubmitted }: RestockFormProps) {
  const supabase = useSupabase();
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [assignedTo, setAssignedTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: staff } = useActiveStaff();

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await createRestockRequest(supabase, {
        productId: product.id,
        reportedByUserId: userId,
        assignedTo: assignedTo || undefined,
        priority,
      });
      setSuccess(true);
      setTimeout(() => {
        onSubmitted();
      }, 1500);
    } catch (err) {
      console.error('Failed to create restock request:', err);
    } finally {
      setSubmitting(false);
    }
  }, [product.id, userId, assignedTo, priority, onSubmitted]);

  if (success) {
    return (
      <NotificationBanner
        type="success"
        message={`Restock request flagged for ${product.name}`}
        autoDismissMs={2000}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ProductCard
        name={product.name}
        price={product.selling_price}
        shelfLocation={product.shelf_location}
        unit={product.unit_of_measure}
      />

      {/* Priority toggle */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Priority</label>
        <div className="flex gap-2">
          <button
            onClick={() => setPriority('normal')}
            className={`flex-1 py-3 px-4 rounded-button text-sm font-medium border transition-colors ${
              priority === 'normal'
                ? 'bg-brand-primary text-white border-brand-primary'
                : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setPriority('urgent')}
            className={`flex-1 py-3 px-4 rounded-button text-sm font-medium border transition-colors ${
              priority === 'urgent'
                ? 'bg-danger text-white border-danger'
                : 'bg-surface text-text-secondary border-gray-200 hover:border-gray-300'
            }`}
          >
            Urgent (Customer-facing empty)
          </button>
        </div>
      </div>

      {/* Staff assignment */}
      <div>
        <label htmlFor="assignee" className="block text-sm font-medium text-text-primary mb-2">
          Assign to (optional)
        </label>
        <select
          id="assignee"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
        >
          <option value="">Unassigned</option>
          {staff?.map((member) => (
            <option key={member.id} value={member.user_id}>
              {member.full_name}
            </option>
          ))}
        </select>
      </div>

      <QuickAction
        label="Flag for Restock"
        variant={priority === 'urgent' ? 'danger' : 'primary'}
        loading={submitting}
        onClick={handleSubmit}
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        }
      />
    </div>
  );
}
