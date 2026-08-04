-- Reporting for the admin Reports screen.
--
-- Aggregated in SQL rather than in the application: the alternative is pulling
-- every booking of the period into Node just to sum it. Read-only and scoped to
-- staff of the club by an is_staff() check, so RLS on the underlying tables is
-- not silently bypassed by SECURITY DEFINER.

-- Revenue and session count per court over a window.
create or replace function report_court_revenue(
  p_club_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  court_id uuid,
  court_name text,
  sessions bigint,
  booked_minutes bigint,
  revenue_cents bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.name,
    count(bc.id),
    coalesce(sum(extract(epoch from (bc.ends_at - bc.starts_at)) / 60), 0)::bigint,
    coalesce(sum(bc.price_cents), 0)::bigint
  from courts c
  left join booking_courts bc
    on bc.court_id = c.id
   and bc.status in ('confirmed', 'completed')
   and bc.starts_at < p_to
   and bc.ends_at > p_from
  where c.club_id = p_club_id
    and is_staff(p_club_id)
  group by c.id, c.name
  order by c.sort_order;
$$;

-- Headline tiles: revenue, bookings, add-on sales, and utilisation for a window.
create or replace function report_club_totals(
  p_club_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  bookings_count bigint,
  courts_revenue_cents bigint,
  items_revenue_cents bigint,
  booked_minutes bigint,
  open_minutes bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with scoped as (
    select b.*
    from bookings b
    where b.club_id = p_club_id
      and b.status in ('confirmed', 'completed')
      and b.starts_at < p_to
      and b.ends_at > p_from
  ),
  -- Sellable minutes = open hours per day x active courts, the denominator for
  -- the utilisation bars.
  capacity as (
    select
      (select count(*) from courts where club_id = p_club_id and is_active) *
      (select extract(epoch from (closes_at - opens_at)) / 60 from clubs where id = p_club_id) *
      greatest(ceil(extract(epoch from (p_to - p_from)) / 86400), 1) as minutes
  )
  select
    (select count(*) from scoped),
    coalesce((select sum(courts_subtotal_cents) from scoped), 0)::bigint,
    coalesce((select sum(items_subtotal_cents) from scoped), 0)::bigint,
    coalesce((
      select sum(extract(epoch from (bc.ends_at - bc.starts_at)) / 60)
      from booking_courts bc
      join scoped s on s.id = bc.booking_id
    ), 0)::bigint,
    (select minutes from capacity)::bigint
  where is_staff(p_club_id);
$$;

-- Best-selling add-ons and café items over a window.
create or replace function report_product_sales(
  p_club_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  name text,
  units bigint,
  revenue_cents bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    bi.name_snapshot,
    sum(bi.quantity)::bigint,
    sum(bi.line_total_cents)::bigint
  from booking_items bi
  join bookings b on b.id = bi.booking_id
  where b.club_id = p_club_id
    and b.status in ('confirmed', 'completed')
    and b.starts_at < p_to
    and b.ends_at > p_from
    and is_staff(p_club_id)
  group by bi.name_snapshot
  order by 3 desc;
$$;

revoke all on function report_court_revenue(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function report_club_totals(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function report_product_sales(uuid, timestamptz, timestamptz) from public, anon;

grant execute on function report_court_revenue(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function report_club_totals(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function report_product_sales(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
