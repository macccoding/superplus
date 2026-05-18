'use client';

interface TaskCardProps {
  title: string;
  priority: string;
  status: string;
  assignedTo?: string;
  createdBy: string;
  category?: string | null;
  workArea?: string | null;
  updateCount?: number;
  checklistCount?: number;
  attachmentCount?: number;
  dueDate?: string;
  timeAgo?: string;
  onClick?: () => void;
}

const priorityConfig: Record<string, { color: string; label: string; border: string }> = {
  URGENT: { color: 'text-brand', label: 'Urgent', border: 'border-l-brand' },
  HIGH: { color: 'text-warning', label: 'High', border: 'border-l-warning' },
  NORMAL: { color: 'text-on-surface-secondary', label: 'Normal', border: 'border-l-outline' },
  LOW: { color: 'text-outline', label: 'Low', border: 'border-l-outline' },
};

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  OPEN: { bg: 'bg-surface-cream', text: 'text-on-surface-secondary', label: 'Open' },
  IN_PROGRESS: { bg: 'bg-brand-light/10', text: 'text-brand', label: 'Working' },
  NEEDS_HELP: { bg: 'bg-warning/15', text: 'text-warning', label: 'Need Help' },
  IN_REVIEW: { bg: 'bg-navy/10', text: 'text-navy', label: 'Waiting Review' },
  DONE: { bg: 'bg-success/10', text: 'text-success', label: 'Done' },
  CANCELLED: { bg: 'bg-outline/10', text: 'text-on-surface-secondary', label: 'Cancelled' },
};

function dueInfo(dueDate?: string) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  if (due < today) return { label: 'Late', className: 'bg-error/10 text-error' };
  if (due >= today && due < tomorrow) return { label: 'Today', className: 'bg-warning/15 text-warning' };
  if (due >= tomorrow && due < dayAfter) return { label: 'Tomorrow', className: 'bg-navy/10 text-navy' };
  return { label: due.toLocaleDateString([], { month: 'short', day: 'numeric' }), className: 'bg-surface-cream text-on-surface-secondary' };
}

export function TaskCard({
  title,
  priority,
  status,
  assignedTo,
  createdBy,
  category,
  workArea,
  updateCount,
  checklistCount,
  attachmentCount,
  dueDate,
  timeAgo,
  onClick,
}: TaskCardProps) {
  const p = priorityConfig[priority] || priorityConfig.NORMAL;
  const s = statusConfig[status] || statusConfig.OPEN;
  const due = dueInfo(dueDate);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-surface-white p-4 rounded-[--radius-lg] shadow-[--shadow-card] border-l-4 ${p.border} active:scale-[0.98] active:shadow-sm transition-all duration-200`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full bg-current ${p.color} ${priority === 'URGENT' ? 'animate-pulse' : ''}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wider ${p.color}`}>{p.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {due && <span className={`${due.className} px-2 py-0.5 rounded-full text-[11px] font-bold`}>{due.label}</span>}
          {timeAgo && <span className="text-[11px] text-on-surface-secondary">{timeAgo}</span>}
        </div>
      </div>
      <h3 className="text-[16px] font-bold text-on-surface mb-3">{title}</h3>
      {(category || workArea || checklistCount || attachmentCount || updateCount) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {category && <span className="px-2 py-1 rounded-md bg-surface text-[11px] font-bold text-on-surface-secondary">{category}</span>}
          {workArea && <span className="px-2 py-1 rounded-md bg-surface text-[11px] font-bold text-on-surface-secondary">{workArea}</span>}
          {!!checklistCount && <span className="px-2 py-1 rounded-md bg-surface text-[11px] font-bold text-on-surface-secondary">Checklist {checklistCount}</span>}
          {!!attachmentCount && <span className="px-2 py-1 rounded-md bg-surface text-[11px] font-bold text-on-surface-secondary">Photos {attachmentCount}</span>}
          {!!updateCount && <span className="px-2 py-1 rounded-md bg-surface text-[11px] font-bold text-on-surface-secondary">Notes {updateCount}</span>}
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-[11px] text-on-surface-secondary block">{assignedTo ? 'Staff' : 'Assignment'}</span>
          <span className={`text-[13px] font-bold ${assignedTo ? 'text-navy' : 'text-warning'}`}>
            {assignedTo || 'Unassigned'}
          </span>
        </div>
        <span className={`${s.bg} ${s.text} px-3 py-1 rounded-full text-[11px] font-bold`}>{s.label}</span>
      </div>
    </button>
  );
}
