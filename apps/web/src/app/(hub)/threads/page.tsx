'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { ThreadCard, EmptyState } from '@superplus/ui';

export default function ThreadsPage() {
  const router = useRouter();
  const { data: threads } = trpc.threads.list.useQuery();

  return (
    <div>
      <div className="p-4 space-y-3">
        {threads && threads.length > 0 ? (
          threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              title={thread.title}
              author={thread.author.fullName}
              category={thread.category}
              messageCount={thread._count.messages}
              isPinned={thread.isPinned}
              isResolved={thread.isResolved}
              updatedAt={thread.updatedAt.toLocaleDateString()}
              onClick={() => router.push(`/hub/threads/${thread.id}`)}
            />
          ))
        ) : (
          <EmptyState
            icon="💬"
            title="No threads yet"
            description="Start a conversation with your team"
          />
        )}
      </div>

      <button
        onClick={() => router.push('/hub/threads/create')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-[#2ECC71] text-white rounded-full shadow-lg flex items-center justify-center text-2xl active:scale-90 transition-transform z-30"
      >
        +
      </button>
    </div>
  );
}
