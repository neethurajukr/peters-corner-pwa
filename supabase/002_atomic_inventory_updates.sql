-- Peter's Corner phase 2: atomic compare-and-swap inventory updates.
-- Run in Supabase SQL Editor. Existing inventory and sales are untouched.
-- This prevents a stale device from overwriting a newer cloud snapshot.
create or replace function public.update_shop_inventory_if_revision(
  expected_revision bigint,
  next_state jsonb
)
returns table (saved boolean, current_revision bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_revision bigint;
  actual_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update shop inventory';
  end if;
  if jsonb_typeof(next_state) <> 'object'
     or jsonb_typeof(next_state->'products') <> 'array'
     or jsonb_typeof(next_state->'batches') <> 'array'
     or jsonb_typeof(next_state->'sales') <> 'array' then
    raise exception 'Invalid inventory format';
  end if;

  update public.shop_inventory_state
     set state = next_state,
         revision = revision + 1,
         updated_at = now()
   where owner_id = (select auth.uid())
     and revision = expected_revision
   returning revision into new_revision;

  if found then
    return query select true, new_revision;
  else
    select revision into actual_revision
      from public.shop_inventory_state
     where owner_id = (select auth.uid());
    return query select false, actual_revision;
  end if;
end;
$$;

revoke all on function public.update_shop_inventory_if_revision(bigint,jsonb) from public;
revoke all on function public.update_shop_inventory_if_revision(bigint,jsonb) from anon;
grant execute on function public.update_shop_inventory_if_revision(bigint,jsonb) to authenticated;
