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
        <h1 className="text-3xl font-black text-on-surface">Suggestions</h1>
        <p className="text-on-surface-variant mt-1">{suggestions?.length || 0} total</p>
      </div>

      <div className="space-y-3">
        {suggestions?.map((s: any) => (
          <div key={s.id} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-on-surface leading-relaxed">{s.body}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.status === 'IMPLEMENTED' ? 'bg-success/10 text-success' : s.status === 'REVIEWED' ? 'bg-secondary/10 text-secondary' : s.status === 'DISMISSED' ? 'bg-outline/10 text-outline' : 'bg-tertiary-container/30 text-on-tertiary-container'}`}>
                    {statusLabels[s.status] || s.status}
                  </span>
                  <span className="text-xs text-outline">{s.category}</span>
                  <span className="text-xs text-outline">·</span>
                  <span className="text-xs text-outline">{s.author?.fullName || 'Anonymous'}</span>
                  <span className="text-xs text-outline">·</span>
                  <span className="text-xs text-outline">{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {s.status === 'NEW' && (
                <button onClick={() => { setRespondingId(s.id); setResponse(''); setStatus('REVIEWED'); }} className="text-sm font-medium text-primary px-3 py-1 rounded-lg hover:bg-primary/5">
                  Respond
                </button>
              )}
            </div>
            {s.response && (
              <div className="mt-3 bg-secondary/5 rounded-lg p-3">
                <p className="text-xs font-bold text-secondary mb-1">Response by {s.respondedBy?.fullName}</p>
                <p className="text-sm text-on-surface">{s.response}</p>
              </div>
            )}
            {respondingId === s.id && (
              <div className="mt-4 space-y-3 border-t border-outline-variant/20 pt-4">
                <textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write a response..." rows={2} className="w-full px-4 py-3 bg-surface-container-low border-2 border-outline-variant rounded-xl focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-outline resize-none transition-colors" />
                <div className="flex gap-2">
                  {['REVIEWED', 'IMPLEMENTED', 'DISMISSED'].map((st) => (
                    <button key={st} onClick={() => setStatus(st)} className={`px-3 py-2 rounded-xl text-xs font-bold ${status === st ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {statusLabels[st]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setRespondingId(null)} className="flex-1 h-12 border-2 border-outline-variant rounded-xl text-on-surface-variant font-bold">Cancel</button>
                  <button onClick={() => respond.mutate({ id: s.id, response, status: status as any })} disabled={!response.trim()} className="flex-1 h-12 bg-primary text-on-primary font-bold rounded-xl disabled:opacity-40">Send</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
