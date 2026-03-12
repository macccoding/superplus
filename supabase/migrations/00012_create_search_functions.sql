-- Full-text product search with ILIKE fallback
create or replace function public.search_products(
  search_query text,
  limit_count int default 20
)
returns setof public.products
language plpgsql
stable
as $$
begin
  -- First try full-text search
  return query
    select p.*
    from public.products p
    where p.is_active = true
      and p.search_vector @@ plainto_tsquery('english', search_query)
    order by ts_rank(p.search_vector, plainto_tsquery('english', search_query)) desc
    limit limit_count;

  -- If no full-text results, fall back to ILIKE partial match
  if not found then
    return query
      select p.*
      from public.products p
      where p.is_active = true
        and (
          p.name ilike '%' || search_query || '%'
          or p.barcode ilike '%' || search_query || '%'
        )
      order by
        case
          when p.name ilike search_query || '%' then 0
          when p.name ilike '%' || search_query || '%' then 1
          else 2
        end,
        p.name
      limit limit_count;
  end if;
end;
$$;

-- Helper function to get a user's role from profiles
create or replace function public.get_user_role(uid uuid)
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where user_id = uid limit 1;
$$;
