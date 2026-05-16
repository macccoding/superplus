import { IconGrid } from '@superplus/ui';

const hubItems = [
  { label: 'Tasks', icon: '📋', href: '/hub/tasks', color: '#1B3A5C' },
  { label: 'Threads', icon: '💬', href: '/hub/threads', color: '#2ECC71' },
  { label: 'Logbook', icon: '📓', href: '/hub/logbook', color: '#F5A623' },
  { label: 'Announce', icon: '📢', href: '/hub/announcements', color: '#E31837' },
  { label: 'Profile', icon: '👤', href: '/hub/profile', color: '#6B7280' },
  { label: 'Tools', icon: '🔧', href: '/tools', color: '#9B59B6' },
];

export default function HubHomePage() {
  return (
    <div className="pt-2">
      <IconGrid items={hubItems} />
    </div>
  );
}
