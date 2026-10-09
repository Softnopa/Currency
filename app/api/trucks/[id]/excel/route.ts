import { truckWorkbook, xlsxResponse } from "@/lib/excel";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { getTruck, truckTitle } from "@/lib/trucks";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One truck as an Excel file in the layout of the original sheet. */
export async function GET(_request: Request, { params }: RouteContext<"/api/trucks/[id]/excel">) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("not found", { status: 404 });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("unauthorized", { status: 401 });

  const [t, truck] = await Promise.all([getT(), getTruck(supabase, id)]);
  if (!truck) return new Response("not found", { status: 404 });

  const body = await truckWorkbook(truck, t);
  const name = `${truck.arrived_at} ${truckTitle(truck, t.untitled)}`.replace(/[\\/:*?"<>|]/g, "-");
  return xlsxResponse(body, `${name}.xlsx`);
}
