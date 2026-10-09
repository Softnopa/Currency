"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTruck, type TruckPayload } from "@/app/actions";
import { calculateShipment, parseNumber, type Money, type Stage } from "@/lib/calc";
import { formatAmount, formatCount, formatDate, formatMoney, rateToInput } from "@/lib/format";
import type { ErrorKey } from "@/lib/i18n";
import { useT } from "../LangProvider";
import { ExpenseSection, type ExpenseRow } from "./ExpenseSection";
import { Field, Stat } from "./Field";
import { ProductCard, type ProductRow } from "./ProductCard";

export type TodayRates = {
  usdCny: number;
  usdUzs: number;
  rateDate: string;
  source: "cbu" | "er-api";
};

export type TruckInfo = {
  batchName: string;
  arrivedAt: string;
  truckNumber: string;
  trailerNumber: string;
  driverPhone: string;
  leftKhorgosAt: string;
  enteredTashkentAt: string;
  notes: string;
};

export type TruckFormInitial = {
  info: TruckInfo;
  products: Omit<ProductRow, "key">[];
  expenses: Omit<ExpenseRow, "key">[];
  goodsPaidUsd: string;
  usdCny: string;
  usdUzs: string;
};

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "error"; error: ErrorKey };

const emptyProduct = { name: "", boxes: "", kgPerBox: "", piecesPerBox: "", price: "" };

export function TruckForm({
  truckId,
  initial,
  todayRates,
  productNames,
  expenseNames,
  children,
}: {
  truckId: string | null;
  initial: TruckFormInitial;
  todayRates: TodayRates | null;
  productNames: string[];
  expenseNames: string[];
  /** Extra controls shown at the bottom (Excel, archive, delete). */
  children?: React.ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const nextKey = useRef(1000);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const [info, setInfo] = useState(initial.info);
  const [products, setProducts] = useState<ProductRow[]>(() =>
    (initial.products.length ? initial.products : [emptyProduct]).map((p, i) => ({ ...p, key: i })),
  );
  const [expenses, setExpenses] = useState<ExpenseRow[]>(() =>
    initial.expenses.map((e, i) => ({ ...e, key: 500 + i })),
  );
  const [goodsPaidUsd, setGoodsPaidUsd] = useState(initial.goodsPaidUsd);
  const [usdCny, setUsdCny] = useState(initial.usdCny);
  const [usdUzs, setUsdUzs] = useState(initial.usdUzs);

  /** Any edit clears the "saved"/error message. */
  const touch = () => status.kind !== "idle" && setStatus({ kind: "idle" });
  const setInfoField = (patch: Partial<TruckInfo>) => {
    touch();
    setInfo({ ...info, ...patch });
  };

  // ── Live calculation ───────────────────────────────────────────────
  const rates = { usdCny: parseNumber(usdCny), usdUzs: parseNumber(usdUzs) };
  const result = calculateShipment({
    items: products.map((p) => ({
      name: p.name,
      boxes: parseNumber(p.boxes),
      kgPerBox: parseNumber(p.kgPerBox),
      piecesPerBox: null,
      priceCny: parseNumber(p.price),
    })),
    expenses: expenses.map((e) => ({ ...e, amount: parseNumber(e.amount) })),
    goodsPaidUsd: parseNumber(goodsPaidUsd),
    rates,
  });
  const hasTashkent = result.tashkent.CNY > 0;
  const money = (m: Money, c: keyof Money) => formatMoney(m[c], c, t.som);
  const cny = (n: number) => formatMoney(n, "CNY", t.som);

  // ── Rates note ─────────────────────────────────────────────────────
  const todayInputs = todayRates && {
    usdCny: rateToInput(todayRates.usdCny, 4),
    usdUzs: rateToInput(todayRates.usdUzs, 2),
  };
  const isTodayRate = todayInputs && usdCny === todayInputs.usdCny && usdUzs === todayInputs.usdUzs;
  const isSavedRate = truckId && usdCny === initial.usdCny && usdUzs === initial.usdUzs;
  const rateNote = isTodayRate
    ? `${todayRates.source === "cbu" ? t.rateSourceCbu : t.rateSourceOther} · ${formatDate(todayRates.rateDate)}`
    : isSavedRate
      ? t.rateSaved
      : t.rateManual;

  // ── Row editing ────────────────────────────────────────────────────
  const updateProduct = (key: number, patch: Partial<ProductRow>) => {
    touch();
    setProducts(products.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };
  const updateExpense = (key: number, patch: Partial<ExpenseRow>) => {
    touch();
    setExpenses(expenses.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };
  const addExpense = (stage: Stage) => {
    touch();
    setExpenses([...expenses, { key: nextKey.current++, stage, name: "", note: "", amount: "", currency: "CNY" }]);
  };

  function handleSave() {
    const filledProducts = products.filter((p) => p.name.trim() || p.boxes.trim() || p.price.trim());
    const payload: TruckPayload = {
      id: truckId,
      ...info,
      goodsPaidUsd: parseNumber(goodsPaidUsd),
      usdCny: rates.usdCny,
      usdUzs: rates.usdUzs,
      items: filledProducts.map((p) => ({
        name: p.name,
        boxes: parseNumber(p.boxes),
        kgPerBox: parseNumber(p.kgPerBox),
        piecesPerBox: p.piecesPerBox.trim() ? parseNumber(p.piecesPerBox) : null,
        priceCny: parseNumber(p.price),
      })),
      // Lines without an amount (e.g. unused preset names) are not saved.
      expenses: expenses
        .filter((e) => parseNumber(e.amount) > 0)
        .map((e) => ({
          stage: e.stage,
          name: e.name.trim() || "—",
          note: e.note,
          amount: parseNumber(e.amount),
          currency: e.currency,
        })),
    };

    startTransition(async () => {
      const res = await saveTruck(payload);
      if (!res.ok) {
        setStatus({ kind: "error", error: res.error });
      } else if (truckId) {
        setStatus({ kind: "saved" });
        router.refresh();
      } else {
        router.push(`/trucks/${res.id}`);
      }
    });
  }

  const expenseSection = (stage: Stage, title: string, totalCny: number) => (
    <ExpenseSection
      title={title}
      rows={expenses.filter((e) => e.stage === stage)}
      totalCny={totalCny}
      rates={rates}
      onChange={updateExpense}
      onRemove={(key) => {
        touch();
        setExpenses(expenses.filter((e) => e.key !== key));
      }}
      onAdd={() => addExpense(stage)}
    />
  );

  return (
    <form
      className="space-y-4 pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <datalist id="product-names">
        {productNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="expense-names">
        {[...new Set([...t.defaultKhorgosExpenses, ...t.defaultTashkentExpenses, ...expenseNames])].map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* 1. Truck details */}
      <section className="card space-y-3">
        <h2 className="text-base font-semibold">🚚 {t.truckInfo}</h2>
        <Field
          id="batchName"
          label={t.batchName}
          value={info.batchName}
          maxLength={100}
          placeholder={t.batchPlaceholder}
          onChange={(e) => setInfoField({ batchName: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="arrivedAt"
            label={t.date}
            type="date"
            required
            value={info.arrivedAt}
            onChange={(e) => setInfoField({ arrivedAt: e.target.value })}
          />
          <Field
            id="truckNumber"
            label={t.truckNumber}
            value={info.truckNumber}
            maxLength={40}
            placeholder="B60307"
            onChange={(e) => setInfoField({ truckNumber: e.target.value })}
          />
          <Field
            id="trailerNumber"
            label={t.trailerNumber}
            value={info.trailerNumber}
            maxLength={40}
            placeholder="Kz000AKD01"
            onChange={(e) => setInfoField({ trailerNumber: e.target.value })}
          />
          <Field
            id="driverPhone"
            label={t.driverPhone}
            type="tel"
            value={info.driverPhone}
            maxLength={40}
            placeholder="+998 __ ___ __ __"
            onChange={(e) => setInfoField({ driverPhone: e.target.value })}
          />
          <Field
            id="leftKhorgosAt"
            label={t.leftKhorgos}
            type="date"
            value={info.leftKhorgosAt}
            onChange={(e) => setInfoField({ leftKhorgosAt: e.target.value })}
          />
          <Field
            id="enteredTashkentAt"
            label={t.enteredTashkent}
            type="date"
            value={info.enteredTashkentAt}
            onChange={(e) => setInfoField({ enteredTashkentAt: e.target.value })}
          />
        </div>
      </section>

      {/* 2. Products */}
      <section className="space-y-3">
        <h2 className="flex items-baseline justify-between px-1 text-base font-semibold">
          <span>📦 {t.products}</span>
          <span className="text-sm font-normal text-muted tabular-nums">
            {formatCount(result.totalBoxes)} {t.boxesShort} · {formatAmount(result.totalKg)} {t.kg}
          </span>
        </h2>
        {products.map((row, i) => (
          <ProductCard
            key={row.key}
            index={i}
            row={row}
            result={result.items[i]}
            showTashkent={hasTashkent}
            canRemove={products.length > 1}
            onChange={(patch) => updateProduct(row.key, patch)}
            onRemove={() => {
              touch();
              setProducts(products.filter((p) => p.key !== row.key));
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            touch();
            setProducts([...products, { ...emptyProduct, key: nextKey.current++ }]);
          }}
          className="btn-ghost w-full border-dashed !py-3 text-primary"
        >
          {t.addProduct}
        </button>
      </section>

      {/* 3–4. Expenses */}
      {expenseSection("khorgos", `🧾 ${t.expensesKhorgos}`, result.khorgos.CNY)}
      {expenseSection("tashkent", `🛣️ ${t.expensesTashkent}`, result.tashkent.CNY)}
      {result.totalBoxes > 0 && (
        <p className="px-1 text-sm text-muted">ⓘ {result.allocation === "kg" ? t.allocKg : t.allocBoxes}</p>
      )}

      {/* 5. Rates */}
      <section className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">💱 {t.rates}</h2>
          <span className={`text-sm ${isTodayRate ? "text-primary" : "text-accent"}`}>{rateNote}</span>
        </div>
        {!todayRates && (
          <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{t.noRates}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="usdCny"
            label="1 $ = ¥"
            inputMode="decimal"
            value={usdCny}
            onChange={(e) => {
              touch();
              setUsdCny(e.target.value);
            }}
          />
          <Field
            id="usdUzs"
            label={`1 $ = ${t.som}`}
            inputMode="decimal"
            value={usdUzs}
            onChange={(e) => {
              touch();
              setUsdUzs(e.target.value);
            }}
          />
        </div>
        <p className="mt-2 text-sm text-muted">{t.ratesHint}</p>
        {todayInputs && !isTodayRate && (
          <button
            type="button"
            onClick={() => {
              touch();
              setUsdCny(todayInputs.usdCny);
              setUsdUzs(todayInputs.usdUzs);
            }}
            className="btn-ghost mt-3"
          >
            {t.resetRates}
          </button>
        )}
      </section>

      {/* 6. Goods payment */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">💵 {t.goodsPayment}</h2>
          <span className="text-sm text-muted">
            {t.goodsMoney}: <b className="text-foreground tabular-nums">{cny(result.goods.CNY)}</b>
          </span>
        </div>
        <Field
          id="goodsPaidUsd"
          label={t.paidInUsd}
          inputMode="decimal"
          placeholder="0"
          value={goodsPaidUsd}
          onChange={(e) => {
            touch();
            setGoodsPaidUsd(e.target.value);
          }}
        />
        {result.goodsPaid.usd > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <Stat label={`$${formatAmount(result.goodsPaid.usd)} ${t.paidInUsdIs}`} value={cny(result.goodsPaid.usdInCny)} />
            <Stat label={t.restInCny} value={cny(result.goodsPaid.restCny)} strong />
          </div>
        )}
      </section>

      {/* 7. Summary — the bottom of the Excel sheet */}
      <section className="card space-y-3 !border-primary/40">
        <h2 className="text-base font-semibold">📊 {t.summary}</h2>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t.totalBoxes} value={formatCount(result.totalBoxes)} />
          <Stat label={t.totalWeight} value={`${formatAmount(result.totalKg)} ${t.kg}`} />
        </div>
        <dl className="divide-y divide-border rounded-xl border border-border tabular-nums">
          <SummaryRow label={t.goodsMoney} value={cny(result.goods.CNY)} />
          <SummaryRow label={t.khorgosExpenses} value={cny(result.khorgos.CNY)} />
          <SummaryRow label={t.toKhorgosTotal} value={cny(result.toKhorgos.CNY)} strong />
          {hasTashkent && <SummaryRow label={t.tashkentExpenses} value={cny(result.tashkent.CNY)} />}
        </dl>
        <div className="rounded-xl bg-primary-soft p-4">
          <div className="text-sm text-muted">{hasTashkent ? `${t.grandTotal}` : t.toKhorgosTotal}</div>
          <div className="text-3xl font-bold text-primary tabular-nums">{money(result.grand, "CNY")}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-base font-semibold tabular-nums">
            <span>{money(result.grand, "USD")}</span>
            <span>{money(result.grand, "UZS")}</span>
          </div>
        </div>
      </section>

      {/* 8. Notes */}
      <section className="card">
        <label htmlFor="notes" className="label">
          📝 {t.notes}
        </label>
        <textarea
          id="notes"
          rows={3}
          maxLength={2000}
          value={info.notes}
          placeholder={t.notesPlaceholder}
          onChange={(e) => setInfoField({ notes: e.target.value })}
          className="field !text-base"
        />
      </section>

      {children}

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 tabular-nums">
            {status.kind === "error" ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {t[status.error]}
              </p>
            ) : status.kind === "saved" ? (
              <p className="font-semibold text-primary">{t.saved}</p>
            ) : (
              <>
                <div className="truncate text-lg font-bold">{money(result.grand, "CNY")}</div>
                <div className="truncate text-sm text-muted">{money(result.grand, "UZS")}</div>
              </>
            )}
          </div>
          <button type="submit" disabled={pending} className="btn-primary min-w-32">
            {pending ? t.saving : t.save}
          </button>
        </div>
      </div>
    </form>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 px-3 py-2.5 ${strong ? "bg-background" : ""}`}>
      <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={strong ? "text-lg font-bold" : "font-semibold"}>{value}</dd>
    </div>
  );
}
