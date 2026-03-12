create table public.markdowns (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  original_price numeric(10,2) not null,
  markdown_price numeric(10,2) not null,
  reason text not null check (reason in ('approaching_expiry', 'damaged', 'overstock', 'promo', 'manager_directed', 'other')),
  approved_by_user_id uuid references auth.users(id),
  created_by_user_id uuid references auth.users(id) not null,
  effective_from timestamptz default now(),
  effective_until timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);
