-- People and bookings.

create table staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  club_id uuid not null references clubs (id) on delete cascade,
  role staff_role not null default 'staff',
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index staff_club_idx on staff (club_id) where is_active;

create table customers (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  auth_user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  email citext not null,
  phone text,
  tier customer_tier not null default 'standard',
  total_spend_cents bigint not null default 0 check (total_spend_cents >= 0),
  bookings_count integer not null default 0 check (bookings_count >= 0),
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, email)
);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

create table bookings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  reference text not null unique,
  customer_id uuid references customers (id) on delete set null,
  -- Guest bookings carry their own contact details; lookup is reference + email.
  contact_name text not null,
  contact_email citext not null,
  contact_phone text,
  status booking_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  courts_subtotal_cents integer not null default 0 check (courts_subtotal_cents >= 0),
  items_subtotal_cents integer not null default 0 check (items_subtotal_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  will_present_id boolean not null default false,
  notes text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_window_ordered check (ends_at > starts_at)
);

create index bookings_club_window_idx on bookings (club_id, starts_at);
create index bookings_customer_idx on bookings (customer_id);
create index bookings_contact_email_idx on bookings (contact_email);

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- One row per court/time segment in a booking. The cart can hold several.
-- `status` is denormalised from bookings so the exclusion constraint can ignore
-- cancelled bookings — a cross-table constraint is not expressible in Postgres.
create table booking_courts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  court_id uuid not null references courts (id) on delete restrict,
  status booking_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  constraint booking_courts_window_ordered check (ends_at > starts_at),
  -- The core guarantee: two live bookings can never hold the same court at the
  -- same time. Enforced by the database, not by application read-then-write.
  constraint booking_courts_no_double_booking
    exclude using gist (
      court_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status in ('pending', 'awaiting_payment', 'confirmed', 'completed'))
);

create index booking_courts_booking_idx on booking_courts (booking_id);
create index booking_courts_court_window_idx on booking_courts (court_id, starts_at, ends_at);

-- Keep booking_courts.status in step with the parent booking.
create or replace function sync_booking_courts_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    update booking_courts set status = new.status where booking_id = new.id;
  end if;
  return new;
end;
$$;

create trigger bookings_sync_court_status
  after update of status on bookings
  for each row execute function sync_booking_courts_status();

create table booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  -- Snapshots so historical bookings survive catalog edits.
  name_snapshot text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity smallint not null default 1 check (quantity > 0),
  line_total_cents integer generated always as (unit_price_cents * quantity) stored,
  created_at timestamptz not null default now()
);

create index booking_items_booking_idx on booking_items (booking_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  method payment_method not null,
  status payment_status not null default 'pending',
  amount_cents integer not null check (amount_cents >= 0),
  -- Gateway/reference id. Null for cash and pay-at-venue.
  external_reference text,
  paid_at timestamptz,
  refunded_at timestamptz,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_booking_idx on payments (booking_id);

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();
