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

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-surface-white p-4 rounded-[--radius-lg] shadow-[--shadow-card] active:scale-[0.98] transition-all duration-200 ${unreadCount > 0 ? 'ring-2 ring-brand/20' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-full ${cat.color} text-white flex items-center justify-center shrink-0`}>
          <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cat.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isPinned && <span className="material-symbols-outlined text-warning text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>}
            {isSaved && <span className="material-symbols-outlined text-brand text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>bookmark</span>}
            <h3 className={`font-bold text-base truncate ${isResolved ? 'line-through text-outline' : 'text-on-surface'}`}>
              {title}
            </h3>
            {unreadCount > 0 && (
              <span className="ml-auto min-w-6 h-6 px-1.5 rounded-full bg-brand text-on-brand text-xs font-extrabold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>

          <p className={`mt-1 text-sm truncate ${unreadCount > 0 ? 'font-bold text-on-surface' : 'text-on-surface-secondary'}`}>
            {lastSender ? `${lastSender}: ` : ''}{preview || 'Start the conversation'}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-secondary">
            <span>{author}</span>
            <span>·</span>
            <span>{messageCount} message{messageCount === 1 ? '' : 's'}</span>
            {attachmentCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">attach_file</span>
                {attachmentCount}
              </span>
            )}
            <span>·</span>
            <span>{updatedAt}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-full bg-surface text-xs font-bold text-on-surface-secondary">{cat.label}</span>
            {isMentioned && <span className="px-2 py-1 rounded-full bg-brand/10 text-brand text-xs font-bold">@Me</span>}
            {isFollowing === false && <span className="px-2 py-1 rounded-full bg-outline/10 text-on-surface-secondary text-xs font-bold">Muted</span>}
            {isResolved && <span className="px-2 py-1 rounded-full bg-success/10 text-success text-xs font-bold">Done</span>}
          </div>
        </div>
      </div>
    </button>
  );
}
