'use client';

interface ThreadCardProps {
  title: string;
  author: string;
  category: string;
  kind?: 'thread' | 'channel' | 'direct';
  messageCount: number;
  attachmentCount?: number;
  unreadCount?: number;
  preview?: string;
  lastSender?: string;
  isPinned: boolean;
  isResolved: boolean;
  isMentioned?: boolean;
  isSaved?: boolean;
  isFollowing?: boolean;
  updatedAt: string;
  onClick?: () => void;
}

const categoryConfig: Record<string, { color: string; icon: string; label: string }> = {
  GENERAL: { color: 'bg-success', icon: 'forum', label: 'General' },
  URGENT: { color: 'bg-brand', icon: 'priority_high', label: 'Urgent' },
  MAINTENANCE: { color: 'bg-warning', icon: 'build', label: 'Fix' },
  INVENTORY: { color: 'bg-navy', icon: 'inventory_2', label: 'Stock' },
  OTHER: { color: 'bg-outline', icon: 'more_horiz', label: 'Other' },
};

export function ThreadCard({
  title,
  author,
  category,
  kind = 'thread',
  messageCount,
  attachmentCount = 0,
  unreadCount = 0,
  preview,
  lastSender,
  isPinned,
  isResolved,
  isMentioned,
  isSaved,
  isFollowing,
  updatedAt,
  onClick,
}: ThreadCardProps) {
  const cat = kind === 'direct'
    ? { color: 'bg-navy', icon: 'person', label: 'Private' }
    : kind === 'channel'
      ? { color: 'bg-success', icon: 'storefront', label: 'Store' }
      : categoryConfig[category] || categoryConfig.GENERAL;
  const muted = isFollowing === false;

  return (
    <button
      onClick={onClick}
      className={`w-full min-h-[76px] text-left bg-surface-white px-3 py-3 rounded-[--radius-lg] active:scale-[0.99] transition-all duration-150 ${unreadCount > 0 ? 'shadow-sm ring-1 ring-brand/20' : 'border border-outline/20'}`}
    >
      <div className="flex items-center gap-3">
        <div className={`relative h-[52px] w-[52px] rounded-full ${cat.color} text-white flex items-center justify-center shrink-0`}>
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cat.icon}</span>
          {isMentioned && (
            <span className="absolute -right-0.5 -top-0.5 w-5 h-5 rounded-full bg-brand text-on-brand text-[10px] font-extrabold flex items-center justify-center">
              @
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-base truncate ${isResolved ? 'line-through text-outline' : 'text-on-surface'}`}>
              {title}
            </h3>
            {isPinned && <span className="material-symbols-outlined shrink-0 text-warning text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>}
            {isSaved && <span className="material-symbols-outlined shrink-0 text-brand text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>}
            {muted && <span className="material-symbols-outlined shrink-0 text-on-surface-secondary text-[16px]">notifications_off</span>}
            <span className={`ml-auto shrink-0 text-xs ${unreadCount > 0 ? 'font-extrabold text-brand' : 'font-bold text-on-surface-secondary'}`}>
              {updatedAt}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <p className={`min-w-0 flex-1 truncate text-sm ${unreadCount > 0 ? 'font-extrabold text-on-surface' : 'font-medium text-on-surface-secondary'}`}>
              {lastSender && kind !== 'direct' ? `${lastSender}: ` : ''}{preview || 'Start the conversation'}
            </p>
            {unreadCount > 0 && (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-brand text-on-brand text-xs font-extrabold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs font-bold text-on-surface-secondary">
            <span className="truncate">{author}</span>
            {attachmentCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">attach_file</span>
                {attachmentCount}
              </span>
            )}
            <span>{messageCount}</span>
            <span className="ml-auto rounded-full bg-surface px-2 py-0.5">{isResolved ? 'Done' : cat.label}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
