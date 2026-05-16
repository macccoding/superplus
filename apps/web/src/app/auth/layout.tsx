export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F8F9FA] p-4">
      {children}
    </div>
  );
}
