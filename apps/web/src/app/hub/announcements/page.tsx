'use client';

import { trpc } from '@/lib/trpc-client';
import { AnnouncementBanner, EmptyState } from '@superplus/ui';

export default function AnnouncementsPage() {
  const { data: announcements } = trpc.announcements.list.useQuery();

  return (
    <div className="p-4 space-y-3">
      {announcements && announcements.length > 0 ? (
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
          icon="📢"
          title="No announcements"
          description="All clear for now"
        />
      )}
    </div>
  );
}
