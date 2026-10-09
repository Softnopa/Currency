-- Upgrade to the full Excel-sheet layout. Run once in Supabase → SQL Editor.
-- Safe to run again. Existing trucks are kept; their single expense becomes an expense line.

-- ── New truck details ───────────────────────────────────────────────
alter table public.trucks
  add column if not exists batch_name          text not null default '',
  add column if not exists truck_number        text not null default '',
  add column if not exists trailer_number      text not null default '',
  add column if not exists driver_phone        text not null default '',
  add column if not exists left_khorgos_at     date,
  add column if not exists entered_tashkent_at date,
  add column if not exists goods_paid_usd      numeric not null default 0 check (goods_paid_usd >= 0),
  add column if not exists notes               text not null default '';

alter table public.truck_items
  add column if not exists kg_per_box     numeric not null default 0 check (kg_per_box >= 0),
  add column if not exists pieces_per_box integer check (pieces_per_box > 0);

-- ── Expense lines (two sections: Khorgos, Khorgos → Tashkent) ─────────
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
create index if not exists truck_expenses_truck_id_idx on public.truck_expenses (truck_id);
alter table public.truck_expenses enable row level security;
drop policy if exists "logged-in users manage truck expenses" on public.truck_expenses;
create policy "logged-in users manage truck expenses" on public.truck_expenses
  for all to authenticated using (true) with check (true);

-- ── Move old data into the new shape, then drop the old columns ──────
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'trucks' and column_name = 'expense_amount') then
    insert into public.truck_expenses (truck_id, stage, position, name, amount, currency)
    select id, 'khorgos', 0, 'Xarajatlar', expense_amount, expense_currency
    from public.trucks t
    where expense_amount > 0
      and not exists (select 1 from public.truck_expenses e where e.truck_id = t.id);

    update public.trucks set batch_name = label where batch_name = '' and label <> '';

    alter table public.trucks drop column expense_amount, drop column expense_currency, drop column label;
  end if;
end $$;

drop function if exists public.save_truck(uuid, jsonb, jsonb);

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

-- Make the API see the new columns immediately.
notify pgrst, 'reload schema';
