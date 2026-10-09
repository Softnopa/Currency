"use client";

import { convert, CURRENCIES, parseNumber, type Currency, type Rates, type Stage } from "@/lib/calc";
import { formatMoney } from "@/lib/format";
import { useT } from "../LangProvider";

export type ExpenseRow = {
  key: number;
  stage: Stage;
  name: string;
  note: string;
  amount: string;
  currency: Currency;
};

export function ExpenseSection({
  title,
  rows,
  totalCny,
  rates,
  onChange,
  onRemove,
  onAdd,
}: {
  title: string;
  rows: ExpenseRow[];
  totalCny: number;
  rates: Rates;
  onChange: (key: number, patch: Partial<ExpenseRow>) => void;
  onRemove: (key: number) => void;
  onAdd: () => void;
}) {
  const { t } = useT();
  const symbol = (c: Currency) => (c === "CNY" ? "¥" : c === "USD" ? "$" : t.som);

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-lg font-bold tabular-nums text-primary">
          {t.total}: {formatMoney(totalCny, "CNY", t.som)}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {rows.map((row, i) => {
          const amount = parseNumber(row.amount);
          return (
            <li key={row.key} className="space-y-2 py-3 first:pt-0">
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-sm text-muted tabular-nums">{i + 1}.</span>
                <input
                  aria-label={t.expenseName}
                  list="expense-names"
                  value={row.name}
                  maxLength={80}
                  placeholder={t.expenseName}
                  onChange={(e) => onChange(row.key, { name: e.target.value })}
                  className="field flex-1 !py-2.5 !text-base"
                />
                <button
                  type="button"
                  onClick={() => onRemove(row.key)}
                  aria-label={t.remove}
                  title={t.remove}
                  className="rounded-xl px-3 py-2 text-xl leading-none text-muted transition hover:bg-danger-soft hover:text-danger"
                >
                  ×
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-8">
                <input
                  aria-label={t.expenseNote}
                  value={row.note}
                  maxLength={80}
                  placeholder={`${t.expenseNote}: ${t.expenseNotePlaceholder}`}
                  onChange={(e) => onChange(row.key, { note: e.target.value })}
                  className="field !w-36 !py-2.5 !text-base"
                />
                <input
                  aria-label={t.amount}
                  inputMode="decimal"
                  value={row.amount}
                  placeholder={t.amount}
                  onChange={(e) => onChange(row.key, { amount: e.target.value })}
                  className="field min-w-28 flex-1 !py-2.5 !text-base"
                />
                <div className="flex rounded-xl border border-border bg-background p-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChange(row.key, { currency: c })}
                      aria-pressed={c === row.currency}
                      title={t.currencyNames[c]}
                      className={`min-w-9 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                        c === row.currency ? "bg-primary text-on-primary" : "text-muted"
                      }`}
                    >
                      {symbol(c)}
                    </button>
                  ))}
                </div>
                {row.currency !== "CNY" && amount > 0 && (
                  <span className="text-sm text-muted tabular-nums">
                    = {formatMoney(convert(amount, row.currency, rates).CNY, "CNY", t.som)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <button type="button" onClick={onAdd} className="btn-ghost w-full border-dashed !py-2.5 text-primary">
        {t.addExpense}
      </button>
    </section>
  );
}
