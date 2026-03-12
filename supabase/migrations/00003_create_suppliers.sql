create table public.suppliers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  contact_phone text,
  contact_email text,
  delivery_days text, -- e.g. 'Mon,Wed,Fri'
  lead_time_days integer,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);
