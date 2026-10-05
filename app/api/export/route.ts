import { formatDate, todayInTashkent } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { calculateSavedTruck, listTrucks } from "@/lib/trucks";

export const dynamic = "force-dynamic";

/**
 * All trucks as a CSV that opens directly in Excel: one row per fruit plus
 * one expenses row per truck. Uses ";" and decimal commas, which is what
 * Excel expects with Uzbek/Russian regional settings.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("unauthorized", { status: 401 });

  const [t, trucks] = await Promise.all([getT(), listTrucks(supabase, "all", 5000)]);

  const num = (n: number, decimals: number) => n.toFixed(decimals).replace(".", ",");
  const cell = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = [
    t.arrivedAt,
    t.truckLabel,
    t.fruitName,
    t.boxes,
    t.pricePerBox,
    `${t.rowTotal} ¥`,
    `${t.rowTotal} $`,
    `${t.rowTotal} ${t.som}`,
    `${t.rowCostPerBox} (${t.som})`,
    t.rateCny,
    t.rateUzs,
    t.status,
  ];
  const lines = [header];

  for (const truck of trucks) {
    const r = calculateSavedTruck(truck);
    const common = [formatDate(truck.arrived_at), truck.label];
    const tail = [num(truck.usd_cny, 4), num(truck.usd_uzs, 2), truck.archived_at ? t.archived : t.active];

    r.items.forEach((it) => {
      lines.push([
        ...common,
        it.fruitName,
        String(it.boxes),
        num(it.pricePerBoxCny, 2),
        num(it.total.CNY, 2),
        num(it.total.USD, 2),
        num(it.total.UZS, 0),
        num(it.costPerBox.UZS, 0),
        ...tail,
      ]);
    });
    lines.push([
      ...common,
      t.expensesRow,
      "",
      "",
      num(r.expenses.CNY, 2),
      num(r.expenses.USD, 2),
      num(r.expenses.UZS, 0),
      "",
      ...tail,
    ]);
  }

  // BOM so Excel reads Cyrillic and "so'm" correctly.
  const csv = "﻿" + lines.map((row) => row.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mashinalar-${todayInTashkent()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
