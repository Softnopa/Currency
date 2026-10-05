import { TruckForm } from "@/components/TruckForm";
import { rateToInput, todayInTashkent } from "@/lib/format";
import { getPrefs, getT } from "@/lib/i18n-server";
import { getLatestRates } from "@/lib/rates";
import { createClient } from "@/lib/supabase/server";
import { listFruitNames } from "@/lib/trucks";

export default async function NewTruckPage() {
  const supabase = await createClient();
  const [t, prefs, rates, fruitNames] = await Promise.all([
    getT(),
    getPrefs(),
    getLatestRates(supabase),
    listFruitNames(supabase),
  ]);

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{t.newTruck}</h1>
      <TruckForm
        truckId={null}
        todayRates={rates}
        fruitNames={fruitNames}
        initial={{
          arrivedAt: todayInTashkent(),
          label: "",
          rows: [],
          expenseAmount: "",
          expenseCurrency: prefs.expenseCurrency,
          usdCny: rates ? rateToInput(rates.usdCny, 4) : "",
          usdUzs: rates ? rateToInput(rates.usdUzs, 2) : "",
        }}
      />
    </>
  );
}
