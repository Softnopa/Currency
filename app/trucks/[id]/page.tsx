import Link from "next/link";
import { notFound } from "next/navigation";
import { TruckForm } from "@/components/TruckForm";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getLatestRates } from "@/lib/rates";
import { createClient } from "@/lib/supabase/server";
import { getTruck, listFruitNames } from "@/lib/trucks";
import { ArchiveTruckButton } from "./ArchiveTruckButton";
import { DeleteTruckButton } from "./DeleteTruckButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TruckPage({ params }: PageProps<"/trucks/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [t, truck, rates, fruitNames] = await Promise.all([
    getT(),
    getTruck(supabase, id),
    getLatestRates(supabase),
    listFruitNames(supabase),
  ]);
  if (!truck) notFound();

  return (
    <>
      <Link
        href={truck.archived_at ? "/trucks?archive=1" : "/trucks"}
        className="mb-3 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t.backToHistory}
      </Link>
      <h1 className="mb-4 flex flex-wrap items-baseline gap-x-2 text-2xl font-bold">
        {formatDate(truck.arrived_at)}
        {truck.label && <span className="font-normal text-muted">· {truck.label}</span>}
        {truck.archived_at && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-accent">
            📦 {t.archived}
          </span>
        )}
      </h1>
      <TruckForm
        key={truck.id}
        truckId={truck.id}
        todayRates={rates}
        fruitNames={fruitNames}
        initial={{
          arrivedAt: truck.arrived_at,
          label: truck.label,
          rows: truck.truck_items.map((it) => ({
            fruitName: it.fruit_name,
            boxes: String(it.boxes),
            price: String(it.price_per_box_cny),
          })),
          expenseAmount: truck.expense_amount ? String(truck.expense_amount) : "",
          expenseCurrency: truck.expense_currency,
          usdCny: String(truck.usd_cny),
          usdUzs: String(truck.usd_uzs),
        }}
      >
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <ArchiveTruckButton id={truck.id} archived={truck.archived_at !== null} />
          <DeleteTruckButton id={truck.id} />
        </div>
      </TruckForm>
    </>
  );
}
