'use client';

import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import { NotificationBell } from '@superplus/ui';

export function HubNotifications() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: notifications } = trpc.notifications.list.useQuery();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.invalidate() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => utils.notifications.invalidate() });

  return (
    <NotificationBell
      notifications={notifications || []}
      unreadCount={unreadCount || 0}
      onMarkRead={(id) => markRead.mutate({ id })}
      onMarkAllRead={() => markAllRead.mutate()}
      onNavigate={(link) => router.push(link)}
    />
  );
}
