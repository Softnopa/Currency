-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Everyone who can log in is family/staff, so all logged-in users share the same trucks.
-- Visitors who are not logged in can see nothing.

-- ── Daily exchange rates ─────────────────────────────────────────────
create table if not exists public.exchange_rates (
  rate_date  date primary key,
  usd_uzs    numeric not null check (usd_uzs > 0),
  cny_uzs    numeric not null check (cny_uzs > 0),
  source     text not null,
  fetched_at timestamptz not null default now()
);

alter table public.exchange_rates enable row level security;

create policy "logged-in users read rates" on public.exchange_rates
  for select to authenticated using (true);
create policy "logged-in users store rates" on public.exchange_rates
  for insert to authenticated with check (true);
create policy "logged-in users refresh rates" on public.exchange_rates
  for update to authenticated using (true) with check (true);

-- ── Trucks ───────────────────────────────────────────────────────────
create table if not exists public.trucks (
  id               uuid primary key default gen_random_uuid(),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  arrived_at       date not null default current_date,
  label            text not null default '',
  expense_amount   numeric not null default 0 check (expense_amount >= 0),
  expense_currency text not null default 'USD' check (expense_currency in ('CNY', 'USD', 'UZS')),
  -- Rates are saved with the truck so old trucks keep the rate of their day.
  usd_cny          numeric not null check (usd_cny > 0),
  usd_uzs          numeric not null check (usd_uzs > 0),
  archived_at      timestamptz, -- set when the truck is moved to the archive
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.truck_items (
  id                uuid primary key default gen_random_uuid(),
  truck_id          uuid not null references public.trucks (id) on delete cascade,
  position          integer not null default 0,
  fruit_name        text not null check (length(trim(fruit_name)) > 0),
  boxes             integer not null check (boxes > 0),
  price_per_box_cny numeric not null check (price_per_box_cny >= 0)
);

create index if not exists trucks_arrived_at_idx on public.trucks (arrived_at desc, created_at desc);
create index if not exists truck_items_truck_id_idx on public.truck_items (truck_id);

alter table public.trucks enable row level security;
alter table public.truck_items enable row level security;

create policy "logged-in users manage trucks" on public.trucks
  for all to authenticated using (true) with check (true);
create policy "logged-in users manage truck items" on public.truck_items
  for all to authenticated using (true) with check (true);

-- ── Save a truck and its fruits in one transaction ───────────────────
create or replace function public.save_truck(p_id uuid, p_truck jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into trucks (arrived_at, label, expense_amount, expense_currency, usd_cny, usd_uzs)
    values (
      (p_truck->>'arrived_at')::date,
      p_truck->>'label',
      (p_truck->>'expense_amount')::numeric,
      p_truck->>'expense_currency',
      (p_truck->>'usd_cny')::numeric,
      (p_truck->>'usd_uzs')::numeric
    )
    returning id into v_id;
  else
    update trucks set
      arrived_at       = (p_truck->>'arrived_at')::date,
      label            = p_truck->>'label',
      expense_amount   = (p_truck->>'expense_amount')::numeric,
      expense_currency = p_truck->>'expense_currency',
      usd_cny          = (p_truck->>'usd_cny')::numeric,
      usd_uzs          = (p_truck->>'usd_uzs')::numeric,
      updated_at       = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'truck % not found', p_id;
    end if;

    delete from truck_items where truck_id = v_id;
  end if;

  insert into truck_items (truck_id, position, fruit_name, boxes, price_per_box_cny)
  select v_id, (t.ord - 1)::integer, t.e->>'fruit_name', (t.e->>'boxes')::integer, (t.e->>'price_per_box_cny')::numeric
  from jsonb_array_elements(p_items) with ordinality as t(e, ord);

  return v_id;
end;
$$;

revoke execute on function public.save_truck(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_truck(uuid, jsonb, jsonb) to authenticated;
