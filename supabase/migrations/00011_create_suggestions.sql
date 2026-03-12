create table public.suggestions (
  id uuid default gen_random_uuid() primary key,
  message text not null check (char_length(message) <= 280),
  category text default 'other' check (category in ('product_request', 'improvement', 'issue', 'other')),
  is_anonymous boolean default true,
  submitted_by_user_id uuid references auth.users(id) not null,
  status text default 'new' check (status in ('new', 'reviewed', 'actioned', 'dismissed')),
  manager_notes text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);
