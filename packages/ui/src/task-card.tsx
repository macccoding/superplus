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
  URGENT: { color: 'bg-primary', label: 'Urgent', border: 'border-l-primary' },
  HIGH: { color: 'bg-tertiary-container', label: 'High', border: 'border-l-tertiary-container' },
  NORMAL: { color: 'bg-outline', label: 'Normal', border: 'border-l-outline' },
  LOW: { color: 'bg-outline-variant', label: 'Low', border: 'border-l-outline-variant' },
};

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  OPEN: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', label: 'Open' },
  IN_PROGRESS: { bg: 'bg-secondary-container', text: 'text-on-secondary-container', label: 'In Progress' },
  DONE: { bg: 'bg-success/10', text: 'text-success', label: 'Done' },
  CANCELLED: { bg: 'bg-surface-container-high', text: 'text-outline', label: 'Cancelled' },
};

export function TaskCard({ title, priority, status, assignedTo, createdBy, dueDate, timeAgo, onClick }: TaskCardProps) {
  const p = priorityConfig[priority] || priorityConfig.NORMAL;
  const s = statusConfig[status] || statusConfig.OPEN;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-surface-container-lowest p-4 rounded-xl shadow-sm border-l-4 ${p.border} active:scale-[0.98] transition-all duration-200`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${p.color} ${priority === 'URGENT' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${priority === 'URGENT' ? 'text-primary' : priority === 'HIGH' ? 'text-on-tertiary-container' : 'text-outline'}`}>
            {p.label}
          </span>
        </div>
        {timeAgo && <span className="text-xs text-outline">{timeAgo}</span>}
      </div>
      <h3 className="text-lg font-bold text-on-surface mb-3">{title}</h3>
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-xs text-outline">
            {assignedTo ? 'Staff' : 'Assignment'}
          </span>
          <span className={`text-sm font-bold ${assignedTo ? 'text-secondary' : 'text-tertiary'}`}>
            {assignedTo || 'Unassigned'}
          </span>
        </div>
        <span className={`${s.bg} ${s.text} px-4 py-1.5 rounded-full text-xs font-bold`}>
          {s.label}
        </span>
      </div>
    </button>
  );
}
