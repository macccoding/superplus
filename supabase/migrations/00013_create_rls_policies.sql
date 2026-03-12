-- ============================================================
-- Row Level Security policies for all SuperPlus tables
-- ============================================================

-- Helper: check if the current user has at least the given role
-- Role hierarchy: owner > manager > supervisor > staff
create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
as $$
  select case public.get_user_role(auth.uid())
    when 'owner'      then true
    when 'manager'    then required_role in ('manager', 'supervisor', 'staff')
    when 'supervisor' then required_role in ('supervisor', 'staff')
    when 'staff'      then required_role = 'staff'
    else false
  end;
$$;

-- ============================================================
-- PROFILES
-- ============================================================
alter table public.profiles enable row level security;

create policy "Anyone authenticated can read active profiles"
  on public.profiles for select
  to authenticated
  using (is_active = true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- CATEGORIES
-- ============================================================
alter table public.categories enable row level security;

create policy "Everyone can read categories"
  on public.categories for select
  to authenticated
  using (true);

create policy "Manager+ can insert categories"
  on public.categories for insert
  to authenticated
  with check (public.has_role('manager'));

create policy "Manager+ can update categories"
  on public.categories for update
  to authenticated
  using (public.has_role('manager'))
  with check (public.has_role('manager'));

create policy "Manager+ can delete categories"
  on public.categories for delete
  to authenticated
  using (public.has_role('manager'));

-- ============================================================
-- SUPPLIERS
-- ============================================================
alter table public.suppliers enable row level security;

create policy "Everyone can read suppliers"
  on public.suppliers for select
  to authenticated
  using (true);

create policy "Manager+ can insert suppliers"
  on public.suppliers for insert
  to authenticated
  with check (public.has_role('manager'));

create policy "Manager+ can update suppliers"
  on public.suppliers for update
  to authenticated
  using (public.has_role('manager'))
  with check (public.has_role('manager'));

create policy "Manager+ can delete suppliers"
  on public.suppliers for delete
  to authenticated
  using (public.has_role('manager'));

-- ============================================================
-- PRODUCTS
-- ============================================================
alter table public.products enable row level security;

create policy "Everyone can read products"
  on public.products for select
  to authenticated
  using (true);

create policy "Manager+ can insert products"
  on public.products for insert
  to authenticated
  with check (public.has_role('manager'));

create policy "Manager+ can update products"
  on public.products for update
  to authenticated
  using (public.has_role('manager'))
  with check (public.has_role('manager'));

create policy "Manager+ can delete products"
  on public.products for delete
  to authenticated
  using (public.has_role('manager'));

-- ============================================================
-- DAILY PRICES
-- ============================================================
alter table public.daily_prices enable row level security;

create policy "Everyone can read daily_prices"
  on public.daily_prices for select
  to authenticated
  using (true);

create policy "Supervisor+ can insert daily_prices"
  on public.daily_prices for insert
  to authenticated
  with check (public.has_role('supervisor'));

create policy "Supervisor+ can update daily_prices"
  on public.daily_prices for update
  to authenticated
  using (public.has_role('supervisor'))
  with check (public.has_role('supervisor'));

-- ============================================================
-- STOCK EVENTS
-- ============================================================
alter table public.stock_events enable row level security;

create policy "Authenticated can read stock_events"
  on public.stock_events for select
  to authenticated
  using (true);

create policy "Authenticated can insert own stock_events"
  on public.stock_events for insert
  to authenticated
  with check (reported_by_user_id = auth.uid());

create policy "Supervisor+ can update stock_events"
  on public.stock_events for update
  to authenticated
  using (public.has_role('supervisor'))
  with check (public.has_role('supervisor'));

-- ============================================================
-- CHECKLISTS
-- ============================================================
alter table public.checklists enable row level security;

create policy "Supervisor+ can read checklists"
  on public.checklists for select
  to authenticated
  using (public.has_role('supervisor') or completed_by_user_id = auth.uid());

create policy "Supervisor+ can insert checklists"
  on public.checklists for insert
  to authenticated
  with check (public.has_role('supervisor') or completed_by_user_id = auth.uid());

create policy "Supervisor+ can update checklists"
  on public.checklists for update
  to authenticated
  using (public.has_role('supervisor') or completed_by_user_id = auth.uid())
  with check (public.has_role('supervisor') or completed_by_user_id = auth.uid());

-- ============================================================
-- CHECKLIST ITEMS
-- ============================================================
alter table public.checklist_items enable row level security;

create policy "Supervisor+ can read checklist_items"
  on public.checklist_items for select
  to authenticated
  using (
    public.has_role('supervisor')
    or exists (
      select 1 from public.checklists c
      where c.id = checklist_id and c.completed_by_user_id = auth.uid()
    )
  );

create policy "Supervisor+ can insert checklist_items"
  on public.checklist_items for insert
  to authenticated
  with check (
    public.has_role('supervisor')
    or exists (
      select 1 from public.checklists c
      where c.id = checklist_id and c.completed_by_user_id = auth.uid()
    )
  );

create policy "Supervisor+ can update checklist_items"
  on public.checklist_items for update
  to authenticated
  using (
    public.has_role('supervisor')
    or exists (
      select 1 from public.checklists c
      where c.id = checklist_id and c.completed_by_user_id = auth.uid()
    )
  )
  with check (
    public.has_role('supervisor')
    or exists (
      select 1 from public.checklists c
      where c.id = checklist_id and c.completed_by_user_id = auth.uid()
    )
  );

-- ============================================================
-- CHECKLIST TEMPLATES
-- ============================================================
alter table public.checklist_templates enable row level security;

create policy "Everyone can read checklist_templates"
  on public.checklist_templates for select
  to authenticated
  using (true);

create policy "Manager+ can insert checklist_templates"
  on public.checklist_templates for insert
  to authenticated
  with check (public.has_role('manager'));

create policy "Manager+ can update checklist_templates"
  on public.checklist_templates for update
  to authenticated
  using (public.has_role('manager'))
  with check (public.has_role('manager'));

create policy "Manager+ can delete checklist_templates"
  on public.checklist_templates for delete
  to authenticated
  using (public.has_role('manager'));

-- ============================================================
-- MARKDOWNS
-- ============================================================
alter table public.markdowns enable row level security;

create policy "Everyone can read markdowns"
  on public.markdowns for select
  to authenticated
  using (true);

create policy "Supervisor+ can insert markdowns"
  on public.markdowns for insert
  to authenticated
  with check (public.has_role('supervisor') and created_by_user_id = auth.uid());

create policy "Manager+ can update markdowns (approve)"
  on public.markdowns for update
  to authenticated
  using (public.has_role('manager'))
  with check (public.has_role('manager'));

-- ============================================================
-- TASKS
-- ============================================================
alter table public.tasks enable row level security;

create policy "Authenticated can read shift tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "Supervisor+ can insert tasks"
  on public.tasks for insert
  to authenticated
  with check (public.has_role('supervisor'));

create policy "Supervisor+ can update any task"
  on public.tasks for update
  to authenticated
  using (public.has_role('supervisor'))
  with check (public.has_role('supervisor'));

create policy "Staff can update status of assigned tasks"
  on public.tasks for update
  to authenticated
  using (assigned_to_user_id = auth.uid())
  with check (assigned_to_user_id = auth.uid());

create policy "Supervisor+ can delete tasks"
  on public.tasks for delete
  to authenticated
  using (public.has_role('supervisor'));

-- ============================================================
-- ISSUES
-- ============================================================
alter table public.issues enable row level security;

create policy "Everyone can read issues"
  on public.issues for select
  to authenticated
  using (true);

create policy "Authenticated can insert issues"
  on public.issues for insert
  to authenticated
  with check (reported_by_user_id = auth.uid());

create policy "Supervisor+ can update issues"
  on public.issues for update
  to authenticated
  using (public.has_role('supervisor'))
  with check (public.has_role('supervisor'));

-- ============================================================
-- SUGGESTIONS
-- ============================================================
alter table public.suggestions enable row level security;

create policy "Manager+ can read all suggestions"
  on public.suggestions for select
  to authenticated
  using (
    public.has_role('manager')
    or (submitted_by_user_id = auth.uid())
  );

create policy "Authenticated can insert suggestions"
  on public.suggestions for insert
  to authenticated
  with check (submitted_by_user_id = auth.uid());

create policy "Manager+ can update suggestions"
  on public.suggestions for update
  to authenticated
  using (public.has_role('manager'))
  with check (public.has_role('manager'));
