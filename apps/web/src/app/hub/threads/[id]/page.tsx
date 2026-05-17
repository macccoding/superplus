'use client';

import { use, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [reply, setReply] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: thread } = trpc.threads.getById.useQuery({ id });
  const sendReply = trpc.threads.reply.useMutation({
    onSuccess: () => {
      setReply('');
      utils.threads.getById.invalidate({ id });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  if (!thread) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)]">
      {/* Thread header */}
      <div className="bg-surface-container-lowest px-[--spacing-container] py-3 border-b border-outline-variant/30 shrink-0">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-on-surface-variant mb-2">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        <h2 className="font-bold text-on-surface text-lg">{thread.title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-on-surface-variant">{thread.author.fullName}</span>
          <span className="text-xs text-outline">·</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-medium">
            {thread.category}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-[--spacing-container] space-y-3"
        style={{ paddingBottom: thread.isResolved ? '96px' : '140px' }}
      >
        {thread.messages.map((msg) => (
          <div key={msg.id} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center">
                <span className="text-xs font-bold text-on-secondary-container">
                  {msg.author.fullName.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <span className="text-sm font-bold text-on-surface">{msg.author.fullName}</span>
              <span className="text-xs text-outline ml-auto">{msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed pl-10">{msg.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar — fixed above bottom nav */}
      {!thread.isResolved && (
        <div
          className="fixed bottom-[--spacing-nav-height] left-0 right-0 bg-surface-container-lowest border-t border-outline-variant/30 p-3 flex gap-2 z-40"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply..."
            className="flex-1 h-12 px-4 bg-surface-container-low border-2 border-outline-variant rounded-full focus:border-primary focus:outline-none text-sm text-on-surface placeholder:text-outline transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && reply.trim()) {
                sendReply.mutate({ threadId: id, body: reply });
              }
            }}
          />
          <button
            onClick={() => reply.trim() && sendReply.mutate({ threadId: id, body: reply })}
            disabled={!reply.trim() || sendReply.isPending}
            className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center disabled:opacity-40 active:scale-90 transition-all duration-200"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      )}
    </div>
  );
}
