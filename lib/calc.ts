export const CURRENCIES = ["CNY", "USD", "UZS"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Rates are expressed against 1 US dollar, the way traders quote them. */
export type Rates = {
  usdCny: number; // 1 $ = X ¥
  usdUzs: number; // 1 $ = X so'm
};

export type Money = Record<Currency, number>;

export type ItemInput = {
  fruitName: string;
  boxes: number;
  pricePerBoxCny: number;
};

export type TruckCalcInput = {
  items: ItemInput[];
  expenseAmount: number;
  expenseCurrency: Currency;
  rates: Rates;
};

export type ItemResult = ItemInput & {
  total: Money;
  /** Cost of one box including its share of the truck expenses. */
  costPerBox: Money;
};

export type TruckResult = {
  items: ItemResult[];
  totalBoxes: number;
  goods: Money;
  expenses: Money;
  grand: Money;
  /** Average cost of one box including expenses. */
  costPerBox: Money;
};

const ZERO: Money = { CNY: 0, USD: 0, UZS: 0 };

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

function add(a: Money, b: Money): Money {
  return { CNY: a.CNY + b.CNY, USD: a.USD + b.USD, UZS: a.UZS + b.UZS };
}

function scale(m: Money, k: number): Money {
  return { CNY: m.CNY * k, USD: m.USD * k, UZS: m.UZS * k };
}

/**
 * Expenses are split between boxes by box count, so every box of every
 * fruit carries the same share of fuel and other truck costs.
 */
export function calculateTruck(input: TruckCalcInput): TruckResult {
  const { rates } = input;
  const totalBoxes = input.items.reduce((sum, it) => sum + it.boxes, 0);
  const expenses = convert(input.expenseAmount, input.expenseCurrency, rates);
  const expensePerBox = totalBoxes > 0 ? scale(expenses, 1 / totalBoxes) : ZERO;

  const items = input.items.map((it) => {
    const total = convert(it.boxes * it.pricePerBoxCny, "CNY", rates);
    const pricePerBox = convert(it.pricePerBoxCny, "CNY", rates);
    return { ...it, total, costPerBox: add(pricePerBox, expensePerBox) };
  });

  const goods = items.reduce((sum, it) => add(sum, it.total), ZERO);
  const grand = add(goods, expenses);

  return {
    items,
    totalBoxes,
    goods,
    expenses,
    grand,
    costPerBox: totalBoxes > 0 ? scale(grand, 1 / totalBoxes) : ZERO,
  };
}

/** Accepts "1 250,5" or "1250.5" — whatever is typed on a phone keyboard. */
export function parseNumber(value: string): number {
  const n = Number(value.replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
