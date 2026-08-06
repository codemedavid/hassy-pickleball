-- Court capacity and booking party size ("pax").
--
-- A court has always had a physical limit on how many people can play on it;
-- until now that lived only in the blurb copy. Making it a column lets the
-- booking flow bound what a guest can pick, and lets the desk see at a glance
-- whether a 6-person group fits on the court they booked.
--
-- Capacity does not affect price. A court is sold by the slot, not by the head,
-- so pricing_rules is untouched.

alter table courts
  add column min_players smallint not null default 2,
  add column max_players smallint not null default 4;

alter table courts
  add constraint courts_players_ordered check (max_players >= min_players),
  add constraint courts_players_positive check (min_players > 0);

-- Nullable on purpose: bookings taken before this migration have no recorded
-- party size, and inventing one would be a lie the desk might act on. The
-- admin screens render those as "—".
alter table bookings
  add column party_size smallint,
  add constraint bookings_party_size_positive check (party_size is null or party_size > 0);

-- ---------------------------------------------------------------------------
-- create_booking carries the party size through.
--
-- Recreated rather than overloaded, for the same reason 20260102000000 dropped
-- the previous signature: two live signatures would leave the older, weaker one
-- callable, and a caller that omitted the new argument would silently bind to
-- it. p_party_size defaults to null so the shape stays additive for anything
-- mid-flight during deploy.
--
-- The value is validated against the court's own min/max here rather than by a
-- check constraint, because the bound lives on a different table. Doing it in
-- the same transaction that inserts the segments means a party that does not
-- fit can never be recorded — the whole booking rolls back.
-- ---------------------------------------------------------------------------

drop function if exists create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb, payment_method);

create function create_booking(
  p_club_id uuid,
  p_contact_name text,
  p_contact_email citext,
  p_contact_phone text,
  p_will_present_id boolean,
  p_notes text,
  p_courts jsonb,
  p_items jsonb default '[]'::jsonb,
  p_payment_method payment_method default null,
  p_party_size smallint default null
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
  v_min_players smallint;
  v_max_players smallint;
begin
  if jsonb_array_length(p_courts) = 0 then
    raise exception 'a booking needs at least one court segment';
  end if;

  -- The widest band the chosen courts allow. A booking spanning two courts can
  -- seat as many as the roomier one, and needs at least as many as the emptier
  -- one asks for.
  if p_party_size is not null then
    select min(c.min_players), max(c.max_players)
      into v_min_players, v_max_players
    from courts c
    where c.id in (
      select (seg ->> 'court_id')::uuid from jsonb_array_elements(p_courts) as seg
    );

    if p_party_size < v_min_players or p_party_size > v_max_players then
      raise exception 'party size % is outside the % to % this court seats',
        p_party_size, v_min_players, v_max_players
        using errcode = 'check_violation';
    end if;
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
    status, starts_at, ends_at, courts_subtotal_cents, will_present_id, notes, party_size
  )
  values (
    p_club_id, v_reference, v_customer_id, p_contact_name, p_contact_email, p_contact_phone,
    'awaiting_payment', v_starts_at, v_ends_at, v_courts_subtotal, p_will_present_id, p_notes,
    p_party_size
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

revoke all on function
  create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb, payment_method, smallint)
  from public, anon, authenticated;
grant execute on function
  create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb, payment_method, smallint)
  to service_role;
