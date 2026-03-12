create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  category text,
  assigned_by_user_id uuid references auth.users(id) not null,
  assigned_to_user_id uuid references auth.users(id),
  shift_date date not null,
  priority text default 'normal' check (priority in ('low', 'normal', 'high')),
  status text default 'pending' check (status in ('pending', 'in_progress', 'done')),
  completed_at timestamptz,
  created_at timestamptz default now()
);
