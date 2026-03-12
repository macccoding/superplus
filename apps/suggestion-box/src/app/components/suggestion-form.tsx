'use client';

import { useState } from 'react';
import { QuickAction } from '@superplus/ui';
import { useAuth, useSupabase } from '@superplus/auth';
import { createSuggestion } from '@superplus/db/queries/suggestions';
import { LIMITS, SUGGESTION_CATEGORIES } from '@superplus/config';
import type { SuggestionCategory } from '@superplus/config';

const MAX_CHARS = LIMITS.SUGGESTION_MAX_CHARS;

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  product_request: 'Product Request',
  improvement: 'Improvement',
  issue: 'Issue',
  other: 'Other',
};

interface SuggestionFormProps {
  onSuccess: () => void;
}

export function SuggestionForm({ onSuccess }: SuggestionFormProps) {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<SuggestionCategory>('improvement');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = message.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isValid = message.trim().length > 0 && !isOverLimit;

  async function handleSubmit() {
    if (!user || !isValid) return;

    setLoading(true);
    setError(null);

    try {
      await createSuggestion(supabase, {
        message: message.trim(),
        category,
        isAnonymous,
        userId: user.id,
      });
      onSuccess();
    } catch (err) {
      setError('Failed to submit suggestion. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Message textarea */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-text-primary mb-2">
          Your Suggestion
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What would you like to suggest?"
          rows={5}
          className="w-full px-4 py-3 bg-surface border border-gray-200 rounded-input text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
        />
        <div className="flex justify-end mt-1">
          <span
            className={`text-xs font-medium ${
              isOverLimit
                ? 'text-danger'
                : charCount > MAX_CHARS * 0.9
                  ? 'text-warning'
                  : 'text-text-secondary'
            }`}
          >
            {charCount}/{MAX_CHARS}
          </span>
        </div>
      </div>

      {/* Category selector pills */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {SUGGESTION_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                category === cat
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Anonymous toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">Submit Anonymously</p>
          <p className="text-xs text-text-secondary">
            Your name won&apos;t be shown to managers
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isAnonymous}
          onClick={() => setIsAnonymous(!isAnonymous)}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            isAnonymous ? 'bg-brand-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
              isAnonymous ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-card">
          {error}
        </div>
      )}

      <QuickAction
        label="Submit Suggestion"
        variant="primary"
        onClick={handleSubmit}
        loading={loading}
        disabled={loading || !isValid}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" x2="11" y1="2" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        }
      />
    </div>
  );
}
