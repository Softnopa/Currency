import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RateSource = "cbu" | "er-api";

export type LiveRates = {
  rateDate: string; // YYYY-MM-DD the rate is valid for
  usdUzs: number;
  cnyUzs: number;
  source: RateSource;
};

export type LatestRates = LiveRates & {
  usdCny: number;
  fetchedAt: string;
};

const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";
const FALLBACK_URL = "https://open.er-api.com/v6/latest/USD";
/** Re-check the bank this often when someone opens the site (cron also runs daily). */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

type CbuRow = { Ccy: string; Rate: string; Nominal: string; Date: string };

async function fetchCbu(): Promise<LiveRates> {
  const res = await fetch(CBU_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`CBU responded ${res.status}`);
  const rows = (await res.json()) as CbuRow[];

  const find = (ccy: string) => {
    const row = rows.find((r) => r.Ccy === ccy);
    const rate = row ? Number(row.Rate) / Number(row.Nominal) : NaN;
    if (!row || !(rate > 0)) throw new Error(`CBU has no valid ${ccy} rate`);
    return row;
  };
  const usd = find("USD");
  const cny = find("CNY");
  const [d, m, y] = usd.Date.split(".");

  return {
    rateDate: `${y}-${m}-${d}`,
    usdUzs: Number(usd.Rate) / Number(usd.Nominal),
    cnyUzs: Number(cny.Rate) / Number(cny.Nominal),
    source: "cbu",
  };
}

async function fetchFallback(): Promise<LiveRates> {
  const res = await fetch(FALLBACK_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`er-api responded ${res.status}`);
  const data = (await res.json()) as { rates: Record<string, number>; time_last_update_unix: number };
  const { UZS, CNY } = data.rates;
  if (!(UZS > 0) || !(CNY > 0)) throw new Error("er-api has no UZS/CNY rate");

  return {
    rateDate: new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10),
    usdUzs: UZS,
    cnyUzs: UZS / CNY,
    source: "er-api",
  };
}

/** Central Bank of Uzbekistan first; an international source if it is down. */
export async function fetchLiveRates(): Promise<LiveRates> {
  try {
    return await fetchCbu();
  } catch (err) {
    console.error("CBU rates failed, using fallback:", err);
    return fetchFallback();
  }
}

export async function storeRates(supabase: SupabaseClient, rates: LiveRates) {
  const { error } = await supabase.from("exchange_rates").upsert({
    rate_date: rates.rateDate,
    usd_uzs: rates.usdUzs,
    cny_uzs: rates.cnyUzs,
    source: rates.source,
    fetched_at: new Date().toISOString(),
  });
  if (error) throw error;
}

function withUsdCny(rates: LiveRates, fetchedAt: string): LatestRates {
  return { ...rates, usdCny: rates.usdUzs / rates.cnyUzs, fetchedAt };
}

/**
 * Latest stored rates. If they are older than a few hours (or missing),
 * fetches fresh ones from the bank and stores them.
 */
export async function getLatestRates(supabase: SupabaseClient): Promise<LatestRates | null> {
  const { data } = await supabase
    .from("exchange_rates")
    .select("rate_date, usd_uzs, cny_uzs, source, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const stored = data
    ? withUsdCny(
        { rateDate: data.rate_date, usdUzs: data.usd_uzs, cnyUzs: data.cny_uzs, source: data.source },
        data.fetched_at,
      )
    : null;

  if (stored && Date.now() - new Date(stored.fetchedAt).getTime() < MAX_AGE_MS) {
    return stored;
  }

  try {
    const live = await fetchLiveRates();
    await storeRates(supabase, live).catch((err) => console.error("Could not store rates:", err));
    return withUsdCny(live, new Date().toISOString());
  } catch (err) {
    console.error("Could not fetch live rates:", err);
    return stored;
  }
}
