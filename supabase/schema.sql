-- Fresh setup: run this once in Supabase → SQL Editor → New query → paste → Run.
-- (Already set up with an older version? Run the files in supabase/migrations/ instead.)
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

-- ── Trucks (one row per shipment, like the header of the Excel sheet) ─
create table if not exists public.trucks (
  id                  uuid primary key default gen_random_uuid(),
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  batch_name          text not null default '',   -- e.g. Ассорти "10/01AT"
  arrived_at          date not null default current_date,
  truck_number        text not null default '',   -- e.g. B60307
  trailer_number      text not null default '',   -- e.g. Kz000AKD01
  driver_phone        text not null default '',
  left_khorgos_at     date,
  entered_tashkent_at date,
  goods_paid_usd      numeric not null default 0 check (goods_paid_usd >= 0),
  notes               text not null default '',
  -- Rates are saved with the truck so old trucks keep the rate of their day.
  usd_cny             numeric not null check (usd_cny > 0),
  usd_uzs             numeric not null check (usd_uzs > 0),
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.truck_items (
  id                uuid primary key default gen_random_uuid(),
  truck_id          uuid not null references public.trucks (id) on delete cascade,
  position          integer not null default 0,
  fruit_name        text not null check (length(trim(fruit_name)) > 0),
  boxes             integer not null check (boxes > 0),
  kg_per_box        numeric not null default 0 check (kg_per_box >= 0),
  pieces_per_box    integer check (pieces_per_box > 0),
  price_per_box_cny numeric not null check (price_per_box_cny >= 0)
);

create table if not exists public.truck_expenses (
  id       uuid primary key default gen_random_uuid(),
  truck_id uuid not null references public.trucks (id) on delete cascade,
  stage    text not null check (stage in ('khorgos', 'tashkent')),
  position integer not null default 0,
  name     text not null check (length(trim(name)) > 0),
  note     text not null default '',
  amount   numeric not null check (amount >= 0),
  currency text not null default 'CNY' check (currency in ('CNY', 'USD', 'UZS'))
);

create index if not exists trucks_arrived_at_idx on public.trucks (arrived_at desc, created_at desc);
create index if not exists truck_items_truck_id_idx on public.truck_items (truck_id);
create index if not exists truck_expenses_truck_id_idx on public.truck_expenses (truck_id);

alter table public.trucks enable row level security;
alter table public.truck_items enable row level security;
alter table public.truck_expenses enable row level security;

create policy "logged-in users manage trucks" on public.trucks
  for all to authenticated using (true) with check (true);
create policy "logged-in users manage truck items" on public.truck_items
  for all to authenticated using (true) with check (true);
create policy "logged-in users manage truck expenses" on public.truck_expenses
  for all to authenticated using (true) with check (true);

-- ── Save a truck with its products and expenses in one transaction ───
create or replace function public.save_truck_v2(p_id uuid, p_truck jsonb, p_items jsonb, p_expenses jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into trucks (usd_cny, usd_uzs) values ((p_truck->>'usd_cny')::numeric, (p_truck->>'usd_uzs')::numeric)
    returning id into v_id;
  else
    select id into v_id from trucks where id = p_id;
    if v_id is null then
      raise exception 'truck % not found', p_id;
    end if;
    delete from truck_items where truck_id = v_id;
    delete from truck_expenses where truck_id = v_id;
  end if;

  update trucks set
    batch_name          = p_truck->>'batch_name',
    arrived_at          = (p_truck->>'arrived_at')::date,
    truck_number        = p_truck->>'truck_number',
    trailer_number      = p_truck->>'trailer_number',
    driver_phone        = p_truck->>'driver_phone',
    left_khorgos_at     = nullif(p_truck->>'left_khorgos_at', '')::date,
    entered_tashkent_at = nullif(p_truck->>'entered_tashkent_at', '')::date,
    goods_paid_usd      = (p_truck->>'goods_paid_usd')::numeric,
    notes               = p_truck->>'notes',
    usd_cny             = (p_truck->>'usd_cny')::numeric,
    usd_uzs             = (p_truck->>'usd_uzs')::numeric,
    updated_at          = now()
  where id = v_id;

  insert into truck_items (truck_id, position, fruit_name, boxes, kg_per_box, pieces_per_box, price_per_box_cny)
  select v_id, (t.ord - 1)::integer, t.e->>'fruit_name', (t.e->>'boxes')::integer,
         (t.e->>'kg_per_box')::numeric, (t.e->>'pieces_per_box')::integer, (t.e->>'price_per_box_cny')::numeric
  from jsonb_array_elements(p_items) with ordinality as t(e, ord);

  insert into truck_expenses (truck_id, stage, position, name, note, amount, currency)
  select v_id, t.e->>'stage', (t.ord - 1)::integer, t.e->>'name', t.e->>'note',
         (t.e->>'amount')::numeric, t.e->>'currency'
  from jsonb_array_elements(p_expenses) with ordinality as t(e, ord);

  return v_id;
end;
$$;

revoke execute on function public.save_truck_v2(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_truck_v2(uuid, jsonb, jsonb, jsonb) to authenticated;
