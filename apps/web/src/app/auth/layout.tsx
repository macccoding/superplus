export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface p-[--spacing-container]">
      {children}
    </div>
  );
}
