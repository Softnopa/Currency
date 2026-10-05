import { fetchLiveRates, storeRates } from "@/lib/rates";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Called once a day by Vercel Cron (see vercel.json). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const rates = await fetchLiveRates();
    await storeRates(createAdminClient(), rates);
    return Response.json({ ok: true, rates });
  } catch (err) {
    console.error("Rate refresh failed:", err);
    return Response.json({ ok: false }, { status: 502 });
  }
}
