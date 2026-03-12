-- Enable Supabase Realtime on tables that need live updates
alter publication supabase_realtime add table public.stock_events;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.issues;
alter publication supabase_realtime add table public.checklists;
alter publication supabase_realtime add table public.checklist_items;
alter publication supabase_realtime add table public.markdowns;
alter publication supabase_realtime add table public.daily_prices;
