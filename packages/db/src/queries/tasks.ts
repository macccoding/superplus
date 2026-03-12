import type { Database, Task } from '../types';

type TaskInsert = Database['public']['Tables']['tasks']['Insert'];

// ---------------------------------------------------------------------------
// Create a new shift task
// ---------------------------------------------------------------------------
export async function createTask(
  supabase: any,
  data: TaskInsert,
): Promise<Task> {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return task;
}

// ---------------------------------------------------------------------------
// Get tasks for a given shift date with optional filters
// ---------------------------------------------------------------------------
export async function getShiftTasks(
  supabase: any,
  shiftDate: string,
  filters: {
    assignedTo?: string;
    status?: Task['status'];
  } = {},
): Promise<Task[]> {
  const { assignedTo, status } = filters;

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('shift_date', shiftDate)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (assignedTo !== undefined) {
    query = query.eq('assigned_to_user_id', assignedTo);
  }
  if (status !== undefined) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Update the status of a task
// ---------------------------------------------------------------------------
export async function updateTaskStatus(
  supabase: any,
  id: string,
  status: Task['status'],
  completedAt?: string,
): Promise<Task> {
  const updatePayload: Database['public']['Tables']['tasks']['Update'] = { status };

  if (status === 'done') {
    updatePayload.completed_at = completedAt ?? new Date().toISOString();
  } else {
    // Clear completed_at when reverting away from done
    updatePayload.completed_at = null;
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Assign / reassign a task to a staff member
// ---------------------------------------------------------------------------
export async function assignTask(
  supabase: any,
  id: string,
  assignedToUserId: string,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ assigned_to_user_id: assignedToUserId })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Hard-coded common task templates.
// These are in-memory helpers so managers can quickly create recurring tasks.
// No database call is needed.
// ---------------------------------------------------------------------------
export interface TaskTemplate {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'normal' | 'high';
}

export function getTaskTemplates(): TaskTemplate[] {
  return [
    {
      title: 'Restock shelves',
      description: 'Check and restock low-inventory shelves from backroom.',
      category: 'stock',
      priority: 'normal',
    },
    {
      title: 'Face-up aisles',
      description: 'Pull products forward and tidy all aisles.',
      category: 'merchandising',
      priority: 'low',
    },
    {
      title: 'Check expiry dates',
      description: 'Rotate stock and flag items within 7 days of expiry.',
      category: 'stock',
      priority: 'high',
    },
    {
      title: 'Clean deli counter',
      description: 'Sanitise deli counter, trays, and slicers.',
      category: 'cleaning',
      priority: 'normal',
    },
    {
      title: 'Receive delivery',
      description: 'Check in incoming delivery against PO and shelve items.',
      category: 'stock',
      priority: 'high',
    },
    {
      title: 'Price label audit',
      description: 'Verify shelf labels match system prices for promoted items.',
      category: 'pricing',
      priority: 'normal',
    },
    {
      title: 'Empty cardboard baler',
      description: 'Compact and empty the cardboard baler when full.',
      category: 'cleaning',
      priority: 'low',
    },
    {
      title: 'Temperature log',
      description: 'Record fridge and freezer temperatures on the log sheet.',
      category: 'compliance',
      priority: 'high',
    },
  ];
}

// ---------------------------------------------------------------------------
// Get a summary of task counts by status for a given shift date
// ---------------------------------------------------------------------------
export async function getShiftSummary(
  supabase: any,
  shiftDate: string,
): Promise<{ pending: number; in_progress: number; done: number; total: number }> {
  const { data, error } = await supabase
    .from('tasks')
    .select('status')
    .eq('shift_date', shiftDate);

  if (error) throw error;

  const tasks: Pick<Task, 'status'>[] = data ?? [];
  const summary = { pending: 0, in_progress: 0, done: 0, total: tasks.length };

  for (const task of tasks) {
    if (task.status === 'pending') summary.pending++;
    else if (task.status === 'in_progress') summary.in_progress++;
    else if (task.status === 'done') summary.done++;
  }

  return summary;
}
