-- Checklist templates defined by management
create table public.checklist_templates (
  id uuid default gen_random_uuid() primary key,
  checklist_type text not null check (checklist_type in ('opening', 'closing')),
  task_text text not null,
  sort_order integer default 0,
  item_type text not null default 'checkbox' check (item_type in ('checkbox', 'numeric', 'cash', 'photo')),
  is_critical boolean default false,
  min_value numeric(10,2),
  max_value numeric(10,2),
  applicable_days integer[], -- 0=Sun, 1=Mon ... 6=Sat
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Checklists completed by staff each shift
create table public.checklists (
  id uuid default gen_random_uuid() primary key,
  checklist_type text not null check (checklist_type in ('opening', 'closing')),
  shift_date date not null,
  completed_by_user_id uuid references auth.users(id) not null,
  started_at timestamptz default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at timestamptz default now()
);

-- Individual items within a checklist instance
create table public.checklist_items (
  id uuid default gen_random_uuid() primary key,
  checklist_id uuid references public.checklists(id) on delete cascade not null,
  task_text text not null,
  sort_order integer default 0,
  is_completed boolean default false,
  completed_at timestamptz,
  value_entered text, -- stores numeric/cash/photo values as text
  is_critical boolean default false,
  escalation_sent boolean default false,
  created_at timestamptz default now()
);
