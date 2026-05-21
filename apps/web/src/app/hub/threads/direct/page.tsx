'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function DirectMessagePage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const { data: users, isLoading } = trpc.threads.mentionableUsers.useQuery();
  const startDirect = trpc.threads.startDirect.useMutation({
    onSuccess: (thread) => {
      utils.threads.invalidate();
      router.push(`/hub/threads/${thread.id}?from=direct`);
    },
    onError: (error) => {
      setNotice(error.message || 'Could not start that message.');
      setTimeout(() => setNotice(''), 5000);
    },
  });

  const filteredUsers = (users || []).filter((user) => (
    !search.trim() || user.fullName.toLowerCase().includes(search.trim().toLowerCase())
  ));
  const selectedUser = (users || []).find((user) => user.id === selectedUserId);

  return (
    <div className="px-5 py-6 pb-24">
      <button onClick={() => router.push('/hub/threads?tab=direct')} className="flex items-center gap-1 text-sm text-on-surface-secondary mb-4">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Messages
      </button>

      <section className="mb-5">
        <h2 className="text-2xl font-bold text-on-surface">Message Staff</h2>
        <p className="text-sm font-bold text-on-surface-secondary mt-1">Private work messages between two staff members</p>
      </section>

      {notice && (
        <div className="mb-4 rounded-[--radius-lg] bg-warning/10 px-4 py-3 text-sm font-bold text-warning flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">info</span>
          {notice}
        </div>
      )}

      <div className="bg-surface-white rounded-[--radius-lg] p-5 shadow-sm space-y-4">
        <div className="rounded-[--radius-lg] bg-navy/5 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-navy text-[22px]">lock</span>
          <p className="text-sm font-medium text-on-surface-secondary">
            Only you and the selected staff member can open this conversation.
          </p>
        </div>

        <div>
          <label htmlFor="staff-search" className="block text-sm font-bold text-on-surface mb-2">Choose Staff</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-secondary text-[20px]">search</span>
            <input
              id="staff-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search staff by name"
              className="w-full h-12 pl-11 pr-4 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
            </div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUserId(user.id)}
                className={`w-full min-h-14 rounded-[--radius-lg] px-3 text-left flex items-center gap-3 active:scale-[0.98] transition-all ${
                  selectedUserId === user.id ? 'bg-brand/10 ring-2 ring-brand/20' : 'bg-surface'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-navy/10 text-navy flex items-center justify-center shrink-0">
                  <span className="text-sm font-extrabold">
                    {user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-on-surface truncate">{user.fullName}</p>
                  <p className="text-xs font-bold text-on-surface-secondary">{user.role}</p>
                </div>
                {selectedUserId === user.id && <span className="material-symbols-outlined text-brand">check_circle</span>}
              </button>
            ))
          ) : (
            <p className="py-8 text-center text-sm font-bold text-on-surface-secondary">No staff found</p>
          )}
        </div>

        {selectedUser && (
          <div className="space-y-3 border-t border-outline/20 pt-4">
            <label htmlFor="direct-message" className="block text-sm font-bold text-on-surface">
              Message to {selectedUser.fullName}
            </label>
            <textarea
              id="direct-message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="w-full px-4 py-3 bg-surface border-2 border-outline rounded-[--radius-lg] focus:border-primary focus:outline-none text-base text-on-surface placeholder:text-on-surface-secondary resize-none transition-colors"
            />
            <button
              onClick={() => startDirect.mutate({ userId: selectedUser.id, body: body.trim() || undefined })}
              disabled={startDirect.isPending}
              className="w-full h-14 bg-brand text-on-brand font-bold rounded-[--radius-lg] disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">{startDirect.isPending ? 'progress_activity' : 'send'}</span>
              {body.trim() ? 'Send Message' : 'Open Chat'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
