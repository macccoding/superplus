interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
      <div className="w-20 h-20 rounded-3xl bg-surface-cream flex items-center justify-center mb-5">
        <span className="material-symbols-outlined text-[40px] text-brand-light">{icon}</span>
      </div>
      <h3 className="text-lg font-bold text-on-surface">{title}</h3>
      {description && <p className="text-sm text-on-surface-secondary mt-1.5 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
