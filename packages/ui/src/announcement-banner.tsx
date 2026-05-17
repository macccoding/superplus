interface AnnouncementBannerProps {
  title: string;
  body: string;
  author: string;
  priority: string;
  createdAt: string;
}

const priorityConfig: Record<string, { bg: string; border: string; icon: string; iconColor: string }> = {
  CRITICAL: { bg: 'bg-primary/5', border: 'border-l-primary', icon: 'emergency', iconColor: 'text-primary' },
  IMPORTANT: { bg: 'bg-tertiary-container/20', border: 'border-l-tertiary-container', icon: 'info', iconColor: 'text-tertiary' },
  NORMAL: { bg: 'bg-surface-container-lowest', border: 'border-l-outline-variant', icon: 'campaign', iconColor: 'text-on-surface-variant' },
};

export function AnnouncementBanner({ title, body, author, priority, createdAt }: AnnouncementBannerProps) {
  const config = priorityConfig[priority] || priorityConfig.NORMAL;

  return (
    <div className={`${config.bg} border-l-4 ${config.border} rounded-xl p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined ${config.iconColor} mt-0.5`}>{config.icon}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-on-surface">{title}</h3>
            {priority === 'CRITICAL' && (
              <span className="text-xs bg-primary text-on-primary px-2 py-0.5 rounded-full font-bold">URGENT</span>
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
