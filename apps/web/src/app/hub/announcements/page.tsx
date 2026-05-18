'use client';

import { trpc } from '@/lib/trpc-client';
import { AnnouncementBanner, EmptyState } from '@superplus/ui';

export default function AnnouncementsPage() {
  const { data: announcements, isLoading } = trpc.announcements.list.useQuery();

  return (
    <div>
      <section className="px-5 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-on-surface">Announcements</h2>
        <p className="text-sm text-on-surface-secondary mt-1">From management</p>
      </section>

      <section className="px-5 pb-24 space-y-3">
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
              createdAt={a.createdAt.toLocaleDateString()}
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
