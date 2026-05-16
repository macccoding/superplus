interface LogEntryCardProps {
  body: string;
  author: string;
  category: string;
  isFlagged: boolean;
  createdAt: string;
}

export function LogEntryCard({ body, author, category, isFlagged, createdAt }: LogEntryCardProps) {
  return (
    <div className={`bg-white rounded-[12px] p-4 shadow-sm ${isFlagged ? 'border-l-4 border-[#E74C3C]' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#1A1A2E]">{author}</span>
          {isFlagged && <span className="text-xs bg-red-100 text-[#E74C3C] px-2 py-0.5 rounded font-medium">Flagged</span>}
        </div>
        <span className="text-xs text-[#9CA3AF]">{createdAt}</span>
      </div>
      <p className="text-sm text-[#1A1A2E] whitespace-pre-wrap">{body}</p>
      <span className="inline-block mt-2 text-xs text-[#6B7280] bg-gray-100 px-2 py-0.5 rounded">
        {category}
      </span>
    </div>
  );
}
