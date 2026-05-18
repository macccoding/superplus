import assert from 'node:assert/strict';
import { TaskStatus } from '@superplus/db';
import {
  activeTaskStatuses,
  canUserAccessTask,
  closedTaskStatuses,
  friendlyTaskStatusLabel,
  isClosedTaskStatus,
  requiresFinishFlow,
} from './tasks-policy';

const staff = { id: 'staff-1', role: 'STAFF' as const };
const supervisor = { id: 'supervisor-1', role: 'SUPERVISOR' as const };

assert.equal(canUserAccessTask(staff, { assignedToId: 'staff-1', createdById: 'manager-1' }), true);
assert.equal(canUserAccessTask(staff, { assignedToId: null, createdById: 'staff-1' }), true);
assert.equal(canUserAccessTask(staff, { assignedToId: 'staff-2', createdById: 'manager-1' }), false);
assert.equal(canUserAccessTask(supervisor, { assignedToId: 'staff-2', createdById: 'manager-1' }), true);

assert.deepEqual(activeTaskStatuses, [
  TaskStatus.OPEN,
  TaskStatus.IN_PROGRESS,
  TaskStatus.NEEDS_HELP,
  TaskStatus.IN_REVIEW,
]);
assert.deepEqual(closedTaskStatuses, [TaskStatus.DONE, TaskStatus.CANCELLED]);
assert.equal(isClosedTaskStatus(TaskStatus.DONE), true);
assert.equal(isClosedTaskStatus(TaskStatus.CANCELLED), true);
assert.equal(isClosedTaskStatus(TaskStatus.NEEDS_HELP), false);

assert.equal(requiresFinishFlow({ reviewRequired: false, requireCompletionNote: false, requireCompletionPhoto: false }), false);
assert.equal(requiresFinishFlow({ reviewRequired: true, requireCompletionNote: false, requireCompletionPhoto: false }), true);
assert.equal(requiresFinishFlow({ reviewRequired: false, requireCompletionNote: true, requireCompletionPhoto: false }), true);
assert.equal(requiresFinishFlow({ reviewRequired: false, requireCompletionNote: false, requireCompletionPhoto: true }), true);

assert.equal(friendlyTaskStatusLabel(TaskStatus.IN_PROGRESS), 'Working');
assert.equal(friendlyTaskStatusLabel(TaskStatus.NEEDS_HELP), 'Need Help');
assert.equal(friendlyTaskStatusLabel(TaskStatus.IN_REVIEW), 'Waiting Review');

console.log('Task policy tests passed');
