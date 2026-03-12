create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  target_margin numeric(5,4),
  parent_id uuid references public.categories(id),
  sort_order integer default 0,
  created_at timestamptz default now()
);
