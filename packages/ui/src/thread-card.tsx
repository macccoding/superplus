'use client';

interface ThreadCardProps {
  title: string;
  author: string;
  category: string;
  messageCount: number;
  isPinned: boolean;
  isResolved: boolean;
  updatedAt: string;
  onClick?: () => void;
}

const categoryConfig: Record<string, { color: string; icon: string }> = {
  GENERAL: { color: 'bg-outline', icon: 'chat' },
  URGENT: { color: 'bg-primary', icon: 'priority_high' },
  MAINTENANCE: { color: 'bg-tertiary-container', icon: 'build' },
  INVENTORY: { color: 'bg-secondary', icon: 'inventory_2' },
  OTHER: { color: 'bg-outline-variant', icon: 'more_horiz' },
};

export function ThreadCard({ title, author, category, messageCount, isPinned, isResolved, updatedAt, onClick }: ThreadCardProps) {
  const cat = categoryConfig[category] || categoryConfig.GENERAL;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-container-lowest p-4 rounded-xl shadow-sm active:scale-[0.98] transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full ${cat.color} text-white flex items-center justify-center shrink-0`}>
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cat.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isPinned && <span className="material-symbols-outlined text-tertiary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>}
            <h3 className={`font-bold text-base truncate ${isResolved ? 'line-through text-outline' : 'text-on-surface'}`}>
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-on-surface-variant">{author}</span>
            <span className="text-on-surface-variant">·</span>
            <span className="text-sm text-on-surface-variant">{messageCount} replies</span>
          </div>
          <span className="text-xs text-outline mt-1 block">{updatedAt}</span>
        </div>
      </div>
    </button>
  );
}
