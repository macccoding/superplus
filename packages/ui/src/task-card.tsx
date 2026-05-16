interface TaskCardProps {
  title: string;
  priority: string;
  status: string;
  assignedTo?: string;
  createdBy: string;
  dueDate?: string;
  onClick?: () => void;
}

const priorityColors: Record<string, string> = {
  URGENT: '#E74C3C',
  HIGH: '#F5A623',
  NORMAL: '#6B7280',
  LOW: '#9CA3AF',
};

const statusLabels: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

export function TaskCard({ title, priority, status, assignedTo, createdBy, dueDate, onClick }: TaskCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-[12px] p-4 shadow-sm active:scale-[0.98] transition-transform"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-[#1A1A2E] text-base leading-tight">{title}</h3>
        <span
          className="shrink-0 w-3 h-3 rounded-full mt-1"
          style={{ backgroundColor: priorityColors[priority] }}
        />
      </div>
      <div className="flex items-center gap-2 mt-2 text-sm text-[#6B7280]">
        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
          {statusLabels[status] || status}
        </span>
        {assignedTo && <span>{assignedTo}</span>}
        {!assignedTo && <span className="text-[#F5A623] font-medium">Unassigned</span>}
      </div>
      {dueDate && (
        <p className="text-xs text-[#6B7280] mt-1">Due: {dueDate}</p>
      )}
    </button>
  );
}
