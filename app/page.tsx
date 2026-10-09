import { TruckForm } from "@/components/truck-form/TruckForm";
import { DEFAULT_EXPENSE_CURRENCY } from "@/lib/calc";
import { rateToInput, todayInTashkent } from "@/lib/format";
import { getT } from "@/lib/i18n-server";
import { getLatestRates } from "@/lib/rates";
import { createClient } from "@/lib/supabase/server";
import { listSuggestions } from "@/lib/trucks";

export default async function NewTruckPage() {
  const supabase = await createClient();
  const [t, rates, suggestions] = await Promise.all([getT(), getLatestRates(supabase), listSuggestions(supabase)]);

  // Start with the usual expense names so only the amounts need typing.
  const preset = (stage: "khorgos" | "tashkent", names: string[]) =>
    names.map((name) => ({ stage, name, note: "", amount: "", currency: DEFAULT_EXPENSE_CURRENCY[stage] }));

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{t.newTruck}</h1>
      <TruckForm
        truckId={null}
        todayRates={rates}
        productNames={suggestions.productNames}
        expenseNames={suggestions.expenseNames}
        initial={{
          info: {
            batchName: "",
            arrivedAt: todayInTashkent(),
            truckNumber: "",
            trailerNumber: "",
            driverPhone: "",
            leftKhorgosAt: "",
            enteredTashkentAt: "",
            notes: "",
          },
          products: [],
          expenses: [
            ...preset("khorgos", t.defaultKhorgosExpenses),
            ...preset("tashkent", t.defaultTashkentExpenses),
          ],
          goodsPaidUsd: "",
          usdCny: rates ? rateToInput(rates.usdCny, 4) : "",
          usdUzs: rates ? rateToInput(rates.usdUzs, 2) : "",
        }}
      />
    </>
  );
}
