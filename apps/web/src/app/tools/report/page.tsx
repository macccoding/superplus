'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

const reportCategories = [
  { value: 'SAFETY', label: 'Safety', icon: 'health_and_safety' },
  { value: 'EQUIPMENT', label: 'Equipment', icon: 'construction' },
  { value: 'PROCESS', label: 'Process', icon: 'rule_settings' },
  { value: 'OTHER', label: 'Other', icon: 'more_horiz' },
] as const;
const quickPrompts = [
  { label: 'Unsafe area', category: 'SAFETY', text: 'Unsafe area: ' },
  { label: 'Broken item', category: 'EQUIPMENT', text: 'Equipment or fixture broken: ' },
  { label: 'Staff concern', category: 'OTHER', text: 'Staff concern: ' },
  { label: 'Process problem', category: 'PROCESS', text: 'Process problem: ' },
] as const;

export default function AnonymousReportPage() {
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<(typeof reportCategories)[number]['value']>('SAFETY');
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = trpc.suggestions.submit.useMutation({
    onSuccess: () => {
      setBody('');
      setCategory('SAFETY');
      setIsUrgent(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    },
  });

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Report</h2>
        <p className="text-sm text-on-surface-secondary mt-1">Send a private note to management</p>
      </section>

      {submitted && (
        <div className="mx-[--spacing-container] mb-4 bg-success/10 text-success rounded-[--radius-lg] p-4 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-sm font-bold">Report sent anonymously.</span>
        </div>
      )}

      {submit.error && (
        <div className="mx-[--spacing-container] mb-4 bg-error/10 text-error rounded-[--radius-lg] p-4 flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          <span className="text-sm font-bold">{submit.error.message}</span>
        </div>
      )}

      <section className="px-5 pb-24">
        <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-4">
          <div className="bg-navy/5 rounded-[--radius-lg] p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-navy text-[22px]">lock</span>
            <p className="text-sm font-medium text-on-surface-secondary">
              Your name is not attached. Managers will see the report and the store only.
            </p>
          </div>

          <div>
            <p className="block text-xs font-bold text-on-surface-secondary mb-2">Quick start</p>
            <div className="grid grid-cols-2 gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => {
                    setCategory(prompt.category);
                    setBody((current) => current || prompt.text);
                  }}
                  className="min-h-12 rounded-lg bg-surface-cream px-3 text-sm font-bold text-on-surface-secondary active:scale-95 transition-all"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {reportCategories.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCategory(item.value)}
                className={`min-h-20 rounded-[--radius-lg] border-2 p-3 flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all ${
                  category === item.value
                    ? 'border-primary bg-brand/10 text-brand'
                    : 'border-transparent bg-surface-cream text-on-surface-secondary'
                }`}
              >
                <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
                <span className="text-sm font-bold">{item.label}</span>
              </button>
            ))}
          </div>

          <label className="flex items-center justify-between gap-3 rounded-[--radius-lg] bg-warning/10 p-4">
            <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-warning text-[22px]">priority_high</span>
              Needs quick attention
            </span>
            <button
              type="button"
              aria-pressed={isUrgent}
              onClick={() => setIsUrgent(!isUrgent)}
              className={`h-8 w-14 rounded-full p-1 transition-all ${isUrgent ? 'bg-brand' : 'bg-outline/40'}`}
            >
              <span className={`block h-6 w-6 rounded-full bg-white transition-transform ${isUrgent ? 'translate-x-6' : ''}`} />
            </button>
          </label>

          <div>
            <label htmlFor="anonymous-report" className="block text-xs font-bold text-on-surface-secondary mb-2">
              Report details
            </label>
          <textarea
            id="anonymous-report"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What should management know?"
            rows={6}
            className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors"
          />
            <div className="mt-1 flex items-center justify-between text-xs text-on-surface-secondary">
              <span>Be specific so management can act.</span>
              <span>{body.length}/2000</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => submit.mutate({ body: `${isUrgent ? 'URGENT - ' : ''}${body.trim()}`, category, isAnonymous: true })}
            disabled={!body.trim() || submit.isPending}
            className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 shadow-md"
          >
            <span className="material-symbols-outlined">{submit.isPending ? 'progress_activity' : 'send'}</span>
            {submit.isPending ? 'Sending...' : 'Send Report'}
          </button>
        </div>
      </section>
    </div>
  );
}
