import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { getPrefs, getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { calculateSavedTruck, listTrucks } from "@/lib/trucks";
import { AccountForm } from "./AccountForm";
import { PreferencesForm } from "./PreferencesForm";
import { TruckManager, type ManagedTruck } from "./TruckManager";

export default async function SettingsPage() {
  const supabase = await createClient();
  const [t, prefs, trucks, claims] = await Promise.all([
    getT(),
    getPrefs(),
    listTrucks(supabase, "all", 500),
    supabase.auth.getClaims(),
  ]);

  const managed: ManagedTruck[] = trucks.map((truck) => ({
    id: truck.id,
    date: formatDate(truck.arrived_at),
    label: truck.label,
    fruits: truck.truck_items
      .map((it) => `${it.fruit_name} · ${formatCount(it.boxes)} ${t.boxesShort}`)
      .join(", "),
    total: formatMoney(calculateSavedTruck(truck).grand.UZS, "UZS", t.som),
    archived: truck.archived_at !== null,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">⚙️ {t.settings}</h1>
      <PreferencesForm initial={prefs} />
      <TruckManager trucks={managed} />
      <AccountForm email={String(claims.data?.claims.email ?? "")} />
    </div>
  );
}
