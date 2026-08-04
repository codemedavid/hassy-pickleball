-- Core catalog tables: clubs, courts, pricing rules, availability blocks, products.
-- All money is stored as integer minor units (centavos) to avoid float drift.
-- All instants are timestamptz (UTC); club-local rendering uses clubs.timezone.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Asia/Manila',
  currency char(3) not null default 'PHP',
  opens_at time not null default '06:00',
  closes_at time not null default '22:00',
  slot_minutes smallint not null default 30 check (slot_minutes in (15, 30, 60)),
  min_duration_minutes smallint not null default 60,
  max_duration_minutes smallint not null default 240,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clubs_hours_ordered check (closes_at > opens_at),
  constraint clubs_duration_ordered check (max_duration_minutes >= min_duration_minutes)
);

create trigger clubs_set_updated_at
  before update on clubs
  for each row execute function set_updated_at();

create table courts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  name text not null,
  slug text not null,
  surface text not null,
  environment court_environment not null default 'outdoor',
  is_tournament_grade boolean not null default false,
  blurb text,
  notes text,
  tags text[] not null default '{}',
  includes text[] not null default '{}',
  hero_image_url text,
  base_price_cents integer not null check (base_price_cents >= 0),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, slug)
);

create index courts_club_active_idx on courts (club_id) where is_active;

create trigger courts_set_updated_at
  before update on courts
  for each row execute function set_updated_at();

-- Pricing rules stack in `priority` order over the court's base price.
create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  court_id uuid references courts (id) on delete cascade,
  label text not null,
  days_of_week smallint[] not null default '{}',
  starts_at_time time,
  ends_at_time time,
  min_duration_minutes smallint,
  applies_to_tier customer_tier,
  kind rate_kind not null,
  value_cents integer,
  value_percent numeric(6, 3),
  priority smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_rules_window_ordered
    check (starts_at_time is null or ends_at_time is null or ends_at_time > starts_at_time),
  constraint pricing_rules_dow_valid
    check (days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  constraint pricing_rules_value_matches_kind check (
    (kind = 'percent_delta' and value_percent is not null and value_cents is null)
    or (kind in ('fixed', 'amount_delta') and value_cents is not null and value_percent is null)
  )
);

create index pricing_rules_lookup_idx on pricing_rules (club_id, priority) where is_active;

create trigger pricing_rules_set_updated_at
  before update on pricing_rules
  for each row execute function set_updated_at();

-- Staff-created holds: maintenance, leagues, private hire, closures.
create table availability_blocks (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts (id) on delete cascade,
  kind block_kind not null default 'maintenance',
  reason text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint availability_blocks_ordered check (ends_at > starts_at),
  constraint availability_blocks_no_overlap
    exclude using gist (
      court_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
);

create index availability_blocks_court_window_idx on availability_blocks (court_id, starts_at, ends_at);

-- Session add-ons and café items shown as "Add to your session" / shop rows.
create table products (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  name text not null,
  description text,
  type product_type not null,
  price_cents integer not null check (price_cents >= 0),
  has_quantity boolean not null default true,
  image_url text,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_club_type_idx on products (club_id, type) where is_active;

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();
