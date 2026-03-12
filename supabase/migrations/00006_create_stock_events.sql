create table public.stock_events (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  event_type text not null check (event_type in ('stockout', 'restock_request', 'delivery', 'count', 'expiry_flag')),
  quantity numeric(10,2),
  notes text,
  photo_url text,
  reported_by_user_id uuid references auth.users(id) not null,
  resolved_by_user_id uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);
