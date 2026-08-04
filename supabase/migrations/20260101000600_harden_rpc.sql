-- Two defects found by verifying the schema against a live database.

-- 1. `returns bookings` yields ONE all-null composite row when nothing matches,
--    so a caller checking "did I get a row?" saw a hit for a wrong email.
--    `returns setof bookings` returns zero rows, which is what callers expect.
drop function if exists find_booking_by_reference(text, citext);

create function find_booking_by_reference(p_reference text, p_email citext)
returns setof bookings
language sql
security definer
set search_path = public
stable
as $$
  select *
  from bookings
  where upper(reference) = upper(p_reference)
    and contact_email = p_email
  limit 1;
$$;

-- 2. create_booking is SECURITY DEFINER and accepts per-segment price_cents.
--    Granting it to `anon` let any client call it through PostgREST and name
--    its own price. Both RPCs are now reachable only by the service role, i.e.
--    only through a server action that validates input and prices the segments
--    with src/lib/domain/pricing.ts.
revoke all on function create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb)
  to service_role;

revoke all on function find_booking_by_reference(text, citext) from public, anon, authenticated;
grant execute on function find_booking_by_reference(text, citext) to service_role;
