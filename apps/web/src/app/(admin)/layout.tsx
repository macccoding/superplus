import { Sidebar } from '@superplus/ui';

const adminNav = [
  { label: 'Dashboard', icon: '📊', href: '/admin' },
  { label: 'People', icon: '👥', href: '/admin/people' },
  { label: 'Activity', icon: '📋', href: '/admin/activity' },
  { label: 'Stores', icon: '🏪', href: '/admin/stores' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar items={adminNav} title="SuperPlus" />
      <main className="ml-64 flex-1 min-h-dvh p-8">
        {children}
      </main>
    </div>
  );
}
