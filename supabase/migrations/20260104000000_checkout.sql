-- Guest checkout: how a club says it wants to be paid, and how a guest proves
-- they paid.
--
-- The club settles manually (GCash, bank transfer, cash at the desk), so the
-- two things missing were a place to publish the account details and a place to
-- keep the screenshot the desk verifies against.

-- ---------------------------------------------------------------------------
-- Publishable payment instructions, one row per method a club accepts.
--
-- Separate from the `payment_method` enum rather than replacing it: the enum is
-- the settlement channel a payment lands in and is referenced by `payments`,
-- while these rows are editable copy — a club may accept GCash on two numbers,
-- or rename "Cash" to "Pay at the desk", without a migration.
-- ---------------------------------------------------------------------------
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs (id) on delete cascade,
  method payment_method not null,
  label text not null,
  -- Account holder and number as the guest must type them into their wallet.
  account_name text,
  account_number text,
  instructions text,
  qr_image_url text,
  -- Whether checkout must carry a screenshot. False for pay-at-the-desk, where
  -- there is nothing to screenshot yet.
  requires_proof boolean not null default false,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_methods_club_idx on payment_methods (club_id, sort_order) where is_active;

create trigger payment_methods_set_updated_at
  before update on payment_methods
  for each row execute function set_updated_at();

alter table payment_methods enable row level security;

-- Instructions are meant to be read by anyone about to pay; only staff edit them.
create policy payment_methods_public_read on payment_methods
  for select
  to anon, authenticated
  using (is_active);

create policy payment_methods_staff_write on payment_methods
  for all
  to authenticated
  using (is_club_admin(club_id))
  with check (is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- The proof itself. An ImageKit file path, not a URL: the file is uploaded
-- private, so the desk views it through a signed link that expires rather than
-- a guessable permanent one.
--
-- Images live in ImageKit rather than Supabase Storage, so there is no bucket
-- to create here. Uploads go through the checkout server action, which has
-- already validated the file's type and size — a store a browser can write to
-- directly is an open file drop.
-- ---------------------------------------------------------------------------
alter table payments add column proof_url text;
