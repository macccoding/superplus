'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';

const statusLabels: Record<string, string> = { NEW: 'New', REVIEWED: 'Reviewed', IMPLEMENTED: 'Implemented', DISMISSED: 'Dismissed' };

export default function AdminSuggestionsPage() {
  const utils = trpc.useUtils();
  const { data: suggestions } = trpc.suggestions.listAll.useQuery();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<string>('REVIEWED');

  const respond = trpc.suggestions.respond.useMutation({
    onSuccess: () => { utils.suggestions.invalidate(); setRespondingId(null); setResponse(''); },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-on-surface">Suggestions</h1>
        <p className="text-on-surface-secondary mt-1">{suggestions?.length || 0} total</p>
      </div>

      <div className="space-y-3">
        {suggestions?.map((s: any) => (
          <div key={s.id} className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-on-surface leading-relaxed">{s.body}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.status === 'IMPLEMENTED' ? 'bg-success/10 text-success' : s.status === 'REVIEWED' ? 'bg-navy/10 text-navy' : s.status === 'DISMISSED' ? 'bg-outline/10 text-on-surface-secondary' : 'bg-warning/20/30 text-warning'}`}>
                    {statusLabels[s.status] || s.status}
                  </span>
                  <span className="text-xs text-on-surface-secondary">{s.category}</span>
                  <span className="text-xs text-on-surface-secondary">·</span>
                  <span className="text-xs text-on-surface-secondary">{s.author?.fullName || 'Anonymous'}</span>
                  <span className="text-xs text-on-surface-secondary">·</span>
                  <span className="text-xs text-on-surface-secondary">{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {s.status === 'NEW' && (
                <button onClick={() => { setRespondingId(s.id); setResponse(''); setStatus('REVIEWED'); }} className="text-sm font-medium text-brand px-3 py-1 rounded-lg hover:bg-brand/5">
                  Respond
                </button>
              )}
            </div>
            {s.response && (
              <div className="mt-3 bg-navy/5 rounded-lg p-3">
                <p className="text-xs font-bold text-navy mb-1">Response by {s.respondedBy?.fullName}</p>
                <p className="text-sm text-on-surface">{s.response}</p>
              </div>
            )}
            {respondingId === s.id && (
              <div className="mt-4 space-y-3 border-t border-outline/20 pt-4">
                <textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write a response..." rows={2} className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors" />
                <div className="flex gap-2">
                  {['REVIEWED', 'IMPLEMENTED', 'DISMISSED'].map((st) => (
                    <button key={st} onClick={() => setStatus(st)} className={`px-3 py-2 rounded-[--radius-lg] text-xs font-bold ${status === st ? 'bg-brand text-on-brand' : 'bg-surface-cream text-on-surface-secondary'}`}>
                      {statusLabels[st]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setRespondingId(null)} className="flex-1 h-12 border-2 border-outline rounded-[--radius-lg] text-on-surface-secondary font-bold">Cancel</button>
                  <button onClick={() => respond.mutate({ id: s.id, response, status: status as any })} disabled={!response.trim()} className="flex-1 h-12 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40">Send</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
