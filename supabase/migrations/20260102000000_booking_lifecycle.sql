-- Booking lifecycle: cancel, reschedule, and recording how a booking will be paid.
--
-- All three are SECURITY DEFINER and granted to service_role only, for the same
-- reason as create_booking: they accept per-segment prices, or authenticate by
-- reference + email, and neither may be driven from the browser.

-- ---------------------------------------------------------------------------
-- create_booking gains p_payment_method, so checkout records the intended
-- payment in the same transaction as the booking. Recreated rather than
-- overloaded: two live signatures would leave the old, weaker one callable.
-- ---------------------------------------------------------------------------

drop function if exists create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb);

create function create_booking(
  p_club_id uuid,
  p_contact_name text,
  p_contact_email citext,
  p_contact_phone text,
  p_will_present_id boolean,
  p_notes text,
  p_courts jsonb,
  p_items jsonb default '[]'::jsonb,
  p_payment_method payment_method default null
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings;
  v_customer_id uuid;
  v_reference text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_courts_subtotal integer := 0;
  v_items_subtotal integer := 0;
begin
  if jsonb_array_length(p_courts) = 0 then
    raise exception 'a booking needs at least one court segment';
  end if;

  select min((c ->> 'starts_at')::timestamptz), max((c ->> 'ends_at')::timestamptz)
    into v_starts_at, v_ends_at
  from jsonb_array_elements(p_courts) as c;

  select coalesce(sum((c ->> 'price_cents')::integer), 0)
    into v_courts_subtotal
  from jsonb_array_elements(p_courts) as c;

  insert into customers (club_id, full_name, email, phone)
  values (p_club_id, p_contact_name, p_contact_email, p_contact_phone)
  on conflict (club_id, email) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, customers.phone)
  returning id into v_customer_id;

  v_reference := generate_booking_reference();

  insert into bookings (
    club_id, reference, customer_id, contact_name, contact_email, contact_phone,
    status, starts_at, ends_at, courts_subtotal_cents, will_present_id, notes
  )
  values (
    p_club_id, v_reference, v_customer_id, p_contact_name, p_contact_email, p_contact_phone,
    'awaiting_payment', v_starts_at, v_ends_at, v_courts_subtotal, p_will_present_id, p_notes
  )
  returning * into v_booking;

  insert into booking_courts (booking_id, court_id, status, starts_at, ends_at, price_cents)
  select
    v_booking.id,
    (c ->> 'court_id')::uuid,
    v_booking.status,
    (c ->> 'starts_at')::timestamptz,
    (c ->> 'ends_at')::timestamptz,
    (c ->> 'price_cents')::integer
  from jsonb_array_elements(p_courts) as c;

  -- Prices come from the catalog, never from the caller.
  insert into booking_items (booking_id, product_id, name_snapshot, unit_price_cents, quantity)
  select
    v_booking.id,
    p.id,
    p.name,
    p.price_cents,
    greatest((i ->> 'quantity')::smallint, 1)
  from jsonb_array_elements(p_items) as i
  join products p
    on p.id = (i ->> 'product_id')::uuid
   and p.club_id = p_club_id
   and p.is_active;

  select coalesce(sum(line_total_cents), 0) into v_items_subtotal
  from booking_items where booking_id = v_booking.id;

  update bookings
    set items_subtotal_cents = v_items_subtotal,
        total_cents = v_courts_subtotal + v_items_subtotal
  where id = v_booking.id
  returning * into v_booking;

  -- An intent to pay, not a settlement: staff mark it paid from the admin
  -- Orders screen, which is what stamps paid_at.
  if p_payment_method is not null then
    insert into payments (booking_id, method, status, amount_cents)
    values (v_booking.id, p_payment_method, 'pending', v_booking.total_cents);
  end if;

  return v_booking;
end;
$$;

revoke all on function create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb, payment_method)
  from public, anon, authenticated;
grant execute on function create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb, payment_method)
  to service_role;

-- ---------------------------------------------------------------------------
-- Guest cancellation. Authenticated by reference + email, the same pair the
-- lookup uses. Setting bookings.status fires bookings_sync_court_status, which
-- flips booking_courts.status and so releases the exclusion constraint.
-- ---------------------------------------------------------------------------

create function cancel_booking(p_reference text, p_email citext)
returns setof bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings;
begin
  select * into v_booking
  from bookings
  where upper(reference) = upper(p_reference)
    and contact_email = p_email
  for update;

  if not found then
    return;
  end if;

  -- A session already played, or already cancelled, is not cancellable.
  if v_booking.status in ('cancelled', 'completed') then
    raise exception 'booking % cannot be cancelled from status %',
      v_booking.reference, v_booking.status
      using errcode = 'P0002';
  end if;

  return query
    update bookings
      set status = 'cancelled',
          cancelled_at = now()
    where id = v_booking.id
    returning *;
end;
$$;

revoke all on function cancel_booking(text, citext) from public, anon, authenticated;
grant execute on function cancel_booking(text, citext) to service_role;

-- ---------------------------------------------------------------------------
-- Guest reschedule. Replaces every segment in one transaction: the old rows are
-- deleted and the new ones inserted, so the exclusion constraint sees the final
-- state. A clash raises 23P01 and the whole reschedule rolls back — the booking
-- keeps its original slot rather than losing it to a half-applied move.
-- ---------------------------------------------------------------------------

create function reschedule_booking(p_reference text, p_email citext, p_courts jsonb)
returns setof bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_courts_subtotal integer := 0;
begin
  if jsonb_array_length(p_courts) = 0 then
    raise exception 'a booking needs at least one court segment';
  end if;

  select * into v_booking
  from bookings
  where upper(reference) = upper(p_reference)
    and contact_email = p_email
  for update;

  if not found then
    return;
  end if;

  if v_booking.status in ('cancelled', 'completed') then
    raise exception 'booking % cannot be rescheduled from status %',
      v_booking.reference, v_booking.status
      using errcode = 'P0002';
  end if;

  select min((c ->> 'starts_at')::timestamptz), max((c ->> 'ends_at')::timestamptz)
    into v_starts_at, v_ends_at
  from jsonb_array_elements(p_courts) as c;

  select coalesce(sum((c ->> 'price_cents')::integer), 0)
    into v_courts_subtotal
  from jsonb_array_elements(p_courts) as c;

  delete from booking_courts where booking_id = v_booking.id;

  insert into booking_courts (booking_id, court_id, status, starts_at, ends_at, price_cents)
  select
    v_booking.id,
    (c ->> 'court_id')::uuid,
    v_booking.status,
    (c ->> 'starts_at')::timestamptz,
    (c ->> 'ends_at')::timestamptz,
    (c ->> 'price_cents')::integer
  from jsonb_array_elements(p_courts) as c;

  return query
    update bookings
      set starts_at = v_starts_at,
          ends_at = v_ends_at,
          courts_subtotal_cents = v_courts_subtotal,
          total_cents = v_courts_subtotal + items_subtotal_cents
    where id = v_booking.id
    returning *;
end;
$$;

revoke all on function reschedule_booking(text, citext, jsonb) from public, anon, authenticated;
grant execute on function reschedule_booking(text, citext, jsonb) to service_role;
