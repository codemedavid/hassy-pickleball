-- Customer rollups.
--
-- customers.total_spend_cents, bookings_count and last_visit_at back the admin
-- Customers screen and the membership tiers the pricing engine reads. Nothing
-- was writing them, so every customer read as a zero-spend first-timer.
--
-- Recomputed from the bookings table rather than incremented, so the counters
-- cannot drift when a booking is cancelled, rescheduled, or repriced.

create or replace function refresh_customer_rollups(p_customer_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update customers c
    set total_spend_cents = coalesce(agg.spend, 0),
        bookings_count = coalesce(agg.count, 0),
        last_visit_at = agg.last_visit
  from (
    select
      sum(total_cents) filter (where status in ('confirmed', 'completed')) as spend,
      count(*) filter (where status in ('confirmed', 'completed')) as count,
      max(starts_at) filter (where status = 'completed') as last_visit
    from bookings
    where customer_id = p_customer_id
  ) as agg
  where c.id = p_customer_id;
$$;

create or replace function sync_customer_rollups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  -- NEW is unassigned on DELETE and OLD is unassigned on INSERT, so neither can
  -- be referenced unconditionally.
  if tg_op = 'DELETE' then
    v_customer_id := old.customer_id;
  else
    v_customer_id := new.customer_id;

    -- On update the booking can move to a different customer; refresh both.
    if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
      perform refresh_customer_rollups(old.customer_id);
    end if;
  end if;

  perform refresh_customer_rollups(v_customer_id);

  return null;
end;
$$;

create trigger bookings_sync_customer_rollups
  after insert or update of status, total_cents, customer_id or delete on bookings
  for each row execute function sync_customer_rollups();

-- Backfill anything that existed before this trigger.
select refresh_customer_rollups(id) from customers;
