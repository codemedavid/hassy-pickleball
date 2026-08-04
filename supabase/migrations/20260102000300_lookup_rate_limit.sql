-- Rate limit for guest booking lookup.
--
-- find_booking_by_reference is enumerable given a valid reference: the action
-- returns an identical message for a wrong reference and a wrong email, which
-- stops it confirming that a reference exists, but nothing stopped a caller
-- from grinding through the keyspace. This bounds attempts per identity.

create table booking_lookup_attempts (
  id bigserial primary key,
  -- Whatever the caller is identified by: email, or a hashed client address.
  identity text not null,
  attempted_at timestamptz not null default now()
);

create index booking_lookup_attempts_identity_idx
  on booking_lookup_attempts (identity, attempted_at desc);

alter table booking_lookup_attempts enable row level security;
-- No policy: only service_role, which bypasses RLS, may touch this table.

/*
 * Records an attempt and reports whether the caller is still under the limit.
 * Returns false once the window is exhausted, so the caller refuses the lookup.
 * The attempt is recorded either way — otherwise a blocked caller would decay
 * back under the limit while still hammering the endpoint.
 */
create or replace function record_lookup_attempt(
  p_identity text,
  p_limit integer default 10,
  p_window interval default interval '15 minutes'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent integer;
begin
  insert into booking_lookup_attempts (identity) values (p_identity);

  select count(*) into v_recent
  from booking_lookup_attempts
  where identity = p_identity
    and attempted_at > now() - p_window;

  -- Opportunistic cleanup so the table cannot grow without bound.
  delete from booking_lookup_attempts
  where attempted_at < now() - interval '1 day';

  return v_recent <= p_limit;
end;
$$;

revoke all on function record_lookup_attempt(text, integer, interval) from public, anon, authenticated;
grant execute on function record_lookup_attempt(text, integer, interval) to service_role;
