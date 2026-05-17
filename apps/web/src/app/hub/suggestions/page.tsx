'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { EmptyState } from '@superplus/ui';

const categories = ['GENERAL', 'SAFETY', 'SCHEDULE', 'EQUIPMENT', 'PROCESS', 'OTHER'] as const;

export default function SuggestionsPage() {
  const utils = trpc.useUtils();
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<typeof categories[number]>('GENERAL');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const { data: myList, isLoading } = trpc.suggestions.myList.useQuery();

  const submit = trpc.suggestions.submit.useMutation({
    onSuccess: () => { setBody(''); setSubmitted(true); utils.suggestions.invalidate(); setTimeout(() => setSubmitted(false), 3000); },
  });

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Suggestion Box</h2>
        <p className="text-sm text-on-surface-variant mt-1">Your voice matters</p>
      </section>

      {submitted && (
        <div className="mx-[--spacing-container] mb-4 bg-success/10 text-success rounded-xl p-4 flex items-center gap-2">
          <span className="material-symbols-outlined">check_circle</span>
          <span className="text-sm font-medium">Thank you! Your suggestion was submitted.</span>
        </div>
      )}

      <section className="px-[--spacing-container] mb-8">
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm space-y-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What would make this store better?"
            rows={4}
            className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-outline resize-none transition-colors"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${category === c ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                {c}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <button onClick={() => setIsAnonymous(!isAnonymous)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isAnonymous ? 'bg-primary border-primary' : 'border-outline-variant'}`}>
              {isAnonymous && <span className="material-symbols-outlined text-on-primary text-[16px]">check</span>}
            </button>
            <span className="text-sm font-medium text-on-surface">Submit anonymously</span>
          </label>
          <button
            onClick={() => submit.mutate({ body, category, isAnonymous })}
            disabled={!body.trim() || submit.isPending}
            className="w-full h-14 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 shadow-md"
          >
            <span className="material-symbols-outlined">send</span>
            Submit Suggestion
          </button>
        </div>
      </section>

      <section className="px-[--spacing-container] pb-24">
        <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wide mb-3">My Suggestions</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span></div>
        ) : myList && myList.length > 0 ? (
          <div className="space-y-3">
            {myList.map((s: any) => (
              <div key={s.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
                <p className="text-sm text-on-surface">{s.body}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.status === 'IMPLEMENTED' ? 'bg-success/10 text-success' : s.status === 'REVIEWED' ? 'bg-secondary/10 text-secondary' : s.status === 'DISMISSED' ? 'bg-outline/10 text-outline' : 'bg-tertiary-container/30 text-on-tertiary-container'}`}>
                    {s.status}
                  </span>
                  <span className="text-xs text-outline">{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
                {s.response && (
                  <div className="mt-3 bg-secondary/5 rounded-lg p-3">
                    <p className="text-xs font-bold text-secondary mb-1">Response</p>
                    <p className="text-sm text-on-surface">{s.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="lightbulb" title="No suggestions yet" description="Your suggestions will appear here" />
        )}
      </section>
    </div>
  );
}
