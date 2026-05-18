interface LogEntryCardProps {
  body: string;
  author: string;
  category: string;
  isFlagged: boolean;
  createdAt: string;
}

const categoryIcons: Record<string, string> = {
  GENERAL: 'notes',
  INCIDENT: 'warning',
  HANDOVER: 'swap_horiz',
  INVENTORY: 'inventory_2',
};

export function LogEntryCard({ body, author, category, isFlagged, createdAt }: LogEntryCardProps) {
  return (
    <div className={`bg-surface-white rounded-[--radius-lg] p-4 shadow-[--shadow-card] ${isFlagged ? 'border-l-4 border-l-brand' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-on-surface-secondary">
            {categoryIcons[category] || 'notes'}
          </span>
          <span className="text-sm font-bold text-on-surface">{author}</span>
          {isFlagged && (
            <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">flag</span>
              Flagged
            </span>
          )}
        </div>
        <span className="text-xs text-outline">{createdAt}</span>
      </div>
      <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}
