-- Who is playing, and what the extra heads cost.
--
-- 20260105000000 gave courts a min/max capacity and bookings a party_size, but
-- nothing wrote the party size and nothing charged for it. Two things change
-- here:
--
--   1. The slot price now covers a stated number of players. Beyond that the
--      club charges per head, up to the max the court already seats. A court is
--      still sold by the slot; the fee prices the wear of a fuller court, not
--      the time.
--   2. The booker names every player. The desk needs the names on the day, and
--      counting them is how the party size stops being a number a guest can
--      assert independently of who actually turns up.

-- ---------------------------------------------------------------------------
-- Court capacity gains a covered count and a per-head fee.
-- ---------------------------------------------------------------------------

alter table courts
  add column included_players smallint,
  add column extra_player_fee_cents integer not null default 0;

-- Existing courts sold their whole capacity for the slot price, and changing
-- that silently would re-price live inventory. Every court starts with its full
-- max covered and a zero fee, so this migration is a no-op on price until a
-- staff member decides otherwise.
update courts set included_players = max_players where included_players is null;

alter table courts
  alter column included_players set not null,
  alter column included_players set default 4;

alter table courts
  add constraint courts_included_within_capacity
    check (included_players >= min_players and included_players <= max_players),
  add constraint courts_extra_fee_not_negative
    check (extra_player_fee_cents >= 0);

-- ---------------------------------------------------------------------------
-- The extra-player charge on a booking.
--
-- Its own column rather than folded into courts_subtotal_cents: the orders
-- screen shows it as its own line, and a total a guest cannot decompose is a
-- total the desk cannot defend on the phone.
-- ---------------------------------------------------------------------------

alter table bookings
  add column extra_players_fee_cents integer not null default 0,
  add constraint bookings_extra_players_fee_not_negative
    check (extra_players_fee_cents >= 0);

-- ---------------------------------------------------------------------------
-- Who is playing.
--
-- Rows rather than a jsonb array: the desk reads these one at a time, and
-- `position` gives the booker a stable order to edit against. Cascade on delete
-- because a player has no meaning apart from the booking that names them.
-- ---------------------------------------------------------------------------

create table booking_players (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  position smallint not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint booking_players_position_positive check (position > 0),
  constraint booking_players_name_not_blank check (length(btrim(name)) > 0),
  unique (booking_id, position)
);

create index booking_players_booking_idx on booking_players (booking_id);

alter table booking_players enable row level security;

-- Same reach as booking_items: staff at the club, or the customer who owns the
-- booking.
create policy booking_players_owner_read on booking_players
  for select using (
    exists (select 1 from bookings b where b.id = booking_id and (
      is_staff(b.club_id)
      or exists (
        select 1 from customers c
        where c.id = b.customer_id and c.auth_user_id = auth.uid()
      )
    ))
  );

create policy booking_players_staff_write on booking_players
  for all
  using (exists (select 1 from bookings b where b.id = booking_id and is_staff(b.club_id)))
  with check (exists (select 1 from bookings b where b.id = booking_id and is_staff(b.club_id)));

-- ---------------------------------------------------------------------------
-- create_booking takes the players, and derives the party size from them.
--
-- Recreated rather than overloaded, for the reason 20260105000000 gave: two
-- live signatures leave the weaker one callable, and a caller that omitted the
-- new argument would silently bind to it.
--
-- p_party_size is gone. It was a number a caller asserted alongside a list it
-- did not have to agree with; counting p_players makes the two the same fact.
-- ---------------------------------------------------------------------------

drop function if exists create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb, payment_method, smallint);

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
  p_players jsonb default '[]'::jsonb
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
  v_party_size smallint;
  v_min_players smallint;
  v_max_players smallint;
  v_included_players smallint;
  v_extra_fee_cents integer;
  v_extra_players_fee integer := 0;
begin
  if jsonb_array_length(p_courts) = 0 then
    raise exception 'a booking needs at least one court segment';
  end if;

  v_party_size := nullif(jsonb_array_length(p_players), 0);

  -- The seating terms across every court booked. Capacity spans the widest
  -- band, as before; where the courts disagree on price the guest gets the
  -- better of the two, so adding a court can never raise the per-head cost.
  if v_party_size is not null then
    select
      min(c.min_players), max(c.max_players),
      max(c.included_players), min(c.extra_player_fee_cents)
      into v_min_players, v_max_players, v_included_players, v_extra_fee_cents
    from courts c
    where c.id in (
      select (seg ->> 'court_id')::uuid from jsonb_array_elements(p_courts) as seg
    );

    if v_party_size < v_min_players or v_party_size > v_max_players then
      raise exception 'party size % is outside the % to % this court seats',
        v_party_size, v_min_players, v_max_players
        using errcode = 'check_violation';
    end if;

    v_extra_players_fee :=
      greatest(0, v_party_size - v_included_players) * v_extra_fee_cents;
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
    status, starts_at, ends_at, courts_subtotal_cents, will_present_id, notes,
    party_size, extra_players_fee_cents
  )
  values (
    p_club_id, v_reference, v_customer_id, p_contact_name, p_contact_email, p_contact_phone,
    'awaiting_payment', v_starts_at, v_ends_at, v_courts_subtotal, p_will_present_id, p_notes,
    v_party_size, v_extra_players_fee
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

  -- Names in the order the booker entered them. btrim here rather than trusting
  -- the caller, because the not-blank constraint is the last line of defence.
  insert into booking_players (booking_id, position, name)
  select
    v_booking.id,
    player.ordinality::smallint,
    btrim(player.value #>> '{}')
  from jsonb_array_elements(p_players) with ordinality as player(value, ordinality);

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
        total_cents = v_courts_subtotal + v_items_subtotal + v_extra_players_fee
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
  create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb, payment_method, jsonb)
  from public, anon, authenticated;
grant execute on function
  create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb, payment_method, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Reporting counts the extra-player fee as court revenue.
--
-- Folded into courts_revenue_cents rather than returned as a sixth column: the
-- fee is charged for occupying the court, so it belongs with the court money,
-- and widening the return shape would break every existing caller.
--
-- report_court_revenue is deliberately left alone. It attributes money to a
-- named court from booking_courts.price_cents, and a party fee on a booking
-- spanning two courts belongs to neither of them.
-- ---------------------------------------------------------------------------

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
  capacity as (
    select
      (select count(*) from courts where club_id = p_club_id and is_active) *
      (select extract(epoch from (closes_at - opens_at)) / 60 from clubs where id = p_club_id) *
      greatest(ceil(extract(epoch from (p_to - p_from)) / 86400), 1) as minutes
  )
  select
    (select count(*) from scoped),
    coalesce((
      select sum(courts_subtotal_cents + extra_players_fee_cents) from scoped
    ), 0)::bigint,
    coalesce((select sum(items_subtotal_cents) from scoped), 0)::bigint,
    coalesce((
      select sum(extract(epoch from (bc.ends_at - bc.starts_at)) / 60)
      from booking_courts bc
      join scoped s on s.id = bc.booking_id
    ), 0)::bigint,
    (select minutes from capacity)::bigint
  where is_staff(p_club_id);
$$;
