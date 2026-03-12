import type { Database, Checklist, ChecklistItem, ChecklistTemplate } from '../types';

type ChecklistInsert = Database['public']['Tables']['checklists']['Insert'];
type ChecklistTemplateInsert = Database['public']['Tables']['checklist_templates']['Insert'];
type ChecklistTemplateUpdate = Database['public']['Tables']['checklist_templates']['Update'];

// ---------------------------------------------------------------------------
// Get template items for a given checklist type and (optionally) day of week.
// dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
// Templates that have NULL applicable_days are always returned.
// ---------------------------------------------------------------------------
export async function getChecklistTemplates(
  supabase: any,
  type: 'opening' | 'closing',
  dayOfWeek?: number,
): Promise<ChecklistTemplate[]> {
  let query = supabase
    .from('checklist_templates')
    .select('*')
    .eq('checklist_type', type)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  // Filter by applicable day in application code because Supabase
  // does not natively support "array contains" on int[] with the JS client
  // in all environments. NULL applicable_days = every day.
  if (dayOfWeek !== undefined) {
    return (data ?? []).filter(
      (t: ChecklistTemplate) => t.applicable_days === null || t.applicable_days.includes(dayOfWeek),
    );
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Create a new checklist instance and populate its items from templates.
// Returns the checklist together with the created items.
// ---------------------------------------------------------------------------
export async function createChecklist(
  supabase: any,
  params: {
    type: 'opening' | 'closing';
    shiftDate: string;
    userId: string;
  },
): Promise<Checklist & { items: ChecklistItem[] }> {
  const { type, shiftDate, userId } = params;

  // 1. Create the checklist header
  const { data: checklist, error: clError } = await supabase
    .from('checklists')
    .insert({
      checklist_type: type,
      shift_date: shiftDate,
      completed_by_user_id: userId,
      status: 'in_progress',
    } satisfies ChecklistInsert)
    .select()
    .single();

  if (clError) throw clError;

  // 2. Pull the applicable templates for today
  const dayOfWeek = new Date(shiftDate).getDay();
  const templates = await getChecklistTemplates(supabase, type, dayOfWeek);

  if (templates.length === 0) {
    return { ...checklist, items: [] };
  }

  // 3. Bulk-insert items from templates
  const itemRows = templates.map((t: ChecklistTemplate) => ({
    checklist_id: checklist.id,
    task_text: t.task_text,
    sort_order: t.sort_order,
    is_critical: t.is_critical,
    is_completed: false,
  }));

  const { data: items, error: itemsError } = await supabase
    .from('checklist_items')
    .insert(itemRows)
    .select();

  if (itemsError) throw itemsError;

  return { ...checklist, items: items ?? [] };
}

// ---------------------------------------------------------------------------
// Update a single checklist item (tick / enter value)
// ---------------------------------------------------------------------------
export async function updateChecklistItem(
  supabase: any,
  itemId: string,
  data: {
    isCompleted: boolean;
    valueEntered?: string;
    completedAt: string;
  },
): Promise<ChecklistItem> {
  const { data: item, error } = await supabase
    .from('checklist_items')
    .update({
      is_completed: data.isCompleted,
      value_entered: data.valueEntered ?? null,
      completed_at: data.isCompleted ? data.completedAt : null,
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return item;
}

// ---------------------------------------------------------------------------
// Mark a checklist as completed
// ---------------------------------------------------------------------------
export async function completeChecklist(
  supabase: any,
  checklistId: string,
): Promise<Checklist> {
  const { data, error } = await supabase
    .from('checklists')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', checklistId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Get checklist history with optional user filter and pagination
// ---------------------------------------------------------------------------
export async function getChecklistHistory(
  supabase: any,
  filters: {
    userId?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Checklist[]> {
  const { userId, limit = 20, offset = 0 } = filters;

  let query = supabase
    .from('checklists')
    .select('*')
    .order('shift_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId !== undefined) {
    query = query.eq('completed_by_user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Get the currently in-progress checklist for a user (if any)
// ---------------------------------------------------------------------------
export async function getActiveChecklist(
  supabase: any,
  userId: string,
): Promise<(Checklist & { items: ChecklistItem[] }) | null> {
  const { data: checklist, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('completed_by_user_id', userId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (error) throw error;
  if (!checklist) return null;

  const { data: items, error: itemsError } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('checklist_id', checklist.id)
    .order('sort_order', { ascending: true });

  if (itemsError) throw itemsError;

  return { ...checklist, items: items ?? [] };
}

// ---------------------------------------------------------------------------
// Management: create a new checklist template
// ---------------------------------------------------------------------------
export async function createChecklistTemplate(
  supabase: any,
  data: ChecklistTemplateInsert,
): Promise<ChecklistTemplate> {
  const { data: template, error } = await supabase
    .from('checklist_templates')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return template;
}

// ---------------------------------------------------------------------------
// Management: update an existing checklist template
// ---------------------------------------------------------------------------
export async function updateChecklistTemplate(
  supabase: any,
  id: string,
  data: ChecklistTemplateUpdate,
): Promise<ChecklistTemplate> {
  const { data: template, error } = await supabase
    .from('checklist_templates')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return template;
}
