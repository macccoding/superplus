import { BottomNav, type NavItem } from './bottom-nav';

interface AppShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  storeName?: string;
}

export function AppShell({ children, navItems, storeName }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-40 bg-surface-container-lowest h-[--spacing-nav-height] flex items-center justify-between px-[--spacing-container] shadow-sm border-b-2 border-surface-variant">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[28px]">storefront</span>
          <h1 className="text-2xl font-black tracking-tight text-primary">SuperPlus</h1>
        </div>
        {storeName && (
          <span className="text-xs font-medium text-on-surface-variant bg-surface-container-high px-4 py-1.5 rounded-full">
            {storeName}
          </span>
        )}
      </header>
      <main className="pb-24">{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
