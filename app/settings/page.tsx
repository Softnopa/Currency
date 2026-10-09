import { formatAmount, formatCount, formatDate, formatMoney } from "@/lib/format";
import { getPrefs, getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { calculateSavedTruck, listTrucks, truckTitle } from "@/lib/trucks";
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

  const managed: ManagedTruck[] = trucks.map((truck) => {
    const r = calculateSavedTruck(truck);
    return {
      id: truck.id,
      date: formatDate(truck.arrived_at),
      title: truckTitle(truck, t.untitled),
      details: [truck.truck_number, `${formatCount(r.totalBoxes)} ${t.boxesShort}`, `${formatAmount(r.totalKg)} ${t.kg}`]
        .filter(Boolean)
        .join(" · "),
      total: formatMoney(r.grand.CNY, "CNY", t.som),
      archived: truck.archived_at !== null,
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">⚙️ {t.settings}</h1>
      <PreferencesForm initial={prefs} />

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">📊 {t.excel}</h2>
        <a href="/api/export" download className="btn-primary w-full sm:w-auto">
          {t.exportAll}
        </a>
        <p className="text-sm text-muted">{t.exportHint}</p>
      </section>

      <TruckManager trucks={managed} />
      <AccountForm email={String(claims.data?.claims.email ?? "")} />
    </div>
  );
}
