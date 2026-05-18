'use client';

interface TaskCardProps {
  title: string;
  priority: string;
  status: string;
  assignedTo?: string;
  createdBy: string;
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
  IN_PROGRESS: { bg: 'bg-brand-light/10', text: 'text-brand', label: 'In Progress' },
  DONE: { bg: 'bg-success/10', text: 'text-success', label: 'Done' },
  CANCELLED: { bg: 'bg-outline/10', text: 'text-on-surface-secondary', label: 'Cancelled' },
};

export function TaskCard({ title, priority, status, assignedTo, createdBy, dueDate, timeAgo, onClick }: TaskCardProps) {
  const p = priorityConfig[priority] || priorityConfig.NORMAL;
  const s = statusConfig[status] || statusConfig.OPEN;

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
        {timeAgo && <span className="text-[11px] text-on-surface-secondary">{timeAgo}</span>}
      </div>
      <h3 className="text-[16px] font-bold text-on-surface mb-3">{title}</h3>
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
