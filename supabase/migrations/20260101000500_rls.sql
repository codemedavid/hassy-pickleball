-- Row level security. Default posture: deny. Catalog data is publicly readable
-- because the booking flow is guest-first; everything else is staff-only, with
-- customers reaching their own bookings through find_booking_by_reference().

alter table clubs enable row level security;
alter table courts enable row level security;
alter table pricing_rules enable row level security;
alter table availability_blocks enable row level security;
alter table products enable row level security;
alter table staff enable row level security;
alter table customers enable row level security;
alter table bookings enable row level security;
alter table booking_courts enable row level security;
alter table booking_items enable row level security;
alter table payments enable row level security;

-- Catalog: readable by anyone, writable by staff.

create policy clubs_public_read on clubs
  for select using (true);

create policy clubs_staff_write on clubs
  for all using (is_club_admin(id)) with check (is_club_admin(id));

create policy courts_public_read on courts
  for select using (is_active or is_staff(club_id));

create policy courts_staff_write on courts
  for all using (is_staff(club_id)) with check (is_staff(club_id));

create policy products_public_read on products
  for select using (is_active or is_staff(club_id));

create policy products_staff_write on products
  for all using (is_staff(club_id)) with check (is_staff(club_id));

-- Pricing rules drive quoted prices, so the public may read the active set.
create policy pricing_rules_public_read on pricing_rules
  for select using (is_active or is_staff(club_id));

create policy pricing_rules_staff_write on pricing_rules
  for all using (is_staff(club_id)) with check (is_staff(club_id));

-- Availability blocks must be visible publicly or the calendar would offer
-- slots that cannot be booked. Only the window is exposed, never the reason
-- text — that is filtered in the query layer for non-staff callers.
create policy availability_blocks_public_read on availability_blocks
  for select using (true);

create policy availability_blocks_staff_write on availability_blocks
  for all
  using (exists (select 1 from courts c where c.id = court_id and is_staff(c.club_id)))
  with check (exists (select 1 from courts c where c.id = court_id and is_staff(c.club_id)));

-- Staff directory: a member may read their own row; admins manage the club's.

create policy staff_self_read on staff
  for select using (user_id = auth.uid() or is_club_admin(club_id));

create policy staff_admin_write on staff
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

-- Customers: own record via linked auth user, otherwise staff only.

create policy customers_self_read on customers
  for select using (auth_user_id = auth.uid() or is_staff(club_id));

create policy customers_staff_write on customers
  for all using (is_staff(club_id)) with check (is_staff(club_id));

-- Bookings: no anonymous SELECT policy by design. Guests read their booking
-- through find_booking_by_reference(), which requires reference + email.

create policy bookings_owner_read on bookings
  for select using (
    is_staff(club_id)
    or exists (
      select 1 from customers c
      where c.id = bookings.customer_id and c.auth_user_id = auth.uid()
    )
  );

create policy bookings_staff_write on bookings
  for all using (is_staff(club_id)) with check (is_staff(club_id));

create policy booking_courts_owner_read on booking_courts
  for select using (
    exists (select 1 from bookings b where b.id = booking_id and (
      is_staff(b.club_id)
      or exists (
        select 1 from customers c
        where c.id = b.customer_id and c.auth_user_id = auth.uid()
      )
    ))
  );

create policy booking_courts_staff_write on booking_courts
  for all
  using (exists (select 1 from bookings b where b.id = booking_id and is_staff(b.club_id)))
  with check (exists (select 1 from bookings b where b.id = booking_id and is_staff(b.club_id)));

create policy booking_items_owner_read on booking_items
  for select using (
    exists (select 1 from bookings b where b.id = booking_id and (
      is_staff(b.club_id)
      or exists (
        select 1 from customers c
        where c.id = b.customer_id and c.auth_user_id = auth.uid()
      )
    ))
  );

create policy booking_items_staff_write on booking_items
  for all
  using (exists (select 1 from bookings b where b.id = booking_id and is_staff(b.club_id)))
  with check (exists (select 1 from bookings b where b.id = booking_id and is_staff(b.club_id)));

-- Payments are staff-only in both directions; customers see totals on the booking.
create policy payments_staff_all on payments
  for all
  using (exists (select 1 from bookings b where b.id = booking_id and is_staff(b.club_id)))
  with check (exists (select 1 from bookings b where b.id = booking_id and is_staff(b.club_id)));
