-- Backs the court detail page redesign.
--
-- Three shape changes, all driven by what the design renders and the schema
-- could not previously supply:
--
--   1. "Good to know" is a list of separate lines, not one paragraph, so
--      courts.notes becomes text[] alongside the existing tags/includes arrays.
--   2. The booking sidebar shows a desk phone, a cancellation window, and a
--      group-booking note. Those are club policy, so they live on clubs rather
--      than being hardcoded in the page.
--   3. The duration picker offers 30 minute sessions, which the previous
--      60 minute floor would have rejected in getAvailability.

-- 1. Notes: scalar text -> text[].
-- Existing single notes become one-element arrays so no copy is lost.
alter table courts
  alter column notes drop default,
  alter column notes type text[]
    using case
      when notes is null or btrim(notes) = '' then '{}'::text[]
      else array[notes]
    end;

alter table courts
  alter column notes set default '{}',
  alter column notes set not null;

comment on column courts.notes is
  'One "Good to know" line per element. Rendered as a list on the court detail page.';

-- 2. Storefront policy copy the booking sidebar reads.
alter table clubs
  add column phone text,
  add column cancellation_window_hours smallint not null default 12,
  add column group_booking_note text;

alter table clubs
  add constraint clubs_cancellation_window_bounded
    check (cancellation_window_hours between 0 and 168);

comment on column clubs.cancellation_window_hours is
  'Hours before start that a booking can still be cancelled free. Shown under the booking CTA.';

-- 3. Allow 30 minute sessions. slot_minutes already defaults to 30, so the
-- slot grid needs no change — only the floor that availability validates.
alter table clubs
  alter column min_duration_minutes set default 30;

update clubs
  set min_duration_minutes = 30
  where min_duration_minutes = 60;
