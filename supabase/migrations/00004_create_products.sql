-- Products table with full-text search support
create table public.products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  barcode text,
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.categories(id),
  cost_price numeric(10,2),
  selling_price numeric(10,2) not null,
  target_margin numeric(5,4),
  supplier_id uuid references public.suppliers(id),
  reorder_point integer default 0,
  reorder_qty integer default 0,
  shelf_location text,
  unit_of_measure text default 'each',
  is_active boolean default true,
  is_produce boolean default false,
  is_weight_based boolean default false,
  search_vector tsvector generated always as (to_tsvector('english', coalesce(name, ''))) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- GIN index for full-text search
create index idx_products_search_vector on public.products using gin(search_vector);

-- Trigger to auto-update updated_at on row change
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
