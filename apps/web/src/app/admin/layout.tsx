import { Sidebar } from '@superplus/ui';

const adminNav = [
  { label: 'Dashboard', icon: 'dashboard', href: '/admin' },
  { label: 'People', icon: 'group', href: '/admin/people' },
  { label: 'Activity', icon: 'timeline', href: '/admin/activity' },
  { label: 'Stores', icon: 'store', href: '/admin/stores' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar items={adminNav} title="SuperPlus" />
      <main className="ml-64 flex-1 min-h-dvh bg-surface p-8">
        {children}
      </main>
    </div>
  );
}
