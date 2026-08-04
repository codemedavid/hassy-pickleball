-- Booking references, staff checks, cross-table overlap guards, and the
-- transactional booking entry point.

-- Crockford-style alphabet: no I, L, O, U — unambiguous when read aloud at a desk.
create or replace function generate_booking_reference()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  attempt integer := 0;
begin
  loop
    candidate := 'PB-';
    for _ in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from bookings where reference = candidate);

    attempt := attempt + 1;
    if attempt >= 20 then
      raise exception 'could not allocate a unique booking reference';
    end if;
  end loop;

  return candidate;
end;
$$;

-- Staff membership for the current session. SECURITY DEFINER so RLS policies on
-- `staff` cannot recurse into themselves.
create or replace function is_staff(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from staff
    where staff.user_id = auth.uid()
      and staff.club_id = p_club_id
      and staff.is_active
  );
$$;

create or replace function is_club_admin(p_club_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from staff
    where staff.user_id = auth.uid()
      and staff.club_id = p_club_id
      and staff.role = 'admin'
      and staff.is_active
  );
$$;

-- Postgres cannot express an EXCLUDE constraint across two tables, so the
-- booking/block conflict is enforced with symmetric triggers instead.
create or replace function reject_booking_over_block()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('pending', 'awaiting_payment', 'confirmed', 'completed') then
    return new;
  end if;

  if exists (
    select 1
    from availability_blocks b
    where b.court_id = new.court_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'court % is blocked during the requested window', new.court_id
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

create trigger booking_courts_reject_blocked
  before insert or update on booking_courts
  for each row execute function reject_booking_over_block();

create or replace function reject_block_over_booking()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from booking_courts bc
    where bc.court_id = new.court_id
      and bc.status in ('pending', 'awaiting_payment', 'confirmed', 'completed')
      and tstzrange(bc.starts_at, bc.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'court % already has a live booking during the requested window', new.court_id
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

create trigger availability_blocks_reject_booked
  before insert or update on availability_blocks
  for each row execute function reject_block_over_booking();

/*
 * Creates a booking, its court segments, and its line items in one transaction.
 *
 * Court prices arrive pre-computed from the server-side pricing engine
 * (src/lib/domain/pricing.ts) so the rule stack lives in one tested place.
 * Item prices are re-read from `products` here — the client never influences them.
 *
 * Raises exclusion_violation if any requested court/window is already taken.
 */
create or replace function create_booking(
  p_club_id uuid,
  p_contact_name text,
  p_contact_email citext,
  p_contact_phone text,
  p_will_present_id boolean,
  p_notes text,
  p_courts jsonb,
  p_items jsonb default '[]'::jsonb
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

  -- Attach to an existing customer record, or create one, keyed by club + email.
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

  return v_booking;
end;
$$;

-- Guest lookup: "Manage my bookings" needs reference AND matching email.
-- SECURITY DEFINER so anonymous callers can retrieve exactly their own booking
-- without a policy that would expose the whole table.
create or replace function find_booking_by_reference(p_reference text, p_email citext)
returns bookings
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

revoke all on function create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb) from public;
grant execute on function create_booking(uuid, text, citext, text, boolean, text, jsonb, jsonb)
  to anon, authenticated;

revoke all on function find_booking_by_reference(text, citext) from public;
grant execute on function find_booking_by_reference(text, citext) to anon, authenticated;
