interface AnnouncementBannerProps {
  title: string;
  body: string;
  author: string;
  priority: string;
  createdAt: string;
  audience?: string;
  acknowledgedAt?: string | null;
  onAcknowledge?: () => void;
  acknowledging?: boolean;
}

const priorityConfig: Record<string, { bg: string; border: string; icon: string; iconColor: string; label: string }> = {
  CRITICAL: { bg: 'bg-brand/5', border: 'border-l-brand', icon: 'emergency', iconColor: 'text-brand', label: 'URGENT' },
  IMPORTANT: { bg: 'bg-warning/20', border: 'border-l-warning', icon: 'info', iconColor: 'text-warning', label: 'IMPORTANT' },
  NORMAL: { bg: 'bg-surface-white', border: 'border-l-outline', icon: 'campaign', iconColor: 'text-on-surface-secondary', label: 'NOTICE' },
};

export function AnnouncementBanner({
  title,
  body,
  author,
  priority,
  createdAt,
  audience,
  acknowledgedAt,
  onAcknowledge,
  acknowledging,
}: AnnouncementBannerProps) {
  const config = priorityConfig[priority] || priorityConfig.NORMAL;
  const needsAck = priority === 'CRITICAL' && onAcknowledge && !acknowledgedAt;

  return (
    <div className={`${config.bg} border-l-4 ${config.border} rounded-[--radius-lg] p-4 shadow-[--shadow-card]`}>
      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined ${config.iconColor} mt-0.5`}>{config.icon}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-on-surface">{title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${priority === 'CRITICAL' ? 'bg-brand text-on-brand' : priority === 'IMPORTANT' ? 'bg-warning text-on-surface' : 'bg-surface text-on-surface-secondary'}`}>{config.label}</span>
          </div>
          <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{body}</p>
          {needsAck && (
            <button
              onClick={onAcknowledge}
              disabled={acknowledging}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[--radius-lg] bg-brand px-4 font-bold text-on-brand disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[20px] ${acknowledging ? 'animate-spin' : ''}`}>{acknowledging ? 'progress_activity' : 'check_circle'}</span>
              Acknowledge
            </button>
          )}
          {priority === 'CRITICAL' && acknowledgedAt && (
            <div className="mt-4 flex min-h-12 items-center gap-2 rounded-[--radius-lg] bg-success/10 px-4 text-sm font-bold text-success">
              <span className="material-symbols-outlined text-[20px]">verified</span>
              Acknowledged
            </div>
          )}
          <div className="flex items-center gap-2 mt-3 text-xs text-outline">
            <span>{author}</span>
            <span>·</span>
            <span>{createdAt}</span>
            {audience && (
              <>
                <span>·</span>
                <span>{audience}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
