-- Staff-facing payment method management and atomic checkout ordering.

drop policy if exists payment_methods_staff_write on payment_methods;

create policy payment_methods_staff_write on payment_methods
  for all
  to authenticated
  using (is_staff(club_id))
  with check (is_staff(club_id));

create or replace function move_payment_method(
  p_method_id uuid,
  p_direction text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_method payment_methods%rowtype;
  v_neighbor payment_methods%rowtype;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'Direction must be up or down' using errcode = '22023';
  end if;

  select * into v_method
  from payment_methods
  where id = p_method_id;

  if not found then
    raise exception 'Payment method not found' using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select * into v_neighbor
    from payment_methods
    where club_id = v_method.club_id
      and (sort_order, id) < (v_method.sort_order, v_method.id)
    order by sort_order desc, id desc
    limit 1;
  else
    select * into v_neighbor
    from payment_methods
    where club_id = v_method.club_id
      and (sort_order, id) > (v_method.sort_order, v_method.id)
    order by sort_order asc, id asc
    limit 1;
  end if;

  if not found then
    return;
  end if;

  update payment_methods
  set sort_order = case id
    when v_method.id then v_neighbor.sort_order
    when v_neighbor.id then v_method.sort_order
  end
  where id in (v_method.id, v_neighbor.id);
end;
$$;

revoke all on function move_payment_method(uuid, text) from public, anon;
grant execute on function move_payment_method(uuid, text) to authenticated;

create or replace function set_payment_method_active(
  p_method_id uuid,
  p_is_active boolean,
  p_acknowledge_checkout_pause boolean default false
)
returns payment_methods
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_method payment_methods%rowtype;
  v_active_count integer;
begin
  select * into v_method
  from payment_methods
  where id = p_method_id;

  if not found then
    raise exception 'Payment method not found' using errcode = 'P0002';
  end if;

  -- Serialize status changes for this club before counting active rows.
  perform id
  from payment_methods
  where club_id = v_method.club_id
  for update;

  if v_method.is_active and not p_is_active and not p_acknowledge_checkout_pause then
    select count(*) into v_active_count
    from payment_methods
    where club_id = v_method.club_id and is_active;

    if v_active_count <= 1 then
      raise exception 'Hiding this method would pause online checkout' using errcode = 'P0001';
    end if;
  end if;

  update payment_methods
  set is_active = p_is_active
  where id = p_method_id
  returning * into v_method;

  return v_method;
end;
$$;

revoke all on function set_payment_method_active(uuid, boolean, boolean) from public, anon;
grant execute on function set_payment_method_active(uuid, boolean, boolean) to authenticated;
