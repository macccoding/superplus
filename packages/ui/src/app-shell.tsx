import { BottomNav, type NavItem } from './bottom-nav';

interface AppShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  storeName?: string;
  notificationSlot?: React.ReactNode;
}

export function AppShell({ children, navItems, storeName, notificationSlot }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-40 bg-brand h-16 flex items-center justify-between px-5 shadow-md">
        <div className="flex items-center gap-2.5">
          <img src="/logo-white.png" alt="SuperPlus" className="h-8" />
          <span className="text-on-brand text-lg font-bold tracking-tight">SuperPlus</span>
        </div>
        <div className="flex items-center gap-2">
          {notificationSlot}
          {storeName && (
            <span className="text-[11px] font-medium text-on-brand/80 bg-on-brand/15 px-3 py-1 rounded-full">
              {storeName}
            </span>
          )}
        </div>
      </header>
      <main className="pb-24">{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
