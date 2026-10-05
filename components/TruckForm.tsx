"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTruck, type TruckPayload } from "@/app/actions";
import { calculateTruck, CURRENCIES, parseNumber, type Currency, type Money } from "@/lib/calc";
import { formatCount, formatDate, formatMoney, rateToInput } from "@/lib/format";
import type { ErrorKey } from "@/lib/i18n";
import { useT } from "./LangProvider";

export type TodayRates = {
  usdCny: number;
  usdUzs: number;
  rateDate: string;
  source: "cbu" | "er-api";
};

export type TruckFormInitial = {
  arrivedAt: string;
  label: string;
  rows: { fruitName: string; boxes: string; price: string }[];
  expenseAmount: string;
  expenseCurrency: Currency;
  usdCny: string;
  usdUzs: string;
};

type Row = { key: number; fruitName: string; boxes: string; price: string };
type Status = { kind: "idle" } | { kind: "saved" } | { kind: "error"; error: ErrorKey };

export function TruckForm({
  truckId,
  initial,
  todayRates,
  fruitNames,
  children,
}: {
  truckId: string | null;
  initial: TruckFormInitial;
  todayRates: TodayRates | null;
  fruitNames: string[];
  /** Extra controls shown under the totals (e.g. delete button). */
  children?: React.ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const nextKey = useRef(initial.rows.length + 1);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const [arrivedAt, setArrivedAt] = useState(initial.arrivedAt);
  const [label, setLabel] = useState(initial.label);
  const [rows, setRows] = useState<Row[]>(() =>
    (initial.rows.length ? initial.rows : [{ fruitName: "", boxes: "", price: "" }]).map((r, i) => ({
      ...r,
      key: i,
    })),
  );
  const [expenseAmount, setExpenseAmount] = useState(initial.expenseAmount);
  const [expenseCurrency, setExpenseCurrency] = useState<Currency>(initial.expenseCurrency);
  const [usdCny, setUsdCny] = useState(initial.usdCny);
  const [usdUzs, setUsdUzs] = useState(initial.usdUzs);

  /** Wraps a setter so that any edit clears the "saved"/error message. */
  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      if (status.kind !== "idle") setStatus({ kind: "idle" });
    };
  }

  const updateRow = (key: number, patch: Partial<Row>) =>
    edit(setRows)(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => edit(setRows)([...rows, { key: nextKey.current++, fruitName: "", boxes: "", price: "" }]);
  const removeRow = (key: number) => edit(setRows)(rows.filter((r) => r.key !== key));

  const rates = { usdCny: parseNumber(usdCny), usdUzs: parseNumber(usdUzs) };
  const result = calculateTruck({
    items: rows.map((r) => ({
      fruitName: r.fruitName,
      boxes: parseNumber(r.boxes),
      pricePerBoxCny: parseNumber(r.price),
    })),
    expenseAmount: parseNumber(expenseAmount),
    expenseCurrency,
    rates,
  });

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

  const money = (m: Money, c: Currency) => formatMoney(m[c], c, t.som);

  function handleSave() {
    const filled = rows.filter((r) => r.fruitName.trim() || r.boxes.trim() || r.price.trim());
    const payload: TruckPayload = {
      id: truckId,
      arrivedAt,
      label,
      expenseAmount: parseNumber(expenseAmount),
      expenseCurrency,
      usdCny: rates.usdCny,
      usdUzs: rates.usdUzs,
      items: filled.map((r) => ({
        fruitName: r.fruitName,
        boxes: parseNumber(r.boxes),
        pricePerBoxCny: parseNumber(r.price),
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

  return (
    <form
      className="space-y-4 pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      {/* Truck */}
      <section className="card grid gap-4 sm:grid-cols-[180px_1fr]">
        <div>
          <label htmlFor="arrivedAt" className="label">
            {t.arrivedAt}
          </label>
          <input
            id="arrivedAt"
            type="date"
            required
            value={arrivedAt}
            onChange={(e) => edit(setArrivedAt)(e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="label" className="label">
            {t.truckLabel}
          </label>
          <input
            id="label"
            value={label}
            maxLength={100}
            placeholder={t.truckLabelPlaceholder}
            onChange={(e) => edit(setLabel)(e.target.value)}
            className="field"
          />
        </div>
      </section>

      {/* Fruits */}
      <section className="space-y-3">
        <h2 className="px-1 text-base font-semibold">{t.fruits}</h2>
        <datalist id="fruit-names">
          {fruitNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        {rows.map((row, i) => {
          const item = result.items[i];
          const hasTotal = item.total.CNY > 0;
          return (
            <div key={row.key} className="card space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor={`fruit-${row.key}`} className="label">
                    {i + 1}. {t.fruitName}
                  </label>
                  <input
                    id={`fruit-${row.key}`}
                    list="fruit-names"
                    value={row.fruitName}
                    placeholder={t.fruitPlaceholder}
                    maxLength={80}
                    onChange={(e) => updateRow(row.key, { fruitName: e.target.value })}
                    className="field"
                  />
                </div>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="mb-1 rounded-xl px-3 py-3 text-xl leading-none text-muted transition hover:bg-danger-soft hover:text-danger"
                    aria-label={t.removeFruit}
                    title={t.removeFruit}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`boxes-${row.key}`} className="label">
                    {t.boxes}
                  </label>
                  <input
                    id={`boxes-${row.key}`}
                    inputMode="numeric"
                    value={row.boxes}
                    placeholder="0"
                    onChange={(e) => updateRow(row.key, { boxes: e.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor={`price-${row.key}`} className="label">
                    {t.pricePerBox}
                  </label>
                  <input
                    id={`price-${row.key}`}
                    inputMode="decimal"
                    value={row.price}
                    placeholder="0"
                    onChange={(e) => updateRow(row.key, { price: e.target.value })}
                    className="field"
                  />
                </div>
              </div>
              {hasTotal && (
                <div className="space-y-1 rounded-xl bg-background px-3 py-2.5 text-sm tabular-nums">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-muted">{t.rowTotal}:</span>
                    <span>{money(item.total, "CNY")}</span>
                    <span>{money(item.total, "USD")}</span>
                    <span className="font-semibold">{money(item.total, "UZS")}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-muted">{t.rowCostPerBox}:</span>
                    <span>{money(item.costPerBox, "USD")}</span>
                    <span className="font-semibold text-accent">{money(item.costPerBox, "UZS")}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button type="button" onClick={addRow} className="btn-ghost w-full border-dashed !py-3 text-primary">
          {t.addFruit}
        </button>
      </section>

      {/* Expenses */}
      <section className="card">
        <h2 className="text-base font-semibold">{t.expenses}</h2>
        <p className="mb-3 text-sm text-muted">{t.expensesHint}</p>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label htmlFor="expenseAmount" className="label">
              {t.amount}
            </label>
            <input
              id="expenseAmount"
              inputMode="decimal"
              value={expenseAmount}
              placeholder="0"
              onChange={(e) => edit(setExpenseAmount)(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <span className="label">&nbsp;</span>
            <div className="flex h-[54px] rounded-xl border border-border bg-background p-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => edit(setExpenseCurrency)(c)}
                  aria-pressed={c === expenseCurrency}
                  title={t.currencyNames[c]}
                  className={`min-w-11 rounded-lg px-2.5 text-base font-semibold transition ${
                    c === expenseCurrency ? "bg-primary text-on-primary shadow-sm" : "text-muted"
                  }`}
                >
                  {c === "CNY" ? "¥" : c === "USD" ? "$" : t.som}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Rates */}
      <section className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">{t.rates}</h2>
          <span className={`text-sm ${isTodayRate ? "text-primary" : "text-accent"}`}>{rateNote}</span>
        </div>
        {!todayRates && (
          <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{t.noRates}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="usdCny" className="label">
              1 $ = ¥
            </label>
            <input
              id="usdCny"
              inputMode="decimal"
              value={usdCny}
              onChange={(e) => edit(setUsdCny)(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="usdUzs" className="label">
              1 $ = {t.som}
            </label>
            <input
              id="usdUzs"
              inputMode="decimal"
              value={usdUzs}
              onChange={(e) => edit(setUsdUzs)(e.target.value)}
              className="field"
            />
          </div>
        </div>
        {todayInputs && !isTodayRate && (
          <button
            type="button"
            onClick={() => {
              edit(setUsdCny)(todayInputs.usdCny);
              setUsdUzs(todayInputs.usdUzs);
            }}
            className="btn-ghost mt-3"
          >
            {t.resetRates}
          </button>
        )}
      </section>

      {/* Totals */}
      <section className="card space-y-3 !border-primary/30">
        <TotalRow label={t.goodsTotal} m={result.goods} money={money} />
        <TotalRow label={t.expensesTotal} m={result.expenses} money={money} />
        <div className="border-t border-border pt-3">
          <TotalRow label={t.grandTotal} m={result.grand} money={money} strong />
        </div>
        <div className="grid gap-3 rounded-xl bg-accent-soft p-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6">
          <div>
            <div className="text-sm text-muted">{t.totalBoxes}</div>
            <div className="text-xl font-bold tabular-nums">{formatCount(result.totalBoxes)}</div>
          </div>
          <div>
            <div className="text-sm text-muted">{t.costPerBox}</div>
            <div className="flex flex-wrap items-baseline gap-x-3 tabular-nums">
              <span className="text-xl font-bold text-accent">{money(result.costPerBox, "UZS")}</span>
              <span className="text-sm">{money(result.costPerBox, "USD")}</span>
              <span className="text-sm">{money(result.costPerBox, "CNY")}</span>
            </div>
          </div>
        </div>
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
                <div className="truncate text-lg font-bold">{money(result.grand, "UZS")}</div>
                <div className="truncate text-sm text-muted">{money(result.grand, "USD")}</div>
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

function TotalRow({
  label,
  m,
  money,
  strong,
}: {
  label: string;
  m: Money;
  money: (m: Money, c: Currency) => string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
      <span className={strong ? "font-semibold" : "text-muted"}>{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-4 tabular-nums">
        <span className={strong ? "text-sm" : "text-sm text-muted"}>{money(m, "CNY")}</span>
        <span className={strong ? "text-base font-semibold" : "text-sm"}>{money(m, "USD")}</span>
        <span className={strong ? "text-2xl font-bold text-primary" : "text-base font-semibold"}>
          {money(m, "UZS")}
        </span>
      </span>
    </div>
  );
}
