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

  if (!thread) return <div className="p-4 text-center text-[#6B7280]">Loading...</div>;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)]">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <button onClick={() => router.back()} className="text-sm text-[#6B7280]">
          ← Back
        </button>
        <h2 className="font-bold text-[#1A1A2E] mt-1">{thread.title}</h2>
        <span className="text-xs text-[#6B7280]">by {thread.author.fullName}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread.messages.map((msg) => (
          <div key={msg.id} className="bg-white rounded-[12px] p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-[#1A1A2E]">{msg.author.fullName}</span>
              <span className="text-xs text-[#9CA3AF]">
                {msg.createdAt.toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-[#1A1A2E] whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {!thread.isResolved && (
        <div className="bg-white border-t border-gray-100 p-3 flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply..."
            className="flex-1 h-12 px-4 border-2 border-gray-200 rounded-full focus:border-[#E31837] focus:outline-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && reply.trim()) {
                sendReply.mutate({ threadId: id, body: reply });
              }
            }}
          />
          <button
            onClick={() => reply.trim() && sendReply.mutate({ threadId: id, body: reply })}
            disabled={!reply.trim() || sendReply.isPending}
            className="w-12 h-12 bg-[#E31837] text-white rounded-full flex items-center justify-center disabled:opacity-40"
          >
            ↑
          </button>
        </div>
      )}
    </div>
  );
}
