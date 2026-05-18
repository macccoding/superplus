import { TaskStatus } from '@superplus/db';
import { hasMinRole } from '@superplus/config';
import type { Role } from '@superplus/config';

export const activeTaskStatuses: TaskStatus[] = [
  TaskStatus.OPEN,
  TaskStatus.IN_PROGRESS,
  TaskStatus.NEEDS_HELP,
  TaskStatus.IN_REVIEW,
];

export const closedTaskStatuses: TaskStatus[] = [TaskStatus.DONE, TaskStatus.CANCELLED];

export function isClosedTaskStatus(status: TaskStatus): boolean {
  return status === TaskStatus.DONE || status === TaskStatus.CANCELLED;
}

export function canUserAccessTask(
  user: { id: string; role: Role },
  task: { assignedToId: string | null; createdById: string }
): boolean {
  return hasMinRole(user.role, 'SUPERVISOR') || task.assignedToId === user.id || task.createdById === user.id;
}

export function requiresFinishFlow(task: {
  reviewRequired: boolean;
  requireCompletionNote: boolean;
  requireCompletionPhoto: boolean;
}): boolean {
  return task.reviewRequired || task.requireCompletionNote || task.requireCompletionPhoto;
}

export function friendlyTaskStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    OPEN: 'Open',
    IN_PROGRESS: 'Working',
    NEEDS_HELP: 'Need Help',
    IN_REVIEW: 'Waiting Review',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
  };
  return labels[status];
}
