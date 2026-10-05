import Link from "next/link";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { createClient } from "@/lib/supabase/server";
import { calculateSavedTruck, listTrucks } from "@/lib/trucks";

export default async function HistoryPage({ searchParams }: PageProps<"/trucks">) {
  const showArchive = (await searchParams).archive === "1";
  const supabase = await createClient();
  const [t, trucks] = await Promise.all([getT(), listTrucks(supabase, showArchive ? "archived" : "active")]);

  const tab = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
      active ? "bg-primary text-on-primary" : "text-muted hover:text-foreground"
    }`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.history}</h1>
        <nav className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          <Link href="/trucks" className={tab(!showArchive)}>
            {t.active}
          </Link>
          <Link href="/trucks?archive=1" className={tab(showArchive)}>
            📦 {t.archive}
          </Link>
        </nav>
      </div>

      {trucks.length === 0 ? (
        <div className="card text-center text-muted">
          <p className={showArchive ? "" : "mb-4"}>{showArchive ? t.noArchived : t.noTrucks}</p>
          {!showArchive && (
            <Link href="/" className="btn-primary">
              {t.newTruck}
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {trucks.map((truck) => {
            const r = calculateSavedTruck(truck);
            return (
              <li key={truck.id}>
                <Link
                  href={`/trucks/${truck.id}`}
                  className={`card flex flex-col gap-2 transition hover:border-primary/40 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                    showArchive ? "opacity-80" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold tabular-nums">{formatDate(truck.arrived_at)}</span>
                      {truck.label && <span className="truncate text-muted">{truck.label}</span>}
                    </div>
                    <div className="mt-0.5 text-sm text-muted">
                      {truck.truck_items
                        .map((it) => `${it.fruit_name} · ${formatCount(it.boxes)} ${t.boxesShort}`)
                        .join(", ")}
                    </div>
                  </div>
                  <div className="shrink-0 tabular-nums sm:text-right">
                    <div className="text-lg font-bold text-primary">{formatMoney(r.grand.UZS, "UZS", t.som)}</div>
                    <div className="text-sm text-muted">
                      {formatMoney(r.grand.USD, "USD", t.som)} · {formatMoney(r.grand.CNY, "CNY", t.som)}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
