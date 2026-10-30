-- Peter's Corner: secure starting point for cloud sync.
-- Run once in Supabase SQL Editor. No existing local device data is changed.
create table if not exists public.shop_inventory_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{"products":[],"batches":[],"sales":[],"importedInvoices":[]}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.shop_inventory_state enable row level security;
revoke all on public.shop_inventory_state from anon;
grant select, insert, update on public.shop_inventory_state to authenticated;
create policy "Shop owner reads own inventory"
  on public.shop_inventory_state for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Shop owner creates own inventory"
  on public.shop_inventory_state for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Shop owner updates own inventory"
  on public.shop_inventory_state for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
-- A later app update will add guarded revision writes and a deliberate
-- one-time migration from browser localStorage to this cloud table.
