"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CURRENCIES, STAGES, type Currency, type Stage } from "@/lib/calc";
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
  batchName: string;
  arrivedAt: string;
  truckNumber: string;
  trailerNumber: string;
  driverPhone: string;
  leftKhorgosAt: string;
  enteredTashkentAt: string;
  goodsPaidUsd: number;
  notes: string;
  usdCny: number;
  usdUzs: number;
  items: { name: string; boxes: number; kgPerBox: number; piecesPerBox: number | null; priceCny: number }[];
  expenses: { stage: Stage; name: string; note: string; amount: number; currency: Currency }[];
};

export type SaveResult = { ok: true; id: string } | { ok: false; error: ErrorKey };

const isPositive = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
const isNonNegative = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const isText = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isOptionalDate = (v: unknown) => v === "" || isDate(v);

function validate(p: TruckPayload): ErrorKey | null {
  if (!Array.isArray(p.items) || p.items.length === 0 || p.items.length > 200) return "errNoItems";
  const itemsOk = p.items.every(
    (it) =>
      isText(it.name, 80) &&
      it.name.trim().length > 0 &&
      Number.isInteger(it.boxes) &&
      it.boxes > 0 &&
      isNonNegative(it.kgPerBox) &&
      (it.piecesPerBox === null || (Number.isInteger(it.piecesPerBox) && it.piecesPerBox > 0)) &&
      isNonNegative(it.priceCny),
  );
  if (!itemsOk) return "errBadNumber";

  const expensesOk =
    Array.isArray(p.expenses) &&
    p.expenses.length <= 200 &&
    p.expenses.every(
      (e) =>
        STAGES.includes(e.stage) &&
        isText(e.name, 80) &&
        e.name.trim().length > 0 &&
        isText(e.note, 80) &&
        isNonNegative(e.amount) &&
        CURRENCIES.includes(e.currency),
    );
  if (!expensesOk) return "errBadNumber";

  const textOk =
    isText(p.batchName, 100) &&
    isText(p.truckNumber, 40) &&
    isText(p.trailerNumber, 40) &&
    isText(p.driverPhone, 40) &&
    isText(p.notes, 2000);
  const datesOk = isDate(p.arrivedAt) && isOptionalDate(p.leftKhorgosAt) && isOptionalDate(p.enteredTashkentAt);
  if (!textOk || !datesOk) return "errBadNumber";
  if (!isNonNegative(p.goodsPaidUsd) || !isPositive(p.usdCny) || !isPositive(p.usdUzs)) return "errBadNumber";
  return null;
}

export async function saveTruck(payload: TruckPayload): Promise<SaveResult> {
  const error = validate(payload);
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const { data, error: dbError } = await supabase.rpc("save_truck_v2", {
    p_id: payload.id,
    p_truck: {
      batch_name: payload.batchName.trim(),
      arrived_at: payload.arrivedAt,
      truck_number: payload.truckNumber.trim(),
      trailer_number: payload.trailerNumber.trim(),
      driver_phone: payload.driverPhone.trim(),
      left_khorgos_at: payload.leftKhorgosAt,
      entered_tashkent_at: payload.enteredTashkentAt,
      goods_paid_usd: payload.goodsPaidUsd,
      notes: payload.notes.trim(),
      usd_cny: payload.usdCny,
      usd_uzs: payload.usdUzs,
    },
    p_items: payload.items.map((it) => ({
      fruit_name: it.name.trim(),
      boxes: it.boxes,
      kg_per_box: it.kgPerBox,
      pieces_per_box: it.piecesPerBox,
      price_per_box_cny: it.priceCny,
    })),
    p_expenses: payload.expenses.map((e) => ({
      stage: e.stage,
      name: e.name.trim(),
      note: e.note.trim(),
      amount: e.amount,
      currency: e.currency,
    })),
  });

  if (dbError || typeof data !== "string") {
    console.error("save_truck_v2 failed:", dbError);
    return { ok: false, error: "errSave" };
  }

  revalidatePath("/", "layout");
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
