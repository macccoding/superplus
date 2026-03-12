-- ============================================================
-- Composite indexes for common query patterns
-- ============================================================

-- STOCK EVENTS
create index idx_stock_events_type_created
  on public.stock_events (event_type, created_at desc);

create index idx_stock_events_product_type_created
  on public.stock_events (product_id, event_type, created_at desc);

create index idx_stock_events_unresolved
  on public.stock_events (resolved_at)
  where resolved_at is null;

-- CHECKLISTS
create index idx_checklists_user_status
  on public.checklists (completed_by_user_id, status);

create index idx_checklists_shift_date
  on public.checklists (shift_date desc);

-- TASKS
create index idx_tasks_shift_status
  on public.tasks (shift_date, status);

create index idx_tasks_assigned_status
  on public.tasks (assigned_to_user_id, status);

-- ISSUES
create index idx_issues_status_severity
  on public.issues (status, severity);

create index idx_issues_reporter
  on public.issues (reported_by_user_id);

-- MARKDOWNS
create index idx_markdowns_active_from
  on public.markdowns (is_active, effective_from desc);

create index idx_markdowns_product_active
  on public.markdowns (product_id, is_active);

-- DAILY PRICES
create index idx_daily_prices_date_product
  on public.daily_prices (effective_date desc, product_id);

-- PRODUCTS
create index idx_products_active_category
  on public.products (is_active, category_id);

create index idx_products_barcode
  on public.products (barcode)
  where barcode is not null;

-- SUGGESTIONS
create index idx_suggestions_status_created
  on public.suggestions (status, created_at desc);
