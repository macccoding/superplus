'use client';

import { useState } from 'react';
import { AppShell } from '@superplus/ui';
import { SuggestionForm } from './components/suggestion-form';
import { SubmissionSuccess } from './components/submission-success';

type ViewState = 'form' | 'success';

export default function SuggestionBoxPage() {
  const [view, setView] = useState<ViewState>('form');

  function handleSuccess() {
    setView('success');
  }

  function handleSubmitAnother() {
    setView('form');
  }

  return (
    <AppShell title="Suggestion Box">
      {view === 'form' && <SuggestionForm onSuccess={handleSuccess} />}
      {view === 'success' && <SubmissionSuccess onSubmitAnother={handleSubmitAnother} />}
    </AppShell>
  );
}
