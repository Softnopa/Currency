import { allTrucksWorkbook, xlsxResponse } from "@/lib/excel";
import { todayInTashkent } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { listTrucks } from "@/lib/trucks";

export const dynamic = "force-dynamic";

/** Every truck (archive included): a summary sheet plus one sheet per truck. */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("unauthorized", { status: 401 });

  const [t, trucks] = await Promise.all([getT(), listTrucks(supabase, "all", 1000)]);
  const body = await allTrucksWorkbook(trucks, t);
  return xlsxResponse(body, `mashinalar-${todayInTashkent()}.xlsx`);
}
