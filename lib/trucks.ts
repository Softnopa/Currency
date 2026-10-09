import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateShipment, type Currency, type ShipmentResult, type Stage } from "./calc";

export type TruckItemRow = {
  fruit_name: string;
  boxes: number;
  kg_per_box: number;
  pieces_per_box: number | null;
  price_per_box_cny: number;
  position: number;
};

export type TruckExpenseRow = {
  stage: Stage;
  name: string;
  note: string;
  amount: number;
  currency: Currency;
  position: number;
};

export type TruckRow = {
  id: string;
  batch_name: string;
  arrived_at: string;
  truck_number: string;
  trailer_number: string;
  driver_phone: string;
  left_khorgos_at: string | null;
  entered_tashkent_at: string | null;
  goods_paid_usd: number;
  notes: string;
  usd_cny: number;
  usd_uzs: number;
  archived_at: string | null;
  truck_items: TruckItemRow[];
  truck_expenses: TruckExpenseRow[];
};

/** Which trucks to list: the normal history, the archive, or everything. */
export type TruckFilter = "active" | "archived" | "all";

const TRUCK_COLUMNS = `
  id, batch_name, arrived_at, truck_number, trailer_number, driver_phone,
  left_khorgos_at, entered_tashkent_at, goods_paid_usd, notes, usd_cny, usd_uzs, archived_at,
  truck_items (fruit_name, boxes, kg_per_box, pieces_per_box, price_per_box_cny, position),
  truck_expenses (stage, name, note, amount, currency, position)`;

function sortChildren(truck: TruckRow): TruckRow {
  return {
    ...truck,
    truck_items: [...truck.truck_items].sort((a, b) => a.position - b.position),
    truck_expenses: [...truck.truck_expenses].sort((a, b) => a.position - b.position),
  };
}

export async function listTrucks(
  supabase: SupabaseClient,
  filter: TruckFilter = "active",
  limit = 200,
): Promise<TruckRow[]> {
  let query = supabase.from("trucks").select(TRUCK_COLUMNS);
  if (filter === "active") query = query.is("archived_at", null);
  if (filter === "archived") query = query.not("archived_at", "is", null);

  const { data, error } = await query
    .order("arrived_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as TruckRow[]).map(sortChildren);
}

export async function getTruck(supabase: SupabaseClient, id: string): Promise<TruckRow | null> {
  const { data, error } = await supabase.from("trucks").select(TRUCK_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? sortChildren(data as unknown as TruckRow) : null;
}

/** Names typed before, offered as suggestions in the form. */
export async function listSuggestions(supabase: SupabaseClient) {
  const [items, expenses] = await Promise.all([
    supabase.from("truck_items").select("fruit_name").limit(2000),
    supabase.from("truck_expenses").select("name").limit(2000),
  ]);
  const unique = (values: string[]) =>
    [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return {
    productNames: unique((items.data ?? []).map((r) => r.fruit_name)),
    expenseNames: unique((expenses.data ?? []).map((r) => r.name)),
  };
}

export function calculateSavedTruck(truck: TruckRow): ShipmentResult {
  return calculateShipment({
    items: truck.truck_items.map((it) => ({
      name: it.fruit_name,
      boxes: it.boxes,
      kgPerBox: it.kg_per_box,
      piecesPerBox: it.pieces_per_box,
      priceCny: it.price_per_box_cny,
    })),
    expenses: truck.truck_expenses.map((e) => ({
      stage: e.stage,
      name: e.name,
      note: e.note,
      amount: e.amount,
      currency: e.currency,
    })),
    goodsPaidUsd: truck.goods_paid_usd,
    rates: { usdCny: truck.usd_cny, usdUzs: truck.usd_uzs },
  });
}

/** A short title for lists: batch name, else truck number, else a placeholder. */
export function truckTitle(truck: Pick<TruckRow, "batch_name" | "truck_number">, untitled: string) {
  return truck.batch_name || truck.truck_number || untitled;
}
