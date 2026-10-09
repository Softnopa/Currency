import Link from "next/link";
import { notFound } from "next/navigation";
import { TruckForm } from "@/components/truck-form/TruckForm";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getLatestRates } from "@/lib/rates";
import { createClient } from "@/lib/supabase/server";
import { getTruck, listSuggestions, truckTitle } from "@/lib/trucks";
import { ArchiveTruckButton } from "./ArchiveTruckButton";
import { DeleteTruckButton } from "./DeleteTruckButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (n: number | null) => (n === null || n === 0 ? "" : String(n));

export default async function TruckPage({ params }: PageProps<"/trucks/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [t, truck, rates, suggestions] = await Promise.all([
    getT(),
    getTruck(supabase, id),
    getLatestRates(supabase),
    listSuggestions(supabase),
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
        {truckTitle(truck, t.untitled)}
        <span className="text-lg font-normal text-muted tabular-nums">{formatDate(truck.arrived_at)}</span>
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
        productNames={suggestions.productNames}
        expenseNames={suggestions.expenseNames}
        initial={{
          info: {
            batchName: truck.batch_name,
            arrivedAt: truck.arrived_at,
            truckNumber: truck.truck_number,
            trailerNumber: truck.trailer_number,
            driverPhone: truck.driver_phone,
            leftKhorgosAt: truck.left_khorgos_at ?? "",
            enteredTashkentAt: truck.entered_tashkent_at ?? "",
            notes: truck.notes,
          },
          products: truck.truck_items.map((it) => ({
            name: it.fruit_name,
            boxes: String(it.boxes),
            kgPerBox: str(it.kg_per_box),
            piecesPerBox: str(it.pieces_per_box),
            price: String(it.price_per_box_cny),
          })),
          expenses: truck.truck_expenses.map((e) => ({
            stage: e.stage,
            name: e.name,
            note: e.note,
            amount: String(e.amount),
            currency: e.currency,
          })),
          goodsPaidUsd: str(truck.goods_paid_usd),
          usdCny: String(truck.usd_cny),
          usdUzs: String(truck.usd_uzs),
        }}
      >
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <a href={`/api/trucks/${truck.id}/excel`} download className="btn-ghost">
            📊 {t.downloadExcel}
          </a>
          <ArchiveTruckButton id={truck.id} archived={truck.archived_at !== null} />
          <DeleteTruckButton id={truck.id} />
        </div>
      </TruckForm>
    </>
  );
}
