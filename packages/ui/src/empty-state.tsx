interface EmptyStateProps {
  icon: string; // Material Symbols icon name
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-[--spacing-container] text-center">
      <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[40px] text-outline">{icon}</span>
      </div>
      <h3 className="text-lg font-bold text-on-surface">{title}</h3>
      {description && <p className="text-sm text-on-surface-variant mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
