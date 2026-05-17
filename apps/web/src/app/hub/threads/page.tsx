'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { ThreadCard, EmptyState } from '@superplus/ui';

export default function ThreadsPage() {
  const router = useRouter();
  const { data: threads, isLoading } = trpc.threads.list.useQuery();

  return (
    <div>
      <section className="px-[--spacing-container] pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Threads</h2>
        <p className="text-sm text-on-surface-variant mt-1">Store conversations</p>
      </section>

      <section className="px-[--spacing-container] pb-24 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-primary text-[32px]">progress_activity</span>
          </div>
        ) : threads && threads.length > 0 ? (
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
            icon="forum"
            title="No threads yet"
            description="Start a conversation with your team"
          />
        )}
      </section>

      <button
        onClick={() => router.push('/hub/threads/create')}
        className="fixed right-6 bottom-24 w-[--spacing-fab-size] h-[--spacing-fab-size] rounded-full bg-success text-white shadow-lg flex items-center justify-center z-30 active:scale-90 transition-all duration-200"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>
    </div>
  );
}
