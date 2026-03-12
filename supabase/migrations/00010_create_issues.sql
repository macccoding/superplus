create table public.issues (
  id uuid default gen_random_uuid() primary key,
  issue_type text not null check (issue_type in ('equipment', 'supplier', 'customer', 'staff', 'safety', 'other')),
  title text not null,
  description text,
  photo_url text,
  severity text default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  reported_by_user_id uuid references auth.users(id) not null,
  resolved_by_user_id uuid references auth.users(id),
  status text default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolution_notes text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
