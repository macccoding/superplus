'use client';

import { useEffect } from 'react';
import { trpc } from '@/lib/trpc-client';
import { AnnouncementBanner, EmptyState } from '@superplus/ui';

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AnnouncementsPage() {
  const utils = trpc.useUtils();
  const { data: announcements, isLoading } = trpc.announcements.list.useQuery();
  const acknowledge = trpc.announcements.acknowledge.useMutation({
    onSuccess: () => {
      utils.announcements.invalidate();
      utils.notifications.invalidate();
    },
  });
  const markRead = trpc.announcements.markRead.useMutation({ onSuccess: () => utils.announcements.invalidate() });

  useEffect(() => {
    const unreadIds = announcements?.filter((item: any) => !item.receipts?.[0]?.readAt).map((item: any) => item.id) ?? [];
    if (unreadIds.length > 0 && !markRead.isPending) markRead.mutate({ ids: unreadIds });
  }, [announcements, markRead]);

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Announcements</h2>
        <p className="text-sm text-on-surface-secondary mt-1">Urgent notices stay at the top</p>
      </section>

      <section className="px-5 pb-24 space-y-3">
        {acknowledge.error && (
          <div className="flex items-center gap-2 rounded-[--radius-lg] bg-error/10 px-4 py-3 text-sm font-bold text-error">
            <span className="material-symbols-outlined text-[20px]">error</span>
            {acknowledge.error.message}
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-brand text-[32px]">progress_activity</span>
          </div>
        ) : announcements && announcements.length > 0 ? (
          announcements.map((a) => (
            <AnnouncementBanner
              key={a.id}
              title={a.title}
              body={a.body}
              author={a.author.fullName}
              priority={a.priority}
              createdAt={formatDate(a.createdAt)}
              audience={a.store?.name || 'All stores'}
              acknowledgedAt={a.acknowledgedAt ? formatDate(a.acknowledgedAt) : null}
              acknowledging={acknowledge.isPending && acknowledge.variables?.id === a.id}
              onAcknowledge={a.requiresAck ? () => acknowledge.mutate({ id: a.id }) : undefined}
            />
          ))
        ) : (
          <EmptyState
            icon="campaign"
            title="No announcements"
            description="All clear for now"
          />
        )}
      </section>
    </div>
  );
}
