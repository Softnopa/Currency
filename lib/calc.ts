export const CURRENCIES = ["CNY", "USD", "UZS"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Expenses up to/at Khorgos, and from Khorgos to Tashkent. */
export const STAGES = ["khorgos", "tashkent"] as const;
export type Stage = (typeof STAGES)[number];

/** Currency new expense lines start with: Khorgos costs are paid in ¥, Frag/Rastamoshka in $. */
export const DEFAULT_EXPENSE_CURRENCY: Record<Stage, Currency> = { khorgos: "CNY", tashkent: "USD" };

/** Rates are expressed against 1 US dollar, the way traders quote them. */
export type Rates = {
  usdCny: number; // 1 $ = X ¥
  usdUzs: number; // 1 $ = X so'm
};

export type Money = Record<Currency, number>;

export type ItemInput = {
  name: string;
  boxes: number;
  kgPerBox: number;
  /** Only informational; not used in calculations. */
  piecesPerBox: number | null;
  /** Price of one box in Urumqi, in yuan. */
  priceCny: number;
};

export type ExpenseInput = {
  stage: Stage;
  name: string;
  note: string;
  amount: number;
  currency: Currency;
};

export type ShipmentInput = {
  items: ItemInput[];
  expenses: ExpenseInput[];
  /** Part of the goods money that was paid in dollars. */
  goodsPaidUsd: number;
  rates: Rates;
};

export type ItemResult = ItemInput & {
  totalCny: number;
  totalKg: number;
  /** This product's share of the Khorgos / Tashkent expenses, in yuan. */
  shareKhorgosCny: number;
  shareTashkentCny: number;
  /** Cost of one box once it reaches Khorgos / Tashkent, expenses included. */
  boxAtKhorgos: Money;
  boxAtTashkent: Money;
};

export type ShipmentResult = {
  items: ItemResult[];
  /** "kg" when every product has a weight, otherwise expenses are split by box count. */
  allocation: "kg" | "boxes";
  totalBoxes: number;
  totalKg: number;
  goods: Money;
  khorgos: Money;
  toKhorgos: Money;
  tashkent: Money;
  grand: Money;
  /** Goods money split into the part paid in dollars and the rest paid in yuan. */
  goodsPaid: { usd: number; usdInCny: number; restCny: number };
};

export function toUsd(amount: number, currency: Currency, rates: Rates): number {
  if (currency === "USD") return amount;
  if (currency === "CNY") return rates.usdCny > 0 ? amount / rates.usdCny : 0;
  return rates.usdUzs > 0 ? amount / rates.usdUzs : 0;
}

/** Converts an amount into all three currencies: ¥ → $ → so'm. */
export function convert(amount: number, currency: Currency, rates: Rates): Money {
  const usd = toUsd(amount, currency, rates);
  return {
    CNY: currency === "CNY" ? amount : usd * rates.usdCny,
    USD: usd,
    UZS: currency === "UZS" ? amount : usd * rates.usdUzs,
  };
}

const sumCny = (expenses: ExpenseInput[], stage: Stage, rates: Rates) =>
  expenses
    .filter((e) => e.stage === stage)
    .reduce((sum, e) => sum + convert(e.amount, e.currency, rates).CNY, 0);

/**
 * Same method as the Excel sheet: expenses are split between products by
 * weight (kg), so heavy products carry more of the freight. If any product
 * has no weight entered, box count is used instead.
 */
export function calculateShipment(input: ShipmentInput): ShipmentResult {
  const { rates } = input;
  const items = input.items.filter((it) => it.boxes > 0);
  const allocation = items.length > 0 && items.every((it) => it.kgPerBox > 0) ? "kg" : "boxes";

  const khorgosCny = sumCny(input.expenses, "khorgos", rates);
  const tashkentCny = sumCny(input.expenses, "tashkent", rates);

  const totalBoxes = items.reduce((s, it) => s + it.boxes, 0);
  const totalKg = items.reduce((s, it) => s + it.boxes * it.kgPerBox, 0);
  const totalWeight = allocation === "kg" ? totalKg : totalBoxes;

  const results = input.items.map((it): ItemResult => {
    const totalCny = it.boxes * it.priceCny;
    const itemKg = it.boxes * it.kgPerBox;
    const weight = it.boxes > 0 ? (allocation === "kg" ? itemKg : it.boxes) : 0;
    const part = totalWeight > 0 ? weight / totalWeight : 0;
    const shareKhorgosCny = khorgosCny * part;
    const shareTashkentCny = tashkentCny * part;
    const perBox = (share: number) => (it.boxes > 0 ? share / it.boxes : 0);
    const atKhorgos = it.priceCny + perBox(shareKhorgosCny);
    const atTashkent = atKhorgos + perBox(shareTashkentCny);

    return {
      ...it,
      totalCny,
      totalKg: itemKg,
      shareKhorgosCny,
      shareTashkentCny,
      boxAtKhorgos: convert(atKhorgos, "CNY", rates),
      boxAtTashkent: convert(atTashkent, "CNY", rates),
    };
  });

  const goodsCny = results.reduce((s, it) => s + it.totalCny, 0);
  const usdInCny = convert(input.goodsPaidUsd, "USD", rates).CNY;

  return {
    items: results,
    allocation,
    totalBoxes,
    totalKg,
    goods: convert(goodsCny, "CNY", rates),
    khorgos: convert(khorgosCny, "CNY", rates),
    toKhorgos: convert(goodsCny + khorgosCny, "CNY", rates),
    tashkent: convert(tashkentCny, "CNY", rates),
    grand: convert(goodsCny + khorgosCny + tashkentCny, "CNY", rates),
    goodsPaid: { usd: input.goodsPaidUsd, usdInCny, restCny: goodsCny - usdInCny },
  };
}

/** Accepts "1 250,5" or "1250.5" — whatever is typed on a phone keyboard. */
export function parseNumber(value: string): number {
  const n = Number(value.replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
