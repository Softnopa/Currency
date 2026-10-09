"use client";

import type { ItemResult } from "@/lib/calc";
import { formatAmount, formatMoney } from "@/lib/format";
import { useT } from "../LangProvider";
import { Field, Stat } from "./Field";

export type ProductRow = {
  key: number;
  name: string;
  boxes: string;
  kgPerBox: string;
  piecesPerBox: string;
  price: string;
};

export function ProductCard({
  index,
  row,
  result,
  showTashkent,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  row: ProductRow;
  result: ItemResult;
  showTashkent: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<ProductRow>) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const id = (field: string) => `${field}-${row.key}`;

  return (
    <div className="card space-y-3">
      <div className="flex items-end gap-2">
        <span className="mb-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
          {index + 1}
        </span>
        <Field
          id={id("name")}
          label={t.productName}
          className="flex-1"
          list="product-names"
          value={row.name}
          maxLength={80}
          placeholder={t.productPlaceholder}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t.remove}
            title={t.remove}
            className="mb-1 rounded-xl px-3 py-3 text-xl leading-none text-muted transition hover:bg-danger-soft hover:text-danger"
          >
            ×
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field
          id={id("boxes")}
          label={t.boxes}
          inputMode="numeric"
          placeholder="0"
          value={row.boxes}
          onChange={(e) => onChange({ boxes: e.target.value })}
        />
        <Field
          id={id("kg")}
          label={t.kgPerBox}
          inputMode="decimal"
          placeholder="0"
          value={row.kgPerBox}
          onChange={(e) => onChange({ kgPerBox: e.target.value })}
        />
        <Field
          id={id("pieces")}
          label={t.piecesPerBox}
          inputMode="numeric"
          placeholder="—"
          value={row.piecesPerBox}
          onChange={(e) => onChange({ piecesPerBox: e.target.value })}
        />
        <Field
          id={id("price")}
          label={t.priceUrumqi}
          inputMode="decimal"
          placeholder="0"
          value={row.price}
          onChange={(e) => onChange({ price: e.target.value })}
        />
      </div>

      {result.totalCny > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t.totalSum} value={formatMoney(result.totalCny, "CNY", t.som)} />
          <Stat label={t.totalKg} value={`${formatAmount(result.totalKg)} ${t.kg}`} />
          <Stat
            label={t.boxAtKhorgos}
            value={formatMoney(result.boxAtKhorgos.CNY, "CNY", t.som)}
            sub={`${t.expenseShare}: ${formatMoney(result.shareKhorgosCny, "CNY", t.som)}`}
            strong={!showTashkent}
          />
          {showTashkent && (
            <Stat
              label={t.boxAtTashkent}
              value={formatMoney(result.boxAtTashkent.CNY, "CNY", t.som)}
              sub={formatMoney(result.boxAtTashkent.UZS, "UZS", t.som)}
              strong
            />
          )}
        </div>
      )}
    </div>
  );
}
