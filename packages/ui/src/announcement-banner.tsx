interface AnnouncementBannerProps {
  title: string;
  body: string;
  author: string;
  priority: string;
  createdAt: string;
}

const priorityConfig: Record<string, { bg: string; border: string; icon: string; iconColor: string }> = {
  CRITICAL: { bg: 'bg-brand/5', border: 'border-l-brand', icon: 'emergency', iconColor: 'text-brand' },
  IMPORTANT: { bg: 'bg-warning/20', border: 'border-l-warning', icon: 'info', iconColor: 'text-warning' },
  NORMAL: { bg: 'bg-surface-white', border: 'border-l-outline', icon: 'campaign', iconColor: 'text-on-surface-secondary' },
};

export function AnnouncementBanner({ title, body, author, priority, createdAt }: AnnouncementBannerProps) {
  const config = priorityConfig[priority] || priorityConfig.NORMAL;

  return (
    <div className={`${config.bg} border-l-4 ${config.border} rounded-[--radius-lg] p-4 shadow-[--shadow-card]`}>
      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined ${config.iconColor} mt-0.5`}>{config.icon}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-on-surface">{title}</h3>
            {priority === 'CRITICAL' && (
              <span className="text-xs bg-brand text-on-brand px-2 py-0.5 rounded-full font-bold">URGENT</span>
            )}
          </div>
          <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{body}</p>
          <div className="flex items-center gap-2 mt-3 text-xs text-outline">
            <span>{author}</span>
            <span>·</span>
            <span>{createdAt}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
