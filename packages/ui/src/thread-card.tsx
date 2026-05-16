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

const categoryColors: Record<string, string> = {
  GENERAL: '#6B7280',
  URGENT: '#E74C3C',
  MAINTENANCE: '#F5A623',
  INVENTORY: '#1B3A5C',
  OTHER: '#9B59B6',
};

export function ThreadCard({
  title, author, category, messageCount, isPinned, isResolved, updatedAt, onClick
}: ThreadCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-[12px] p-4 shadow-sm active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start gap-3">
        {isPinned && <span className="text-lg">📌</span>}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-base truncate ${isResolved ? 'line-through text-[#6B7280]' : 'text-[#1A1A2E]'}`}>
            {title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-[#6B7280]">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: categoryColors[category] }}
            >
              {category}
            </span>
            <span>{author}</span>
            <span>·</span>
            <span>{messageCount} replies</span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">{updatedAt}</p>
        </div>
      </div>
    </button>
  );
}
