import { BottomNav, type NavItem } from './bottom-nav';

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  navItems: NavItem[];
}

export function AppShell({ children, title, navItems }: AppShellProps) {
  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center">
        <h1 className="text-lg font-bold text-[#1A1A2E]">{title}</h1>
      </header>
      <main>{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
