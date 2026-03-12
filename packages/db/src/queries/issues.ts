import type { Database, Issue } from '../types';

type IssueInsert = Database['public']['Tables']['issues']['Insert'];

// ---------------------------------------------------------------------------
// Create a new issue
// ---------------------------------------------------------------------------
export async function createIssue(
  supabase: any,
  data: IssueInsert,
): Promise<Issue> {
  const { data: issue, error } = await supabase
    .from('issues')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return issue;
}

// ---------------------------------------------------------------------------
// Query issues with optional filters and pagination
// ---------------------------------------------------------------------------
export async function getIssues(
  supabase: any,
  filters: {
    type?: Issue['issue_type'];
    severity?: Issue['severity'];
    status?: Issue['status'];
    limit?: number;
    offset?: number;
  } = {},
): Promise<Issue[]> {
  const { type, severity, status, limit = 50, offset = 0 } = filters;

  let query = supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type !== undefined) {
    query = query.eq('issue_type', type);
  }
  if (severity !== undefined) {
    query = query.eq('severity', severity);
  }
  if (status !== undefined) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Get a single issue by ID
// ---------------------------------------------------------------------------
export async function getIssueById(
  supabase: any,
  id: string,
): Promise<Issue> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Update issue status (and optionally mark as resolved)
// ---------------------------------------------------------------------------
export async function updateIssueStatus(
  supabase: any,
  id: string,
  params: {
    status: Issue['status'];
    resolvedByUserId?: string;
    resolutionNotes?: string;
  },
): Promise<Issue> {
  const { status, resolvedByUserId, resolutionNotes } = params;

  const updatePayload: Database['public']['Tables']['issues']['Update'] = { status };

  if (status === 'resolved') {
    updatePayload.resolved_by_user_id = resolvedByUserId ?? null;
    updatePayload.resolution_notes = resolutionNotes ?? null;
    updatePayload.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('issues')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Get all critical or high-severity open issues
// ---------------------------------------------------------------------------
export async function getCriticalOpenIssues(
  supabase: any,
): Promise<Issue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .in('severity', ['critical', 'high'])
    .in('status', ['open', 'in_progress'])
    .order('severity', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
