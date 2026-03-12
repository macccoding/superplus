create table public.daily_prices (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  cost_price numeric(10,2),
  selling_price numeric(10,2) not null,
  effective_date date not null,
  set_by_user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  unique(product_id, effective_date)
);
