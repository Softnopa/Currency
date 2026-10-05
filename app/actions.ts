"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENCIES, type Currency } from "@/lib/calc";
import { LANG_COOKIE, parseLang, type ErrorKey } from "@/lib/i18n";
import { parsePrefs, PREFS_COOKIE, type Prefs } from "@/lib/prefs";
import { createClient } from "@/lib/supabase/server";

// ── Auth ──────────────────────────────────────────────────────────────

export async function login(_prev: { error: boolean }, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: true };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ── Language ──────────────────────────────────────────────────────────

export async function setLang(lang: string) {
  const cookieStore = await cookies();
  cookieStore.set(LANG_COOKIE, parseLang(lang), { maxAge: 60 * 60 * 24 * 365, path: "/" });
}

// ── Trucks ────────────────────────────────────────────────────────────

export type TruckPayload = {
  id: string | null;
  arrivedAt: string;
  label: string;
  expenseAmount: number;
  expenseCurrency: Currency;
  usdCny: number;
  usdUzs: number;
  items: { fruitName: string; boxes: number; pricePerBoxCny: number }[];
};

export type SaveResult = { ok: true; id: string } | { ok: false, error: ErrorKey };

const isPositive = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
const isNonNegative = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;

function validate(p: TruckPayload): ErrorKey | null {
  if (!Array.isArray(p.items) || p.items.length === 0 || p.items.length > 100) return "errNoItems";
  const itemsOk = p.items.every(
    (it) =>
      typeof it.fruitName === "string" &&
      it.fruitName.trim().length > 0 &&
      it.fruitName.length <= 80 &&
      Number.isInteger(it.boxes) &&
      it.boxes > 0 &&
      isNonNegative(it.pricePerBoxCny),
  );
  if (!itemsOk) return "errBadNumber";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.arrivedAt)) return "errBadNumber";
  if (!CURRENCIES.includes(p.expenseCurrency)) return "errBadNumber";
  if (!isNonNegative(p.expenseAmount) || !isPositive(p.usdCny) || !isPositive(p.usdUzs)) return "errBadNumber";
  return null;
}

export async function saveTruck(payload: TruckPayload): Promise<SaveResult> {
  const error = validate(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const { data, error: dbError } = await supabase.rpc("save_truck", {
    p_id: payload.id,
    p_truck: {
      arrived_at: payload.arrivedAt,
      label: String(payload.label ?? "").trim().slice(0, 100),
      expense_amount: payload.expenseAmount,
      expense_currency: payload.expenseCurrency,
      usd_cny: payload.usdCny,
      usd_uzs: payload.usdUzs,
    },
    p_items: payload.items.map((it) => ({
      fruit_name: it.fruitName.trim(),
      boxes: it.boxes,
      price_per_box_cny: it.pricePerBoxCny,
    })),
  });

  if (dbError || typeof data !== "string") {
    console.error("save_truck failed:", dbError);
    return { ok: false, error: "errSave" };
  }

  revalidatePath("/trucks");
  return { ok: true, id: data };
}

export async function deleteTruck(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("trucks").delete().eq("id", id);
  if (error) {
    console.error("delete truck failed:", error);
    return { ok: false as const };
  }
  revalidatePath("/trucks");
  redirect("/trucks");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 500 && ids.every((id) => UUID.test(id));
}

export async function setTrucksArchived(ids: string[], archived: boolean) {
  if (!validIds(ids)) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase
    .from("trucks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) {
    console.error("archive trucks failed:", error);
    return { ok: false as const };
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function deleteTrucks(ids: string[]) {
  if (!validIds(ids)) return { ok: false as const };
  const supabase = await createClient();
  const { error } = await supabase.from("trucks").delete().in("id", ids);
  if (error) {
    console.error("delete trucks failed:", error);
    return { ok: false as const };
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

// ── Settings ──────────────────────────────────────────────────────────

export async function savePrefs(patch: Partial<Prefs>) {
  const cookieStore = await cookies();
  const current = parsePrefs(cookieStore.get(PREFS_COOKIE)?.value);
  const next = parsePrefs({ ...current, ...patch });
  cookieStore.set(PREFS_COOKIE, JSON.stringify(next), { maxAge: 60 * 60 * 24 * 365, path: "/" });
}

export type PasswordState = { status: "idle" } | { status: "ok" } | { status: "error"; error: ErrorKey };

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 6) return { status: "error", error: "errPasswordShort" };
  if (password !== confirm) return { status: "error", error: "errPasswordMismatch" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("change password failed:", error);
    return { status: "error", error: error.code === "weak_password" ? "errPasswordShort" : "errGeneric" };
  }
  return { status: "ok" };
}
