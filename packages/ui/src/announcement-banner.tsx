interface AnnouncementBannerProps {
  title: string;
  body: string;
  author: string;
  priority: string;
  createdAt: string;
}

const priorityStyles: Record<string, { bg: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-50', border: 'border-[#E74C3C]' },
  IMPORTANT: { bg: 'bg-orange-50', border: 'border-[#F5A623]' },
  NORMAL: { bg: 'bg-white', border: 'border-gray-200' },
};

export function AnnouncementBanner({ title, body, author, priority, createdAt }: AnnouncementBannerProps) {
  const styles = priorityStyles[priority] || priorityStyles.NORMAL;

  return (
    <div className={`${styles.bg} border-l-4 ${styles.border} rounded-[12px] p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-[#1A1A2E]">{title}</h3>
        {priority === 'CRITICAL' && (
          <span className="text-xs bg-[#E74C3C] text-white px-2 py-0.5 rounded font-bold">URGENT</span>
        )}
      </div>
      <p className="text-sm text-[#1A1A2E] whitespace-pre-wrap">{body}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-[#6B7280]">
        <span>{author}</span>
        <span>·</span>
        <span>{createdAt}</span>
      </div>
    </div>
  );
}
