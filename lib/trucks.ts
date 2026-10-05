import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateTruck, type Currency, type TruckResult } from "./calc";

export type TruckItemRow = {
  fruit_name: string;
  boxes: number;
  price_per_box_cny: number;
  position: number;
};

export type TruckRow = {
  id: string;
  arrived_at: string;
  label: string;
  expense_amount: number;
  expense_currency: Currency;
  usd_cny: number;
  usd_uzs: number;
  archived_at: string | null;
  truck_items: TruckItemRow[];
};

/** Which trucks to list: the normal history, the archive, or everything. */
export type TruckFilter = "active" | "archived" | "all";

const TRUCK_COLUMNS =
  "id, arrived_at, label, expense_amount, expense_currency, usd_cny, usd_uzs, archived_at, truck_items (fruit_name, boxes, price_per_box_cny, position)";

function sortItems(truck: TruckRow): TruckRow {
  return { ...truck, truck_items: [...truck.truck_items].sort((a, b) => a.position - b.position) };
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
  return (data as TruckRow[]).map(sortItems);
}

export async function getTruck(supabase: SupabaseClient, id: string): Promise<TruckRow | null> {
  const { data, error } = await supabase.from("trucks").select(TRUCK_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? sortItems(data as TruckRow) : null;
}

/** Fruit names typed before, offered as suggestions. */
export async function listFruitNames(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("truck_items").select("fruit_name").limit(1000);
  const names = new Set((data ?? []).map((r) => r.fruit_name.trim()).filter(Boolean));
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function calculateSavedTruck(truck: TruckRow): TruckResult {
  return calculateTruck({
    items: truck.truck_items.map((it) => ({
      fruitName: it.fruit_name,
      boxes: it.boxes,
      pricePerBoxCny: it.price_per_box_cny,
    })),
    expenseAmount: truck.expense_amount,
    expenseCurrency: truck.expense_currency,
    rates: { usdCny: truck.usd_cny, usdUzs: truck.usd_uzs },
  });
}
